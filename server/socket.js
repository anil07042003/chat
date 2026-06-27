import { Server as SocketIOServer } from "socket.io";
import Message from "./models/MessageModel.js";
import Group from "./models/GroupModel.js";
import Call from "./models/CallModel.js";
import User from "./models/UserModel.js";
import { isDirectChatBlocked } from "./controllers/ChatController.js";
import {
  markMessageDeliveredById,
  markMessagesSeenByIds,
  populateMessage,
} from "./controllers/MessagesController.js";

const setupSocket = (server) => {
  const isDev = process.env.NODE_ENV !== "production";

  const io = new SocketIOServer(server, {
    cors: {
      // In development allow all origins (network IPs, forwarded ports, mobile)
      // In production restrict to the ORIGIN env var list
      origin: isDev
        ? true
        : (process.env.ORIGIN ? process.env.ORIGIN.split(",").map((o) => o.trim()) : ["http://localhost:3000"]),
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // userId -> Set of socketIds (support multiple tabs)
  const userSocketMap = new Map();

  const getUserSocketIds = (userId) => {
    return userSocketMap.get(userId.toString()) || new Set();
  };

  const emitToUser = (userId, event, data) => {
    const socketIds = getUserSocketIds(userId);
    socketIds.forEach((socketId) => {
      io.to(socketId).emit(event, data);
    });
  };

  const addUserSocket = (userId, socketId) => {
    if (!userSocketMap.has(userId)) {
      userSocketMap.set(userId, new Set());
    }
    userSocketMap.get(userId).add(socketId);
  };

  const removeUserSocket = (userId, socketId) => {
    const sockets = userSocketMap.get(userId);
    if (sockets) {
      sockets.delete(socketId);
      if (sockets.size === 0) {
        userSocketMap.delete(userId);
        return true; // user fully offline
      }
    }
    return false;
  };

  // ─── DIRECT MESSAGE ───────────────────────────────────────────────────────
  const sendMessage = async (data) => {
    try {
      const {
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
        isForwarded,
        forwardedFrom,
        mentions,
      } = data;

      const blocked = await isDirectChatBlocked({ sender, recipient });
      if (blocked) {
        emitToUser(sender, "messageBlocked", {
          recipient,
          message: "You cannot send messages in this chat.",
        });
        return;
      }

      const messageData = {
        sender,
        recipient,
        messageType: messageType || "text",
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
      };

      const created = await Message.create(messageData);

      const sentMessage = await populateMessage(Message.findById(created._id)).lean();
      emitToUser(sender, "messageSent", { message: sentMessage });

      // Emit to recipient
      const recipientSockets = getUserSocketIds(recipient);
      let latestMessage = sentMessage;
      if (recipientSockets.size > 0) {
        const deliveredAt = new Date();
        latestMessage = await populateMessage(
          Message.findByIdAndUpdate(
            created._id,
            {
              $addToSet: { deliveredTo: recipient },
              $set: { status: "delivered", deliveredAt },
            },
            { new: true }
          )
        ).lean();

        recipientSockets.forEach((sid) => {
          io.to(sid).emit("receiveMessage", latestMessage);
        });

        emitToUser(sender, "messageDelivered", {
          messageId: created._id.toString(),
          senderId: sender,
          recipientId: recipient,
          deliveredTo: recipient,
          deliveredAt: latestMessage.deliveredAt || deliveredAt,
          status: "delivered",
        });
      }

      // Emit back to sender's OTHER tabs only (not the tab that sent it —
      // that tab already added the message optimistically).
      // We identify the sending socket via the closure but we don't have it
      // here, so we emit to all sender sockets and let the client deduplicate
      // by checking senderId === myId in the receiveMessage handler.
      // Update DM contact list for both parties (moves chat to top)
      emitToUser(sender,    "updateDMContact", { message: latestMessage });
      emitToUser(recipient, "updateDMContact", { message: latestMessage });

    } catch (error) {
      console.error("sendMessage error:", error);
    }
  };

  // ─── GROUP MESSAGE ─────────────────────────────────────────────────────────
  const sendGroupMessage = async (data) => {
    try {
      const {
        groupId,
        sender,
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
        isForwarded,
        mentions,
      } = data;

      const created = await Message.create({
        sender,
        groupId,
        messageType: messageType || "text",
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
        mentions: mentions || [],
      });

      const populated = await Message.findById(created._id)
        .populate("sender", "id email firstName lastName image color username")
        .populate("replyTo", "content messageType sender fileUrl fileName")
        .lean();

      const lastMessageData = {
        content: populated.content,
        messageType: populated.messageType,
        timestamp: populated.createdAt,
        fileUrl: populated.fileUrl,
        fileName: populated.fileName,
        sender: populated.sender,
      };

      const group = await Group.findByIdAndUpdate(
        groupId,
        {
          $push: { messages: created._id },
          $set: { lastMessage: lastMessageData, lastActivity: new Date() },
        },
        { new: true }
      ).populate("members.user", "_id");

      const finalData = { ...populated, groupId: group._id, group };

      // Explicitly acknowledge the saved message to the sender.
      emitToUser(sender, "groupMessageSent", { message: finalData });

      if (group && group.members) {
        group.members.forEach((member) => {
          const memberId = member.user._id.toString();
          if (memberId !== sender.toString()) {
            emitToUser(memberId, "receiveGroupMessage", finalData);
          }
        });
      }
    } catch (error) {
      console.error("sendGroupMessage error:", error);
    }
  };

  // ─── TYPING INDICATORS ────────────────────────────────────────────────────
  const handleTyping = async (data) => {
    try {
      const { sender, recipient, groupId, isTyping } = data;

      if (groupId) {
        // Group typing — use io.to() (not socket.to() which is out of scope here)
        // Broadcast to all group members except the sender
        io.to(`group:${groupId}`).emit("userTyping", { sender, groupId, isTyping });
      } else if (recipient) {
        const senderUser = await User.findById(sender).select("privacySettings");
        const typingEnabled = senderUser?.privacySettings?.typingIndicatorEnabled !== false;

        if (isTyping && !typingEnabled) {
          // Sender has disabled typing indicator — do not forward start events
          return;
        }

        // Always forward stop events so any active indicator clears cleanly.
        emitToUser(recipient, "userTyping", { sender, isTyping });
      }
    } catch (error) {
      console.error("handleTyping error:", error);
    }
  };

  // ─── FRIEND REQUEST ───────────────────────────────────────────────────────
  const sendFriendRequest = async (data) => {
    try {
      const { target, friendRequest } = data;
      if (target && target._id) {
        emitToUser(target._id, "receiveFriendRequest", friendRequest);
      }
    } catch (error) {
      console.error("sendFriendRequest error:", error);
    }
  };

  // ─── GROUP CREATION ───────────────────────────────────────────────────────
  const createGroup = async (group) => {
    try {
      if (group && group.members) {
        group.members.forEach((member) => {
          const memberId = member.user ? member.user._id || member.user : member;
          emitToUser(memberId.toString(), "receiveGroupCreation", group);
        });
      }
    } catch (error) {
      console.error("createGroup socket error:", error);
    }
  };

  // ─── MESSAGE SEEN ─────────────────────────────────────────────────────────
  const markMessagesSeen = async (data) => {
    try {
      const { messageIds, viewerId, senderId } = data;
      if (!messageIds || !messageIds.length) return;

      // Check viewer's readReceiptsEnabled privacy setting.
      // If disabled, we still mark messages as seen in the DB (so the viewer
      // knows they've read them) but we do NOT notify the sender.
      const viewer = await User.findById(viewerId).select("privacySettings");
      const readReceiptsEnabled = viewer?.privacySettings?.readReceiptsEnabled !== false;

      const seenPayload = await markMessagesSeenByIds({ messageIds, viewerId, senderId });
      if (!seenPayload) return;

      // Only emit the seen event to the sender if read receipts are enabled
      if (readReceiptsEnabled) {
        emitToUser(senderId, "messageSeen", seenPayload);
      }
      emitToUser(viewerId, "messageSeen", seenPayload);
    } catch (error) {
      console.error("markMessagesSeen error:", error);
    }
  };

  // ─── MESSAGE REACTION ─────────────────────────────────────────────────────
  const markMessageDelivered = async (data) => {
    try {
      const { messageId, userId } = data;
      const deliveredPayload = await markMessageDeliveredById(messageId, userId);
      if (!deliveredPayload) return;

      emitToUser(deliveredPayload.senderId, "messageDelivered", deliveredPayload);
      emitToUser(userId, "messageDelivered", deliveredPayload);
    } catch (error) {
      console.error("markMessageDelivered error:", error);
    }
  };

  const handleReaction = async (data) => {
    try {
      const { messageId, userId, emoji, recipientId, groupId } = data;

      const message = await Message.findById(messageId);
      if (!message) return;

      message.reactions = message.reactions.filter((r) => r.user.toString() !== userId);
      if (emoji) message.reactions.push({ user: userId, emoji });
      await message.save();

      const reactionData = { messageId, reactions: message.reactions, userId };

      if (groupId) {
        const group = await Group.findById(groupId).populate("members.user", "_id");
        group.members.forEach((m) => emitToUser(m.user._id.toString(), "messageReaction", reactionData));
      } else {
        emitToUser(recipientId, "messageReaction", reactionData);
        emitToUser(userId, "messageReaction", reactionData);
      }
    } catch (error) {
      console.error("handleReaction error:", error);
    }
  };

  // ─── MESSAGE EDIT ─────────────────────────────────────────────────────────
  const handleEditMessage = async (data) => {
    try {
      const { messageId, content, recipientId, groupId } = data;

      const message = await Message.findByIdAndUpdate(
        messageId,
        { content, isEdited: true, editedAt: new Date() },
        { new: true }
      ).populate("sender", "firstName lastName image");

      if (!message) return;

      const editData = { messageId, content, isEdited: true, editedAt: message.editedAt };

      if (groupId) {
        const group = await Group.findById(groupId).populate("members.user", "_id");
        group.members.forEach((m) => emitToUser(m.user._id.toString(), "messageEdited", editData));
      } else {
        emitToUser(recipientId, "messageEdited", editData);
        emitToUser(message.sender._id.toString(), "messageEdited", editData);
      }
    } catch (error) {
      console.error("handleEditMessage error:", error);
    }
  };

  // ─── MESSAGE DELETE ───────────────────────────────────────────────────────
  const handleDeleteMessage = async (data) => {
    try {
      const { messageId, deleteForEveryone, recipientId, groupId, senderId } = data;

      if (deleteForEveryone) {
        const deletedMessage = await Message.findOneAndUpdate({ _id: messageId, sender: senderId }, {
          isDeleted: true,
          deletedAt: new Date(),
          content: null,
          fileUrl: null,
        });
        if (!deletedMessage) return;
      } else {
        await Message.findByIdAndUpdate(messageId, {
          $addToSet: { deletedFor: senderId },
        });
        return;
      }

      const deleteData = { messageId, deleteForEveryone: true };

      if (groupId) {
        const group = await Group.findById(groupId).populate("members.user", "_id");
        group.members.forEach((m) => emitToUser(m.user._id.toString(), "messageDeleted", deleteData));
      } else {
        emitToUser(recipientId, "messageDeleted", deleteData);
        emitToUser(senderId, "messageDeleted", deleteData);
      }
    } catch (error) {
      console.error("handleDeleteMessage error:", error);
    }
  };

  // ─── WEBRTC CALL SIGNALING ────────────────────────────────────────────────
  const handleCallOffer = async (data) => {
    try {
      const { to, from, offer, callType, callId } = data;

      // Check recipient's allowCallsFrom privacy setting
      const recipient = await User.findById(to).select("privacySettings friends");
      const allowCallsFrom = recipient?.privacySettings?.allowCallsFrom || "everyone";

      if (allowCallsFrom === "contacts") {
        // Check if caller is in recipient's friends list
        const caller = await User.findById(from).select("email");
        const isFriend = recipient.friends?.includes(caller?.email);
        if (!isFriend) {
          // Reject the call silently — send callRejected back to caller
          emitToUser(from, "callRejected", { callId, reason: "privacy" });
          return;
        }
      }

      const callerUser = await User.findById(from).select("firstName lastName image color");
      emitToUser(to, "incomingCall", { from, caller: callerUser, offer, callType, callId });
    } catch (error) {
      console.error("handleCallOffer error:", error);
    }
  };

  const handleCallAnswer = (data) => {
    const { to, answer, callId } = data;
    emitToUser(to, "callAnswered", { answer, callId });
  };

  const handleIceCandidate = (data) => {
    const { to, candidate, callId } = data;
    emitToUser(to, "iceCandidate", { candidate, callId });
  };

  const handleCallEnd = async (data) => {
    try {
      const { to, callId, reason } = data;
      emitToUser(to, "callEnded", { callId, reason });
      if (callId) {
        await Call.findByIdAndUpdate(callId, {
          status: reason === "rejected" ? "rejected" : "ended",
          endedAt: new Date(),
        });
      }
    } catch (error) {
      console.error("handleCallEnd error:", error);
    }
  };

  const handleCallReject = (data) => {
    const { to, callId } = data;
    emitToUser(to, "callRejected", { callId });
  };

  const handleCallBusy = (data) => {
    const { to, callId } = data;
    emitToUser(to, "callBusy", { callId });
  };

  // ─── SCREEN SHARE ─────────────────────────────────────────────────────────
  const handleScreenShareOffer = (data) => {
    const { to, offer } = data;
    emitToUser(to, "screenShareOffer", { offer });
  };

  const handleScreenShareAnswer = (data) => {
    const { to, answer } = data;
    emitToUser(to, "screenShareAnswer", { answer });
  };

  // ─── GROUP UPDATES ────────────────────────────────────────────────────────
  const handleGroupUpdate = async (data) => {
    try {
      const { groupId, type, payload } = data;
      const group = await Group.findById(groupId).populate("members.user", "_id");
      if (!group) return;
      group.members.forEach((m) => {
        emitToUser(m.user._id.toString(), "groupUpdated", { groupId, type, payload });
      });
    } catch (error) {
      console.error("handleGroupUpdate error:", error);
    }
  };

  // ─── ONLINE STATUS ────────────────────────────────────────────────────────
  const broadcastOnlineStatus = async (userId, isOnline) => {
    try {
      await User.findByIdAndUpdate(userId, {
        isOnline,
        lastSeen: new Date(),
      });

      // Load the user's privacy settings and friends list
      const user = await User.findById(userId).select("friends email privacySettings");
      if (!user || !user.friends?.length) return;

      const privacy = user.privacySettings || {};
      const onlineStatusVisible = privacy.onlineStatusVisible !== false;
      const lastSeenVisible     = privacy.lastSeenVisible || "everyone";

      // Build the payload respecting privacy settings:
      // - If onlineStatusVisible is false, send isOnline=false (appear offline)
      // - If lastSeenVisible is "nobody", send lastSeen=null
      const payload = {
        userId,
        isOnline:  onlineStatusVisible ? isOnline : false,
        lastSeen:  lastSeenVisible === "nobody" ? null : new Date(),
      };

      // Notify all friends
      const friends = await User.find({ email: { $in: user.friends } }).select("_id");
      friends.forEach((friend) => {
        // For "contacts" visibility, all friends qualify (they're already contacts)
        emitToUser(friend._id.toString(), "userOnlineStatus", payload);
      });
    } catch (error) {
      console.error("broadcastOnlineStatus error:", error);
    }
  };

  // Expose so SettingsController can trigger a re-broadcast when privacy changes.
  // This makes the Online Status toggle take effect immediately for all friends.
  setupSocket.broadcastOnlineStatusById = broadcastOnlineStatus;

  // ─── CONNECTION ───────────────────────────────────────────────────────────
  io.on("connection", async (socket) => {
    const userId = socket.handshake.query.userId;

    if (userId) {
      addUserSocket(userId, socket.id);
      console.log(`User ${userId} connected (socket: ${socket.id})`);

      // Join personal room
      socket.join(`user:${userId}`);

      // Broadcast online status
      await broadcastOnlineStatus(userId, true);

      // Join group rooms
      try {
        const groups = await Group.find({ "members.user": userId }).select("_id");
        groups.forEach((g) => socket.join(`group:${g._id}`));
      } catch (e) { /* ignore */ }
    }

    // Message events
    socket.on("sendMessage", sendMessage);
    socket.on("sendGroupMessage", sendGroupMessage);
    socket.on("typing", handleTyping);
    socket.on("messageDelivered", markMessageDelivered);
    socket.on("markMessagesSeen", markMessagesSeen);
    socket.on("messageReaction", handleReaction);
    socket.on("editMessage", handleEditMessage);
    socket.on("deleteMessage", (data) =>
      handleDeleteMessage({ ...data, senderId: userId })
    );

    // Friend events
    socket.on("sendFriendRequest", sendFriendRequest);

    // Group events
    socket.on("createGroup", createGroup);
    socket.on("groupUpdate", handleGroupUpdate);

    // Re-join group rooms after reconnect
    socket.on("rejoinRooms", async ({ userId: uid }) => {
      try {
        const groups = await Group.find({ "members.user": uid }).select("_id");
        groups.forEach((g) => socket.join(`group:${g._id}`));
      } catch (e) { /* ignore */ }
    });

    // Join a single group room (e.g. after being added to a new group)
    socket.on("joinGroupRoom", ({ groupId }) => {
      if (groupId) socket.join(`group:${groupId}`);
    });

    // Call events (WebRTC signaling)
    socket.on("callOffer", handleCallOffer);
    socket.on("callAnswer", handleCallAnswer);
    socket.on("iceCandidate", handleIceCandidate);
    socket.on("endCall", handleCallEnd);
    socket.on("rejectCall", handleCallReject);
    socket.on("callBusy", handleCallBusy);
    socket.on("screenShareOffer", handleScreenShareOffer);
    socket.on("screenShareAnswer", handleScreenShareAnswer);

    // Disconnect
    socket.on("disconnect", async () => {
      if (userId) {
        const fullyOffline = removeUserSocket(userId, socket.id);
        if (fullyOffline) {
          console.log(`User ${userId} fully disconnected`);
          await broadcastOnlineStatus(userId, false);
        }
      }
    });
  });

  return io;
};

export default setupSocket;
