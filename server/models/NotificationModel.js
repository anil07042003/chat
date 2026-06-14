import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
    },
    type: {
      type: String,
      enum: [
        "message",
        "group_message",
        "friend_request",
        "friend_accepted",
        "group_invite",
        "call_missed",
        "mention",
        "reaction",
        "system",
      ],
      required: true,
    },
    title: { type: String },
    body: { type: String },
    data: { type: mongoose.Schema.Types.Mixed },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date },
  },
  { timestamps: true }
);

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

const Notification = mongoose.model("Notifications", notificationSchema);
export default Notification;
