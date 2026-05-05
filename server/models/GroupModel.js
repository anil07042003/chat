import mongoose from "mongoose";

const memberSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "Users", required: true },
  role: { type: String, enum: ["admin", "moderator", "member"], default: "member" },
  joinedAt: { type: Date, default: Date.now },
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Users" },
  mutedUntil: { type: Date },
  nickname: { type: String },
}, { _id: false });

const groupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, maxlength: 500, default: "" },
    image: { type: String },
    color: { type: Number, default: 0 },

    members: [memberSchema],
    messages: [{ type: mongoose.Schema.Types.ObjectId, ref: "Messages" }],

    lastMessage: { type: mongoose.Schema.Types.Mixed },
    lastActivity: { type: Date, default: Date.now },

    // Settings
    settings: {
      onlyAdminsCanMessage: { type: Boolean, default: false },
      onlyAdminsCanAddMembers: { type: Boolean, default: false },
      onlyAdminsCanEditInfo: { type: Boolean, default: false },
      isPublic: { type: Boolean, default: false },
      inviteLink: { type: String },
    },

    // Pinned messages
    pinnedMessages: [{ type: mongoose.Schema.Types.ObjectId, ref: "Messages" }],

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Users" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

groupSchema.index({ "members.user": 1 });
groupSchema.index({ name: "text" });

const Group = mongoose.model("Groups", groupSchema);
export default Group;
