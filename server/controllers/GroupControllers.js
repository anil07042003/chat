import mongoose from "mongoose";
import Group from "../models/GroupModel.js";
import Chat from "../models/ChatModel.js";
import User from "../models/UserModel.js";
import Message from "../models/MessageModel.js";
import { getClearedAt, getDeletedAt } from "./ChatController.js";
import { renameSync, existsSync, unlinkSync } from "fs";
import path from "path";

export const createGroup = async (req, res) => {
  try {
    const { name, members, description } = req.body;
    const userId = req.userId;

    if (!name || name.trim() === "") {
      return res.status(400).json({ error: "Group name is required" });
    }

    // Ensure creator is included
    const allMemberIds = [...new Set([userId, ...(members || [])].map((id) => id.toString()))];

    const validMembers = await User.find({ _id: { $in: allMemberIds } }).select("_id email privacySettings friends");
    const foundIds = validMembers.map((m) => m._id.toString());
    const missingIds = allMemberIds.filter((id) => !foundIds.includes(id));
    if (missingIds.length > 0) {
      return res.status(400).json({ error: "Some group members were not found", invalidIds: missingIds });
    }

    const currentUser = await User.findById(userId).select("email");
    const blockedMembers = validMembers.filter((member) => {
      if (member._id.toString() === userId) return false;
      const allowGroupInvitesFrom = member.privacySettings?.allowGroupInvitesFrom || "everyone";
      if (allowGroupInvitesFrom !== "contacts") return false;
      return !member.friends?.includes(currentUser.email);
    });

    if (blockedMembers.length > 0) {
      const blockedEmails = blockedMembers.map((m) => m.email || m._id.toString()).join(", ");
      return res.status(403).json({ error: `Cannot invite ${blockedEmails} due to their group invite privacy settings` });
    }

    const memberDocs = validMembers.map((m) => ({
      user: m._id,
      role: m._id.toString() === userId ? "admin" : "member",
      joinedAt: new Date(),
      addedBy: userId,
    }));

    const newGroup = await Group.create({
      name: name.trim(),
      description: description || "",
      members: memberDocs,
      createdBy: userId,
    });

    const populated = await Group.findById(newGroup._id).populate(
      "members.user",
      "firstName lastName email image color username isOnline"
    );

    return res.status(201).json({ group: populated });
  } catch (error) {
    console.error("Create group error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const getUserGroups = async (req, res) => {
  try {
    const userId = req.userId;

    const groups = await Group.find({
      "members.user": userId,
      isActive: true,
    })
      .sort({ lastActivity: -1 })
      .populate("members.user", "firstName lastName email image color username isOnline");

    const chatStates = await Chat.find({
      chatType: "group",
      chatId: { $in: groups.map((group) => group._id) },
      $or: [
        { "clearedBy.user": userId },
        { "deletedBy.user": userId },
        { mutedUsers: userId },
      ],
    }).lean();

    const stateByGroupId = new Map(
      chatStates.map((chat) => [chat.chatId.toString(), chat])
    );

    const visibleGroups = groups.filter((group) => {
      const state = stateByGroupId.get(group._id.toString());
      const deletedAt = state?.deletedBy?.find(
        (entry) => entry.user.toString() === userId.toString()
      )?.deletedAt;
      return !deletedAt || new Date(group.lastActivity || group.updatedAt) > new Date(deletedAt);
    }).map((group) => {
      const state = stateByGroupId.get(group._id.toString());
      const obj = group.toObject();
      const clearedAt = state?.clearedBy?.find(
        (entry) => entry.user.toString() === userId.toString()
      )?.clearedAt;
      const lastMessageCreatedAt = obj.lastMessage?.createdAt || obj.lastMessage?.timestamp || obj.lastActivity;
      const isLastMessageVisible =
        !clearedAt ||
        (lastMessageCreatedAt && new Date(lastMessageCreatedAt) > new Date(clearedAt));
      const visibleLastMessage = isLastMessageVisible ? obj.lastMessage || null : null;

      return {
        ...obj,
        clearedAt: clearedAt || null,
        visibleLastMessage,
        lastMessage: visibleLastMessage,
        isMuted: state?.mutedUsers?.some((id) => id.toString() === userId.toString()) || false,
      };
    });

    return res.status(200).json({ groups: visibleGroups });
  } catch (error) {
    console.error("Get user groups error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const getGroupMessages = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const userId = req.userId;

    const group = await Group.findOne({
      _id: groupId,
      "members.user": userId,
    });

    if (!group) return res.status(404).json({ error: "Group not found or access denied" });

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const clearedAt = await getClearedAt({
      chatType: "group",
      chatId: groupId,
      userId,
    });
    const deletedAt = await getDeletedAt({
      chatType: "group",
      chatId: groupId,
      userId,
    });
    const hiddenBefore = [clearedAt, deletedAt]
      .filter(Boolean)
      .sort((a, b) => new Date(b) - new Date(a))[0];
    const messageMatch = {
      isDeleted: { $ne: true },
      ...(hiddenBefore ? { createdAt: { $gt: hiddenBefore } } : {}),
    };
    const total = await Message.countDocuments({
      groupId,
      ...messageMatch,
    });

    const populatedGroup = await Group.findById(groupId).populate({
      path: "messages",
      match: messageMatch,
      options: { sort: { createdAt: -1 }, skip, limit: parseInt(limit) },
      populate: [
        { path: "sender", select: "firstName lastName email image color username" },
        { path: "replyTo", select: "content messageType sender fileUrl fileName" },
      ],
    });

    const messages = (populatedGroup.messages || []).reverse();

    // Mark messages as seen
    const messageIds = messages.map((m) => m._id);
    await Message.updateMany(
      {
        _id: { $in: messageIds },
        sender: { $ne: userId },
        seenBy: { $ne: new mongoose.Types.ObjectId(userId) },
      },
      { $addToSet: { seenBy: userId } }
    );

    return res.status(200).json({ messages, total });
  } catch (error) {
    console.error("Get group messages error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const getGroupMembers = async (req, res) => {
  try {
    const { groupId } = req.params;

    const group = await Group.findById(groupId).populate(
      "members.user",
      "firstName lastName email image color username isOnline lastSeen bio"
    );

    if (!group) return res.status(404).json({ error: "Group not found" });

    return res.status(200).json({ members: group.members });
  } catch (error) {
    console.error("Get group members error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const addGroupMembers = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { memberIds } = req.body;
    const userId = req.userId;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ error: "Group not found" });

    const requester = group.members.find((m) => m.user.toString() === userId);
    if (!requester || !["admin", "moderator"].includes(requester.role)) {
      return res.status(403).json({ error: "Only admins can add members" });
    }

    const existingIds = group.members.map((m) => m.user.toString());
    const newIds = [...new Set(memberIds.map((id) => id.toString()))].filter((id) => !existingIds.includes(id));

    if (newIds.length === 0) {
      return res.status(400).json({ error: "No new members to add" });
    }

    const validMembers = await User.find({ _id: { $in: newIds } }).select("_id email privacySettings friends");
    const foundIds = validMembers.map((m) => m._id.toString());
    const missingIds = newIds.filter((id) => !foundIds.includes(id));
    if (missingIds.length > 0) {
      return res.status(400).json({ error: "Some members were not found", invalidIds: missingIds });
    }

    const currentUser = await User.findById(userId).select("email");
    const blockedMembers = validMembers.filter((member) => {
      const allowGroupInvitesFrom = member.privacySettings?.allowGroupInvitesFrom || "everyone";
      if (allowGroupInvitesFrom !== "contacts") return false;
      return !member.friends?.includes(currentUser.email);
    });

    if (blockedMembers.length > 0) {
      const blockedEmails = blockedMembers.map((m) => m.email || m._id.toString()).join(", ");
      return res.status(403).json({ error: `Cannot add ${blockedEmails} due to their group invite privacy settings` });
    }

    const newMembers = validMembers.map((m) => ({
      user: m._id,
      role: "member",
      joinedAt: new Date(),
      addedBy: userId,
    }));

    group.members.push(...newMembers);
    await group.save();

    const updated = await Group.findById(groupId).populate(
      "members.user",
      "firstName lastName email image color username isOnline"
    );

    return res.status(200).json({ group: updated });
  } catch (error) {
    console.error("Add group members error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const removeGroupMember = async (req, res) => {
  try {
    const { groupId, memberId } = req.params;
    const userId = req.userId;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ error: "Group not found" });

    const requester = group.members.find((m) => m.user.toString() === userId);
    const isAdmin = requester && requester.role === "admin";
    const isSelf = memberId === userId;

    if (!isAdmin && !isSelf) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    group.members = group.members.filter((m) => m.user.toString() !== memberId);
    await group.save();

    return res.status(200).json({ message: "Member removed", groupId, memberId });
  } catch (error) {
    console.error("Remove group member error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const updateGroupInfo = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { name, description, settings } = req.body;
    const userId = req.userId;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ error: "Group not found" });

    const requester = group.members.find((m) => m.user.toString() === userId);
    if (!requester || requester.role !== "admin") {
      return res.status(403).json({ error: "Only admins can edit group info" });
    }

    if (name) group.name = name.trim();
    if (description !== undefined) group.description = description;
    if (settings) group.settings = { ...group.settings, ...settings };

    await group.save();

    return res.status(200).json({ group });
  } catch (error) {
    console.error("Update group info error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const updateGroupImage = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.userId;

    if (!req.file) return res.status(400).json({ error: "Image is required" });

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ error: "Group not found" });

    const requester = group.members.find((m) => m.user.toString() === userId);
    if (!requester || requester.role !== "admin") {
      return res.status(403).json({ error: "Only admins can update group image" });
    }

    const date = Date.now();
    const ext = path.extname(req.file.originalname);
    const fileName = `uploads/groups/${date}${ext}`;
    renameSync(req.file.path, fileName);

    if (group.image && existsSync(group.image)) {
      try { unlinkSync(group.image); } catch (e) { /* ignore */ }
    }

    group.image = fileName;
    await group.save();

    return res.status(200).json({ image: group.image });
  } catch (error) {
    console.error("Update group image error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const promoteToAdmin = async (req, res) => {
  try {
    const { groupId, memberId } = req.params;
    const userId = req.userId;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ error: "Group not found" });

    const requester = group.members.find((m) => m.user.toString() === userId);
    if (!requester || requester.role !== "admin") {
      return res.status(403).json({ error: "Only admins can promote members" });
    }

    const member = group.members.find((m) => m.user.toString() === memberId);
    if (!member) return res.status(404).json({ error: "Member not found" });

    member.role = "admin";
    await group.save();

    return res.status(200).json({ message: "Member promoted to admin" });
  } catch (error) {
    console.error("Promote to admin error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const demoteFromAdmin = async (req, res) => {
  try {
    const { groupId, memberId } = req.params;
    const userId = req.userId;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ error: "Group not found" });

    const requester = group.members.find((m) => m.user.toString() === userId);
    if (!requester || requester.role !== "admin") {
      return res.status(403).json({ error: "Only admins can demote members" });
    }

    const member = group.members.find((m) => m.user.toString() === memberId);
    if (!member) return res.status(404).json({ error: "Member not found" });

    member.role = "member";
    await group.save();

    return res.status(200).json({ message: "Admin demoted to member" });
  } catch (error) {
    console.error("Demote from admin error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const getGroupFiles = async (req, res) => {
  try {
    const { groupId } = req.params;

    const group = await Group.findById(groupId).populate({
      path: "messages",
      match: { messageType: { $in: ["image", "video", "audio", "file"] }, isDeleted: { $ne: true } },
      populate: { path: "sender", select: "firstName lastName image" },
    });

    if (!group) return res.status(404).json({ error: "Group not found" });

    return res.status(200).json({ files: (group.messages || []).reverse() });
  } catch (error) {
    console.error("Get group files error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const getGroupsInCommon = async (req, res) => {
  try {
    const { contactId } = req.params;
    const userId = req.userId;

    const groups = await Group.find({
      "members.user": { $all: [userId, contactId] },
      isActive: true,
    }).sort({ lastActivity: -1 });

    return res.status(200).json({ groups });
  } catch (error) {
    console.error("Get groups in common error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const searchGroups = async (req, res) => {
  try {
    const { searchTerm, groups } = req.body;

    if (!searchTerm) return res.status(400).json({ error: "Search term is required" });

    const sanitized = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(sanitized, "i");
    const groupIds = (groups || []).map((g) => g._id);

    const searchedGroups = await Group.find({
      _id: { $in: groupIds },
      name: regex,
    });

    return res.status(200).json({ searchedGroups });
  } catch (error) {
    console.error("Search groups error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};
