import mongoose from "mongoose";

const reactionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "Users", required: true },
  emoji: { type: String, required: true },
}, { _id: false });

const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      required: true,
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
    },
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Groups",
    },
    messageType: {
      type: String,
      enum: ["text", "image", "video", "audio", "voice", "file", "gif", "sticker", "location", "system"],
      required: true,
      default: "text",
    },
    content: { type: String },
    fileUrl: { type: String },
    fileName: { type: String },
    fileSize: { type: Number },
    fileMimeType: { type: String },
    thumbnailUrl: { type: String },
    duration: { type: Number }, // for audio/video in seconds
    gifUrl: { type: String },
    stickerUrl: { type: String },
    latitude: { type: Number, min: -90, max: 90 },
    longitude: { type: Number, min: -180, max: 180 },

    // Reply
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Messages",
    },

    // Forwarded
    isForwarded: { type: Boolean, default: false },
    forwardedFrom: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
    },

    // Status
    status: {
      type: String,
      enum: ["sent", "delivered", "seen"],
      default: "sent",
    },
    seenBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "Users" }],
    deliveredTo: [{ type: mongoose.Schema.Types.ObjectId, ref: "Users" }],
    deliveredAt: { type: Date },
    seenAt: { type: Date },

    // Reactions
    reactions: [reactionSchema],

    // Moderation
    isEdited: { type: Boolean, default: false },
    editedAt: { type: Date },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: "Users" }],

    // Pinned
    isPinned: { type: Boolean, default: false },
    pinnedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Users" },
    pinnedAt: { type: Date },

    // Starred
    starredBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "Users" }],

    // Mentions
    mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: "Users" }],
  },
  { timestamps: true }
);

messageSchema.index({ sender: 1, recipient: 1, createdAt: -1 });
messageSchema.index({ groupId: 1, createdAt: -1 });
messageSchema.index({ content: "text" });

const Message = mongoose.model("Messages", messageSchema);
export default Message;
