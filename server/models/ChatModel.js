import mongoose from "mongoose";

const clearedBySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      required: true,
    },
    clearedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  { _id: false }
);

const deletedBySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      required: true,
    },
    deletedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  { _id: false }
);

const chatSchema = new mongoose.Schema(
  {
    chatType: {
      type: String,
      enum: ["contact", "group"],
      required: true,
    },
    chatId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    clearedBy: [clearedBySchema],
    deletedBy: [deletedBySchema],
    mutedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "Users" }],
    blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "Users" }],
  },
  { timestamps: true }
);

chatSchema.index({ chatType: 1, chatId: 1 }, { unique: true });
chatSchema.index({ "clearedBy.user": 1 });
chatSchema.index({ "deletedBy.user": 1 });
chatSchema.index({ mutedUsers: 1 });
chatSchema.index({ blockedUsers: 1 });

const Chat = mongoose.model("Chats", chatSchema);
export default Chat;
