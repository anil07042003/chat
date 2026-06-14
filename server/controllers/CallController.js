import Call from "../models/CallModel.js";
import User from "../models/UserModel.js";

export const initiateCall = async (req, res) => {
  try {
    const { recipientId, callType, callMode, groupId } = req.body;
    const userId = req.userId;

    const participants = [
      { user: userId, status: "accepted", joinedAt: new Date() },
    ];

    if (callMode === "direct" && recipientId) {
      participants.push({ user: recipientId, status: "invited" });
    }

    const call = await Call.create({
      callType,
      callMode: callMode || "direct",
      initiator: userId,
      participants,
      groupId: groupId || undefined,
      status: "ringing",
    });

    const populated = await Call.findById(call._id)
      .populate("initiator", "firstName lastName image")
      .populate("participants.user", "firstName lastName image");

    return res.status(201).json({ call: populated });
  } catch (error) {
    console.error("Initiate call error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const updateCallStatus = async (req, res) => {
  try {
    const { callId } = req.params;
    const { status } = req.body;
    const userId = req.userId;

    const call = await Call.findById(callId);
    if (!call) return res.status(404).json({ error: "Call not found" });

    call.status = status;

    if (status === "ongoing") {
      call.startedAt = new Date();
      const participant = call.participants.find((p) => p.user.toString() === userId);
      if (participant) {
        participant.status = "accepted";
        participant.joinedAt = new Date();
      }
    } else if (["ended", "missed", "rejected"].includes(status)) {
      call.endedAt = new Date();
      if (call.startedAt) {
        call.duration = Math.floor((call.endedAt - call.startedAt) / 1000);
      }
      const participant = call.participants.find((p) => p.user.toString() === userId);
      if (participant) {
        participant.status = status === "ended" ? "accepted" : status;
        participant.leftAt = new Date();
      }
    }

    await call.save();

    return res.status(200).json({ call });
  } catch (error) {
    console.error("Update call status error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const getCallHistory = async (req, res) => {
  try {
    const userId = req.userId;
    const { page = 1, limit = 20 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const calls = await Call.find({
      "participants.user": userId,
      status: { $in: ["ended", "missed", "rejected"] },
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("initiator", "firstName lastName image color")
      .populate("participants.user", "firstName lastName image color");

    return res.status(200).json({ calls });
  } catch (error) {
    console.error("Get call history error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};
