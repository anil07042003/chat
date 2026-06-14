import mongoose from "mongoose";

const participantSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "Users", required: true },
  joinedAt: { type: Date },
  leftAt: { type: Date },
  status: { type: String, enum: ["invited", "accepted", "rejected", "missed", "busy"], default: "invited" },
  isMuted: { type: Boolean, default: false },
  isCameraOff: { type: Boolean, default: false },
  isScreenSharing: { type: Boolean, default: false },
}, { _id: false });

const callSchema = new mongoose.Schema(
  {
    callType: {
      type: String,
      enum: ["audio", "video"],
      required: true,
    },
    callMode: {
      type: String,
      enum: ["direct", "group"],
      required: true,
    },
    initiator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      required: true,
    },
    participants: [participantSchema],
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: "Groups" },

    status: {
      type: String,
      enum: ["ringing", "ongoing", "ended", "missed", "rejected"],
      default: "ringing",
    },

    startedAt: { type: Date },
    endedAt: { type: Date },
    duration: { type: Number, default: 0 }, // seconds

    // WebRTC signaling data (temporary)
    offer: { type: mongoose.Schema.Types.Mixed },
    answer: { type: mongoose.Schema.Types.Mixed },
    iceCandidates: [{ type: mongoose.Schema.Types.Mixed }],
  },
  { timestamps: true }
);

callSchema.index({ initiator: 1, createdAt: -1 });
callSchema.index({ "participants.user": 1 });

const Call = mongoose.model("Calls", callSchema);
export default Call;
