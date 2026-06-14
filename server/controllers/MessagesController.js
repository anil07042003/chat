import Message from "../models/MessageModel.js";
import User from "../models/UserModel.js";
import mongoose from "mongoose";
import { unlinkSync, existsSync } from "fs";
import { getClearedAt, getDeletedAt } from "./ChatController.js";

export const populateMessage = (query) =>
  query
    .populate("sender", "id email firstName lastName image color username")
    .populate("recipient", "id email firstName lastName image color username")
    .populate("replyTo", "content messageType sender fileUrl fileName");

const getStatusFromMessage = (message) => {
  if (message.seenBy?.length) return "seen";
  if (message.deliveredTo?.length) return "delivered";
  return message.status || "sent";
};

export const markMessageDeliveredById = async (messageId, userId) => {
  if (!messageId || !userId) return null;
  const deliveredAt = new Date();
  const message = await Message.findOneAndUpdate(
    {
      _id: messageId,
      recipient: userId,
      sender: { $ne: userId },
      deliveredTo: { $ne: userId },
    },
    {
      $addToSet: { deliveredTo: userId },
      $set: { status: "delivered", deliveredAt },
    },
    { new: true }
  ).lean();

  if (!message) return null;

  return {
    messageId: message._id.toString(),
    senderId: message.sender.toString(),
    recipientId: message.recipient?.toString(),
    deliveredTo: userId,
    deliveredAt: message.deliveredAt || deliveredAt,
    status: getStatusFromMessage(message),
  };
};

export const markMessagesSeenByIds = async ({ messageIds, viewerId, senderId }) => {
  if (!messageIds?.length || !viewerId || !senderId) return null;
  const seenAt = new Date();
  const result = await Message.updateMany(
    {
      _id: { $in: messageIds },
      sender: senderId,
      recipient: viewerId,
    },
    {
      $addToSet: { seenBy: viewerId, deliveredTo: viewerId },
      $set: { status: "seen", seenAt, deliveredAt: seenAt },
    }
  );

  if (!result.modifiedCount && !result.matchedCount) return null;

  return {
    messageIds,
    viewerId,
    senderId,
    seenBy: viewerId,
    seenAt,
    status: "seen",
  };
};

