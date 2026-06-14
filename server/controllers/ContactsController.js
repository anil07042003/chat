import Message from "../models/MessageModel.js";
import User from "../models/UserModel.js";
import Chat from "../models/ChatModel.js";
import mongoose from "mongoose";

export const searchContacts = async (req, res) => {
  try {
    const { searchTerm } = req.body;
    const userId = req.userId;

    if (!searchTerm || searchTerm.trim() === "") {
      return res.status(400).json({ error: "Search term is required" });
    }

    const sanitized = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(sanitized, "i");

    const currentUser = await User.findById(userId).select("friends blockedUsers");
    if (!currentUser) return res.status(404).json({ error: "User not found" });

    const contacts = await User.find({
      $and: [
        { _id: { $ne: userId } },
        { _id: { $nin: currentUser.blockedUsers } },
        { email: { $in: currentUser.friends } },
        {
          $or: [
            { firstName: regex },
            { lastName: regex },
            { email: regex },
            { username: regex },
            {
              $expr: {
                $regexMatch: {
                  input: { $concat: ["$firstName", " ", "$lastName"] },
                  regex: sanitized,
                  options: "i",
                },
              },
            },
          ],
        },
      ],
    }).select("firstName lastName email username image color isOnline lastSeen bio privacySettings");

    const visibleContacts = contacts.map((contact) => {
      const { privacySettings = {}, ...rest } = contact.toObject();
      return {
        ...rest,
        image: privacySettings.profilePhotoVisible === "nobody" ? null : rest.image,
        bio: privacySettings.bioVisible === "nobody" ? "" : rest.bio,
        isOnline: privacySettings.onlineStatusVisible === false ? false : rest.isOnline,
        lastSeen: privacySettings.lastSeenVisible === "nobody" ? null : rest.lastSeen,
      };
    });

    return res.status(200).json({ contacts: visibleContacts });
  } catch (error) {
    console.error("Search contacts error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const getContactsForDMList = async (req, res) => {
  try {
    let userId = new mongoose.Types.ObjectId(req.userId);

    const contacts = await Message.aggregate([
      {
        $match: {
          $or: [{ sender: userId }, { recipient: userId }],
          groupId: { $exists: false },
          isDeleted: { $ne: true },
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: {
            $cond: {
              if: { $eq: ["$sender", userId] },
              then: "$recipient",
              else: "$sender",
            },
          },
          lastMessageTime: { $first: "$createdAt" },
          lastMessageType: { $first: "$messageType" },
          lastMessageContent: { $first: "$content" },
          lastFileUrl: { $first: "$fileUrl" },
          lastFileName: { $first: "$fileName" },
          unreadCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ["$sender", userId] },
                    { $not: { $in: [userId, { $ifNull: ["$seenBy", []] }] } },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "contactInfo",
        },
      },
      { $unwind: "$contactInfo" },
      {
        $project: {
          _id: 1,
          lastMessageTime: 1,
          lastMessageType: 1,
          lastMessage: {
            $switch: {
              branches: [
                { case: { $eq: ["$lastMessageType", "text"] }, then: "$lastMessageContent" },
                { case: { $eq: ["$lastMessageType", "image"] }, then: "📷 Photo" },
                { case: { $eq: ["$lastMessageType", "video"] }, then: "🎥 Video" },
                { case: { $eq: ["$lastMessageType", "audio"] }, then: "🎵 Audio" },
                { case: { $eq: ["$lastMessageType", "voice"] }, then: "🎤 Voice message" },
                { case: { $eq: ["$lastMessageType", "file"] }, then: { $concat: ["📎 ", { $ifNull: ["$lastFileName", "File"] }] } },
                { case: { $eq: ["$lastMessageType", "gif"] }, then: "GIF" },
              ],
              default: "$lastMessageContent",
            },
          },
          unreadCount: 1,
          email: "$contactInfo.email",
          username: "$contactInfo.username",
          firstName: "$contactInfo.firstName",
          lastName: "$contactInfo.lastName",
          image: "$contactInfo.image",
          color: "$contactInfo.color",
          isOnline: "$contactInfo.isOnline",
          bio: "$contactInfo.bio",
          privacySettings: "$contactInfo.privacySettings",
          lastSeen: "$contactInfo.lastSeen",
        },
      },
      { $sort: { lastMessageTime: -1 } },
    ]);

    const chatStates = await Chat.find({
      chatType: "contact",
      chatId: { $in: contacts.map((contact) => contact._id) },
      $or: [
        { "clearedBy.user": userId },
        { "deletedBy.user": userId },
        { mutedUsers: userId },
        { blockedUsers: userId },
      ],
    }).lean();

    const stateByContactId = new Map(
      chatStates.map((chat) => [chat.chatId.toString(), chat])
    );

    const visibleContacts = contacts.filter((contact) => {
      const state = stateByContactId.get(contact._id.toString());
      const deletedAt = state?.deletedBy?.find(
        (entry) => entry.user.toString() === userId.toString()
      )?.deletedAt;
      return !deletedAt || new Date(contact.lastMessageTime) > new Date(deletedAt);
    }).map((contact) => {
      const { privacySettings = {}, ...rest } = contact;
      const state = stateByContactId.get(contact._id.toString());
      const clearedAt = state?.clearedBy?.find(
        (entry) => entry.user.toString() === userId.toString()
      )?.clearedAt;
      const lastMessageCreatedAt = rest.lastMessageTime;
      const isLastMessageVisible =
        !clearedAt ||
        (lastMessageCreatedAt && new Date(lastMessageCreatedAt) > new Date(clearedAt));
      const visibleLastMessage = isLastMessageVisible
        ? {
          content: rest.lastMessage,
          messageType: rest.lastMessageType,
          fileUrl: rest.lastFileUrl,
          fileName: rest.lastFileName,
          createdAt: rest.lastMessageTime,
        }
        : null;

      return {
        ...rest,
        clearedAt: clearedAt || null,
        visibleLastMessage,
        lastMessage: visibleLastMessage?.content || "",
        lastMessageTime: visibleLastMessage?.createdAt || null,
        image: privacySettings.profilePhotoVisible === "nobody" ? null : rest.image,
        bio: privacySettings.bioVisible === "nobody" ? "" : rest.bio,
        isOnline: privacySettings.onlineStatusVisible === false ? false : rest.isOnline,
        lastSeen: privacySettings.lastSeenVisible === "nobody" ? null : rest.lastSeen,
        isMuted: state?.mutedUsers?.some((id) => id.toString() === userId.toString()) || false,
        isBlocked: state?.blockedUsers?.some((id) => id.toString() === userId.toString()) || false,
      };
    });

    return res.status(200).json({ contacts: visibleContacts });
  } catch (error) {
    console.error("Get DM contacts error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const getAllContacts = async (req, res) => {
  try {
    const currentUser = await User.findById(req.userId).select("friends blockedUsers");
    if (!currentUser) return res.status(404).json({ error: "User not found" });

    const contacts = await User.find({
      _id: { $ne: req.userId },
      email: { $in: currentUser.friends },
      _id: { $nin: currentUser.blockedUsers },
    }).select("firstName lastName email username image color isOnline lastSeen bio privacySettings");

    const visibleContacts = contacts.map((contact) => {
      const { privacySettings = {}, ...rest } = contact.toObject();
      return {
        ...rest,
        image: privacySettings.profilePhotoVisible === "nobody" ? null : rest.image,
        bio: privacySettings.bioVisible === "nobody" ? "" : rest.bio,
        isOnline: privacySettings.onlineStatusVisible === false ? false : rest.isOnline,
        lastSeen: privacySettings.lastSeenVisible === "nobody" ? null : rest.lastSeen,
      };
    });

    return res.status(200).json({ contacts: visibleContacts });
  } catch (error) {
    console.error("Get all contacts error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const getContactFiles = async (req, res) => {
  try {
    const { contactId } = req.params;
    const currentUser = req.userId;

    const files = await Message.find({
      $or: [
        { sender: currentUser, recipient: contactId },
        { sender: contactId, recipient: currentUser },
      ],
      messageType: { $in: ["image", "video", "audio", "file"] },
      isDeleted: { $ne: true },
    })
      .sort({ createdAt: -1 })
      .populate("sender", "firstName lastName image");

    return res.status(200).json({ files });
  } catch (error) {
    console.error("Get contact files error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const getUserProfile = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUser = await User.findById(req.userId).select("email");
    const user = await User.findById(userId).select(
      "firstName lastName email username image color bio isOnline lastSeen privacySettings friends"
    );

    if (!user) return res.status(404).json({ error: "User not found" });

    const isFriend = currentUser && user.friends?.includes(currentUser.email);
    const { privacySettings = {}, friends, ...rest } = user.toObject();

    const visibleUser = {
      ...rest,
      image:
        privacySettings.profilePhotoVisible === "nobody" ||
        (privacySettings.profilePhotoVisible === "contacts" && !isFriend)
          ? null
          : rest.image,
      bio:
        privacySettings.bioVisible === "nobody" ||
        (privacySettings.bioVisible === "contacts" && !isFriend)
          ? ""
          : rest.bio,
      isOnline:
        privacySettings.onlineStatusVisible === false ||
        (privacySettings.onlineStatusVisible === "contacts" && !isFriend)
          ? false
          : rest.isOnline,

      lastSeen:
        privacySettings.lastSeenVisible === "nobody" ||
        (privacySettings.lastSeenVisible === "contacts" && !isFriend)
          ? null
          : rest.lastSeen,
    };

    return res.status(200).json({ user: visibleUser });
  } catch (error) {
    console.error("Get user profile error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const blockUser = async (req, res) => {
  try {
    const { userId: targetId } = req.body;
    await User.findByIdAndUpdate(req.userId, {
      $addToSet: { blockedUsers: targetId },
    });
    return res.status(200).json({ message: "User blocked" });
  } catch (error) {
    console.error("Block user error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const unblockUser = async (req, res) => {
  try {
    const { userId: targetId } = req.body;
    await User.findByIdAndUpdate(req.userId, {
      $pull: { blockedUsers: targetId },
    });
    return res.status(200).json({ message: "User unblocked" });
  } catch (error) {
    console.error("Unblock user error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};
