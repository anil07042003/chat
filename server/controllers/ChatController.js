import mongoose from "mongoose";
import Chat from "../models/ChatModel.js";
import Group from "../models/GroupModel.js";
import User from "../models/UserModel.js";

export const clearChat = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { chatType = "contact" } = req.body;
    const userId = req.userId;

    const accessError = await validateChatAccess({ chatId, chatType, userId });
    if (accessError) return res.status(accessError.status).json({ error: accessError.error });

    const clearedAt = new Date();
    const chat = await getOrCreateChat({ chatType, chatId });
    chat.clearedBy = chat.clearedBy.filter(
      (entry) => entry.user.toString() !== userId.toString()
    );
    chat.clearedBy.push({ user: userId, clearedAt });
    await chat.save();

    return res.status(200).json({
      message: "Chat cleared successfully.",
      chatId,
      chatType,
      clearedAt,
    });
  } catch (error) {
    console.error("Clear chat error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const muteChat = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { chatType = "contact" } = req.body;
    const userId = req.userId;

    const accessError = await validateChatAccess({ chatId, chatType, userId });
    if (accessError) return res.status(accessError.status).json({ error: accessError.error });

    const chat = await getOrCreateChat({ chatType, chatId });
    const isMuted = chat.mutedUsers.some((id) => id.toString() === userId);

    if (isMuted) {
      chat.mutedUsers.pull(userId);
    } else {
      chat.mutedUsers.addToSet(userId);
    }

    await chat.save();

    return res.status(200).json({
      message: isMuted ? "Chat unmuted" : "Muted successfully",
      chatId,
      chatType,
      muted: !isMuted,
    });
  } catch (error) {
    console.error("Mute chat error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const blockChatUser = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.userId;

    const accessError = await validateChatAccess({
      chatId,
      chatType: "contact",
      userId,
    });
    if (accessError) return res.status(accessError.status).json({ error: accessError.error });

    const chat = await getOrCreateChat({ chatType: "contact", chatId });
    chat.blockedUsers.addToSet(userId);
    await chat.save();

    await User.findByIdAndUpdate(userId, {
      $addToSet: { blockedUsers: chatId },
    });

    return res.status(200).json({
      message: "User blocked",
      chatId,
      chatType: "contact",
      blocked: true,
    });
  } catch (error) {
    console.error("Block chat user error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteChatForUser = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { chatType = "contact" } = req.body;
    const userId = req.userId;

    const accessError = await validateChatAccess({ chatId, chatType, userId });
    if (accessError) return res.status(accessError.status).json({ error: accessError.error });

    const deletedAt = new Date();
    const chat = await getOrCreateChat({ chatType, chatId });
    chat.deletedBy = chat.deletedBy.filter(
      (entry) => entry.user.toString() !== userId.toString()
    );
    chat.deletedBy.push({ user: userId, deletedAt });
    await chat.save();

    return res.status(200).json({
      message: "Chat deleted",
      chatId,
      chatType,
      deletedAt,
    });
  } catch (error) {
    console.error("Delete chat error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const getClearedAt = async ({ chatType, chatId, userId }) => {
  const chat = await Chat.findOne({
    chatType,
    chatId,
    "clearedBy.user": userId,
  }).select("clearedBy");

  const entry = chat?.clearedBy?.find(
    (item) => item.user.toString() === userId.toString()
  );

  return entry?.clearedAt || null;
};

export const getDeletedAt = async ({ chatType, chatId, userId }) => {
  const chat = await Chat.findOne({
    chatType,
    chatId,
    "deletedBy.user": userId,
  }).select("deletedBy");

  const entry = chat?.deletedBy?.find(
    (item) => item.user.toString() === userId.toString()
  );

  return entry?.deletedAt || null;
};

export const isDirectChatBlocked = async ({ sender, recipient }) => {
  const blockedChat = await Chat.findOne({
    chatType: "contact",
    $or: [
      { chatId: recipient, blockedUsers: sender },
      { chatId: sender, blockedUsers: recipient },
    ],
  }).select("_id");

  return Boolean(blockedChat);
};

const getOrCreateChat = ({ chatType, chatId }) =>
  Chat.findOneAndUpdate(
    { chatType, chatId },
    { $setOnInsert: { chatType, chatId } },
    { upsert: true, new: true }
  );

const validateChatAccess = async ({ chatId, chatType, userId }) => {
  if (!mongoose.Types.ObjectId.isValid(chatId)) {
    return { status: 400, error: "Invalid chat id" };
  }

  if (!["contact", "group"].includes(chatType)) {
    return { status: 400, error: "Invalid chat type" };
  }

  if (chatType === "group") {
    const group = await Group.findOne({
      _id: chatId,
      "members.user": userId,
      isActive: true,
    }).select("_id");

    if (!group) return { status: 404, error: "Group not found or access denied" };
  } else {
    const contact = await User.findById(chatId).select("_id");
    if (!contact) return { status: 404, error: "Contact not found" };
  }

  return null;
};