export const createMessage = async (req, res) => {
  try {
    const sender = req.userId;
    const {
      recipient,
      messageType = "text",
      content,
      fileUrl,
      fileName,
      fileSize,
      fileMimeType,
      thumbnailUrl,
      duration,
      gifUrl,
      stickerUrl,
      replyTo,
      isForwarded,
      forwardedFrom,
      mentions,
    } = req.body;

    if (!recipient) return res.status(400).json({ error: "Recipient is required" });

    const created = await Message.create({
      sender,
      recipient,
      messageType,
      content,
      fileUrl,
      fileName,
      fileSize,
      fileMimeType,
      thumbnailUrl,
      duration,
      gifUrl,
      stickerUrl,
      replyTo,
      isForwarded: isForwarded || false,
      forwardedFrom,
      mentions: mentions || [],
      status: "sent",
    });

    const message = await populateMessage(Message.findById(created._id)).lean();
    return res.status(201).json({ message });
  } catch (error) {
    console.error("Create message error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const markDelivered = async (req, res) => {
  try {
    const { messageId } = req.params;
    const payload = await markMessageDeliveredById(messageId, req.userId);
    if (!payload) return res.status(404).json({ error: "Message not found" });
    return res.status(200).json(payload);
  } catch (error) {
    console.error("Mark delivered error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const markSeen = async (req, res) => {
  try {
    const { messageIds, senderId } = req.body;
    const payload = await markMessagesSeenByIds({
      messageIds,
      viewerId: req.userId,
      senderId,
    });
    if (!payload) return res.status(400).json({ error: "No messages updated" });
    return res.status(200).json(payload);
  } catch (error) {
    console.error("Mark seen error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const getMessages = async (req, res) => {
  try {
    const user1 = req.userId;
    const user2 = req.body.id || req.params.chatId;
    const { page = 1, limit = 50 } = req.query;

    if (!user1 || !user2) {
      return res.status(400).json({ error: "Both user IDs are required" });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const clearedAt = await getClearedAt({
      chatType: "contact",
      chatId: user2,
      userId: user1,
    });
    const deletedAt = await getDeletedAt({
      chatType: "contact",
      chatId: user2,
      userId: user1,
    });
    const hiddenBefore = [clearedAt, deletedAt]
      .filter(Boolean)
      .sort((a, b) => new Date(b) - new Date(a))[0];

    const messages = await Message.find({
      $or: [
        { sender: user1, recipient: user2 },
        { sender: user2, recipient: user1 },
      ],
      deletedFor: { $ne: user1 },
      ...(hiddenBefore ? { createdAt: { $gt: hiddenBefore } } : {}),
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("sender", "id email firstName lastName image color username")
      .populate("recipient", "id email firstName lastName image color username")
      .populate("replyTo", "content messageType sender fileUrl fileName")
      .lean();

    return res.status(200).json({ messages: messages.reverse() });
  } catch (error) {
    console.error("Get messages error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const editMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { content } = req.body;

    if (!content || content.trim() === "") {
      return res.status(400).json({ error: "Content is required" });
    }

    const message = await Message.findOne({ _id: messageId, sender: req.userId });
    if (!message) {
      return res.status(404).json({ error: "Message not found or unauthorized" });
    }

    if (message.messageType !== "text") {
      return res.status(400).json({ error: "Only text messages can be edited" });
    }

    message.content = content.trim();
    message.isEdited = true;
    message.editedAt = new Date();
    await message.save();

    const updated = await Message.findById(messageId)
      .populate("sender", "id email firstName lastName image color")
      .populate("recipient", "id email firstName lastName image color");

    return res.status(200).json({ message: updated });
  } catch (error) {
    console.error("Edit message error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { deleteForEveryone } = req.body;

    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ error: "Message not found" });

    if (deleteForEveryone && message.sender.toString() === req.userId) {
      // Delete for everyone
      message.isDeleted = true;
      message.deletedAt = new Date();
      message.content = null;
      message.fileUrl = null;
      await message.save();
    } else {
      // Delete for self only
      await Message.findByIdAndUpdate(messageId, {
        $addToSet: { deletedFor: req.userId },
      });
    }

    return res.status(200).json({ message: "Message deleted", messageId, deleteForEveryone });
  } catch (error) {
    console.error("Delete message error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const addReaction = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;

    if (!emoji) return res.status(400).json({ error: "Emoji is required" });

    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ error: "Message not found" });

    // Remove existing reaction from this user
    message.reactions = message.reactions.filter(
      (r) => r.user.toString() !== req.userId
    );

    // Add new reaction
    message.reactions.push({ user: req.userId, emoji });
    await message.save();

    return res.status(200).json({ reactions: message.reactions, messageId });
  } catch (error) {
    console.error("Add reaction error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const removeReaction = async (req, res) => {
  try {
    const { messageId } = req.params;

    await Message.findByIdAndUpdate(messageId, {
      $pull: { reactions: { user: req.userId } },
    });

    return res.status(200).json({ message: "Reaction removed", messageId });
  } catch (error) {
    console.error("Remove reaction error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const pinMessage = async (req, res) => {
  try {
    const { messageId } = req.params;

    const message = await Message.findByIdAndUpdate(
      messageId,
      { isPinned: true, pinnedBy: req.userId, pinnedAt: new Date() },
      { new: true }
    );

    return res.status(200).json({ message });
  } catch (error) {
    console.error("Pin message error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const starMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = new mongoose.Types.ObjectId(req.userId);

    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ error: "Message not found" });

    const isStarred = message.starredBy.some((id) => id.toString() === req.userId);

    if (isStarred) {
      await Message.findByIdAndUpdate(messageId, { $pull: { starredBy: userId } });
    } else {
      await Message.findByIdAndUpdate(messageId, { $addToSet: { starredBy: userId } });
    }

    return res.status(200).json({ messageId, isStarred: !isStarred });
  } catch (error) {
    console.error("Star message error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const searchMessages = async (req, res) => {
  try {
    const { query, contactId, groupId } = req.body;
    const userId = req.userId;

    if (!query) return res.status(400).json({ error: "Query is required" });

    const chatType = groupId ? "group" : "contact";
    const chatId = groupId || contactId;
    const clearedAt = chatId
      ? await getClearedAt({ chatType, chatId, userId })
      : null;
    const deletedAt = chatId
      ? await getDeletedAt({ chatType, chatId, userId })
      : null;
    const hiddenBefore = [clearedAt, deletedAt]
      .filter(Boolean)
      .sort((a, b) => new Date(b) - new Date(a))[0];

    const searchFilter = groupId
      ? {
        groupId,
        isDeleted: { $ne: true },
      }
      : {
        $or: [
          { sender: userId, recipient: contactId },
          { sender: contactId, recipient: userId },
        ],
        deletedFor: { $ne: userId },
      };

    Object.assign(searchFilter, {
      messageType: "text",
      content: { $regex: query, $options: "i" },
      isDeleted: { $ne: true },
      ...(hiddenBefore ? { createdAt: { $gt: hiddenBefore } } : {}),
    });

    const messages = await Message.find(searchFilter)
      .sort({ createdAt: -1 })
      .limit(50)
      .populate("sender", "firstName lastName image");

    return res.status(200).json({ messages });
  } catch (error) {
    console.error("Search messages error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "File is required" });
    }

    const fileUrl = `uploads/files/${req.file.filename}`;

    return res.status(200).json({
      fileUrl,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      fileMimeType: req.file.mimetype,
    });
  } catch (error) {
    console.error("Upload file error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};
