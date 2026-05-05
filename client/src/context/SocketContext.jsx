import { createContext, useContext, useEffect, useRef, useCallback } from "react";
import { io } from "socket.io-client";
import { useAppStore } from "../store";
import { HOST } from "../utils/constants";
import { toast } from "react-toastify";

const SocketContext = createContext(null);

export const useSocket = () => useContext(SocketContext);

// Determine the Socket.IO connection URL.
// When HOST is "" (proxy mode), connect to "/" so the Vite proxy forwards
// /socket.io/* to the backend. When HOST is an explicit URL, connect directly.
const getSocketUrl = () => HOST || "/";

export const SocketProvider = ({ children }) => {
  const socketRef = useRef(null);
  const typingTimeoutsRef = useRef({});
  const { userInfo } = useAppStore();

  // Stable getter — always returns the live socket, never stale
  const getSocket = useCallback(() => socketRef.current, []);

  useEffect(() => {
    // Only create/destroy the socket when the user ID changes (login/logout).
    // Do NOT re-run on every userInfo field change (theme, settings, etc.).
    const userId = userInfo?.id;

    if (!userId) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    // Avoid creating a duplicate socket if one already exists for this user
    if (socketRef.current?.connected) return;

    const socket = io(getSocketUrl(), {
      withCredentials: true,
      query: { userId },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      transports: ["websocket", "polling"],
    });

    socketRef.current = socket;

    // ── Connection lifecycle ───────────────────────────────────────────────

    socket.on("connect", () => {
      console.log("✅ Socket connected:", socket.id);
      // Sync online status in the store
      const { userInfo: ui, setUserInfo } = useAppStore.getState();
      if (ui) setUserInfo({ ...ui, isOnline: true });
    });

    socket.on("reconnect", (attempt) => {
      console.log(`🔄 Socket reconnected after ${attempt} attempt(s)`);
      // Re-join group rooms after reconnect (server re-joins on connection,
      // but emit a ping so the server knows we're back)
      const { userInfo: ui } = useAppStore.getState();
      if (ui?.id) {
        socket.emit("rejoinRooms", { userId: ui.id });
      }
    });

    socket.on("disconnect", (reason) => {
      console.log("❌ Socket disconnected:", reason);
      // If the server closed the connection, try to reconnect manually
      if (reason === "io server disconnect") {
        socket.connect();
      }
    });

    socket.on("connect_error", (err) => {
      console.error("Socket connection error:", err.message);
    });

    // ── Direct messages ────────────────────────────────────────────────────

    socket.on("messageSent", ({ message }) => {
      if (!message) return;
      const {
        selectedChatData,
        selectedChatType,
        addMessage,
        addContactsInDMContacts,
        userInfo: ui,
      } = useAppStore.getState();

      const myId = ui?.id;
      const senderId = message.sender?._id || message.sender;
      const recipientId = message.recipient?._id || message.recipient;

      if (
        selectedChatType === "contact" &&
        senderId === myId &&
        selectedChatData?._id === recipientId
      ) {
        addMessage(message);
      }

      addContactsInDMContacts(message);
    });

    socket.on("messageDelivered", ({ messageId, deliveredTo, deliveredAt, status }) => {
      const { selectedChatMessages, setSelectedChatMessages } = useAppStore.getState();
      setSelectedChatMessages(
        selectedChatMessages.map((m) => {
          if (m._id !== messageId) return m;
          const nextStatus = m.status === "seen" ? "seen" : status || "delivered";
          return {
            ...m,
            status: nextStatus,
            deliveredAt: deliveredAt || m.deliveredAt,
            deliveredTo: [...new Set([...(m.deliveredTo || []), deliveredTo].filter(Boolean))],
          };
        })
      );
    });

    socket.on("receiveMessage", (message) => {
      const {
        selectedChatData,
        selectedChatType,
        addMessage,
        addContactsInDMContacts,
        userInfo: ui,
        incrementUnread,
      } = useAppStore.getState();

      const myId        = ui?.id;
      const senderId    = message.sender?._id   || message.sender;
      const recipientId = message.recipient?._id || message.recipient;
      const otherPartyId = senderId === myId ? recipientId : senderId;

      const isCurrentChat =
        selectedChatType === "contact" &&
        selectedChatData?._id === otherPartyId;

      if (senderId !== myId && message._id) {
        socket.emit("messageDelivered", { messageId: message._id, userId: myId });
      }

      if (isCurrentChat) {
        if (senderId !== myId) {
          // Check mediaAutoDownload for media messages
          const autoDownload = ui?.chatSettings?.mediaAutoDownload !== false;
          const isMedia = ["image","video","audio","voice","file"].includes(message.messageType);
          if (isMedia && !autoDownload) {
            // Add message but mark it as pending download
            addMessage({ ...message, pendingDownload: true });
          } else {
            addMessage(message);
          }
        }
      } else if (senderId !== myId) {
        if (otherPartyId) incrementUnread(otherPartyId);

        const n = ui?.notificationSettings || {};
        const muted = useAppStore
          .getState()
          .directMessagesContacts.some((contact) => contact._id === otherPartyId && contact.isMuted);
        // Each setting defaults to true if not explicitly set to false
        const msgNotifs      = n.messageNotifications  !== false;
        const soundEnabled   = n.soundEnabled           !== false;
        const vibEnabled     = n.vibrationEnabled       !== false;
        const previewEnabled = n.previewMessages        !== false;
        const desktopEnabled = n.desktopNotifications   !== false;

        if (msgNotifs && !muted) {
          const senderName = message.sender?.firstName
            ? `${message.sender.firstName} ${message.sender.lastName}`
            : "Someone";
          const preview = previewEnabled
            ? (message.messageType === "text"
                ? message.content?.substring(0, 50)
                : `Sent a ${message.messageType}`)
            : "New message";

          toast.info(`💬 ${senderName}: ${preview}`, { autoClose: 3000 });

          // Browser desktop notification
          if (desktopEnabled && typeof Notification !== "undefined" && Notification.permission === "granted") {
            new Notification(`BaatChit — ${senderName}`, {
              body: preview,
              icon: "/baatchit-icon.svg",
              silent: !soundEnabled,
            });
          }

          // Notification sound
          if (soundEnabled) {
            try {
              const ctx  = new (window.AudioContext || window.webkitAudioContext)();
              const osc  = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.connect(gain);
              gain.connect(ctx.destination);
              osc.frequency.value = 660;
              gain.gain.setValueAtTime(0.15, ctx.currentTime);
              gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
              osc.start(ctx.currentTime);
              osc.stop(ctx.currentTime + 0.25);
              setTimeout(() => { try { ctx.close(); } catch (_) {} }, 500);
            } catch (_) {}
          }

          // Vibration
          if (vibEnabled && typeof navigator !== "undefined" && "vibrate" in navigator) {
            navigator.vibrate([80, 40, 80]);
          }
        }
      }

      addContactsInDMContacts(message);
    });

    socket.on("messageBlocked", ({ message }) => {
      toast.error(message || "You cannot send messages in this chat.");
    });

    // ── Group messages ─────────────────────────────────────────────────────

    socket.on("receiveGroupMessage", (message) => {
      const {
        selectedChatData,
        selectedChatType,
        addMessage,
        sortGroupList,
        userInfo: ui,
        incrementUnread,
      } = useAppStore.getState();

      const myId     = ui?.id;
      const senderId = message.sender?._id || message.sender;

      const isCurrentChat =
        selectedChatType === "group" &&
        selectedChatData?._id === message.groupId?.toString();

      if (isCurrentChat) {
        if (senderId !== myId) {
          const autoDownload = ui?.chatSettings?.mediaAutoDownload !== false;
          const isMedia = ["image","video","audio","voice","file"].includes(message.messageType);
          if (isMedia && !autoDownload) {
            addMessage({ ...message, pendingDownload: true });
          } else {
            addMessage(message);
          }
        }
      } else if (senderId !== myId) {
        incrementUnread(message.groupId);

        const n = ui?.notificationSettings || {};
        const muted = useAppStore
          .getState()
          .groups.some((group) => group._id === message.groupId?.toString() && group.isMuted);
        const groupNotifs    = n.groupNotifications  !== false;
        const soundEnabled   = n.soundEnabled         !== false;
        const vibEnabled     = n.vibrationEnabled     !== false;
        const previewEnabled = n.previewMessages      !== false;
        const desktopEnabled = n.desktopNotifications !== false;

        if (groupNotifs && !muted) {
          const senderName = message.sender?.firstName || "Someone";
          const groupName  = message.group?.name || "Group";
          const preview    = previewEnabled
            ? (message.content?.substring(0, 40) || message.messageType)
            : "New group message";

          toast.info(`👥 ${groupName} — ${senderName}: ${preview}`, { autoClose: 3000 });

          if (desktopEnabled && typeof Notification !== "undefined" && Notification.permission === "granted") {
            new Notification(`BaatChit — ${groupName}`, {
              body: `${senderName}: ${preview}`,
              icon: "/baatchit-icon.svg",
              silent: !soundEnabled,
            });
          }

          if (soundEnabled) {
            try {
              const ctx  = new (window.AudioContext || window.webkitAudioContext)();
              const osc  = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.connect(gain);
              gain.connect(ctx.destination);
              osc.frequency.value = 550;
              gain.gain.setValueAtTime(0.12, ctx.currentTime);
              gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
              osc.start(ctx.currentTime);
              osc.stop(ctx.currentTime + 0.2);
              setTimeout(() => { try { ctx.close(); } catch (_) {} }, 400);
            } catch (_) {}
          }

          if (vibEnabled && typeof navigator !== "undefined" && "vibrate" in navigator) {
            navigator.vibrate([80, 40, 80]);
          }
        }
      }

      if (message.group) sortGroupList(message.group);
    });

    // ── Group creation ─────────────────────────────────────────────────────

    socket.on("receiveGroupCreation", (group) => {
      const { addGroup } = useAppStore.getState();
      addGroup(group);
      // Join the new group's socket room
      socket.emit("joinGroupRoom", { groupId: group._id });
      toast.success(`👥 You were added to "${group.name}"`, { autoClose: 3000 });
    });

    // ── DM contact list update (new message in a different chat) ──────────

    socket.on("updateDMContact", ({ message }) => {
      if (!message) return;
      const { addContactsInDMContacts } = useAppStore.getState();
      addContactsInDMContacts(message);
    });

    // ── Friend requests ────────────────────────────────────────────────────

    socket.on("receiveFriendRequest", (requester) => {
      const { friendRequests, setFriendRequests, setFriendRequestsCount } =
        useAppStore.getState();

      const exists = friendRequests.some((r) => r.email === requester.email);
      if (!exists) {
        const updated = [requester, ...friendRequests];
        setFriendRequests(updated);
        setFriendRequestsCount(updated.length);
        toast.info(
          `👤 ${requester.firstName} ${requester.lastName} sent you a friend request`,
          { autoClose: 4000 }
        );
      }
    });

    // ── Typing indicators ──────────────────────────────────────────────────

    socket.on("userTyping", ({ sender, groupId, isTyping }) => {
      const { setTypingUser, selectedChatData, userInfo: ui } = useAppStore.getState();
      if (!sender || sender === ui?.id) return;

      const chatId = groupId || selectedChatData?._id;
      if (!chatId) return;

      const key = `${chatId}:${sender}`;
      const typingTimeouts = typingTimeoutsRef.current;

      if (isTyping) {
        setTypingUser(chatId, sender, true);
        if (typingTimeouts[key]) {
          clearTimeout(typingTimeouts[key]);
        }
        typingTimeouts[key] = setTimeout(() => {
          setTypingUser(chatId, sender, false);
          delete typingTimeouts[key];
        }, 4000);
      } else {
        setTypingUser(chatId, sender, false);
        if (typingTimeouts[key]) {
          clearTimeout(typingTimeouts[key]);
          delete typingTimeouts[key];
        }
      }
    });

    // ── Message seen ───────────────────────────────────────────────────────

    const handleMessageSeen = ({ messageIds, viewerId, seenAt, status }) => {
      const { selectedChatMessages, setSelectedChatMessages } = useAppStore.getState();
      const updated = selectedChatMessages.map((m) =>
        messageIds.includes(m._id)
          ? {
              ...m,
              status: status || "seen",
              seenAt: seenAt || m.seenAt,
              seenBy: [...new Set([...(m.seenBy || []), viewerId].filter(Boolean))],
            }
          : m
      );
      setSelectedChatMessages(updated);
    };

    socket.on("messageSeen", handleMessageSeen);
    socket.on("messagesSeen", handleMessageSeen);

    // ── Message reactions ──────────────────────────────────────────────────

    socket.on("messageReaction", ({ messageId, reactions }) => {
      const { updateMessage } = useAppStore.getState();
      updateMessage(messageId, { reactions });
    });

    // ── Message edited ─────────────────────────────────────────────────────

    socket.on("messageEdited", ({ messageId, content, isEdited, editedAt }) => {
      const { updateMessage } = useAppStore.getState();
      updateMessage(messageId, { content, isEdited, editedAt });
    });

    // ── Message deleted ────────────────────────────────────────────────────

    socket.on("messageDeleted", ({ messageId, deleteForEveryone }) => {
      if (deleteForEveryone) {
        const { removeMessage } = useAppStore.getState();
        removeMessage(messageId);
      }
    });

    // ── Online status ──────────────────────────────────────────────────────

    socket.on("userOnlineStatus", ({ userId: uid, isOnline, lastSeen }) => {
      const {
        directMessagesContacts,
        setDirectMessagesContacts,
        selectedChatData,
        setSelectedChatData,
      } = useAppStore.getState();

      const updated = directMessagesContacts.map((c) =>
        c._id === uid ? { ...c, isOnline, lastSeen } : c
      );
      setDirectMessagesContacts(updated);

      if (selectedChatData?._id === uid) {
        setSelectedChatData({ ...selectedChatData, isOnline, lastSeen });
      }
    });

    // ── Incoming call ──────────────────────────────────────────────────────
    // Only the ring notification is handled here.
    // callAnswered / iceCandidate / callEnded / callRejected are handled
    // inside CallModal which owns the RTCPeerConnection.

    socket.on("incomingCall", (callData) => {
      const { setIncomingCall, activeCall, userInfo: ui } = useAppStore.getState();

      // If already in a call, send busy signal
      if (activeCall) {
        socket.emit("callBusy", { to: callData.from, callId: callData.callId });
        return;
      }

      // Respect the callNotifications setting
      const n = ui?.notificationSettings || {};
      const callNotifs = n.callNotifications !== false;
      if (!callNotifs) {
        // Silently reject — user has disabled call notifications
        socket.emit("rejectCall", { to: callData.from, callId: callData.callId });
        return;
      }

      setIncomingCall(callData);

      // Vibrate on incoming call if enabled
      const vibEnabled = n.vibrationEnabled !== false;
      if (vibEnabled && typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate([200, 100, 200, 100, 200]);
      }
    });

    // ── Group updates ──────────────────────────────────────────────────────

    socket.on("groupUpdated", ({ groupId, type, payload }) => {
      // Always read from store — never use closure values which may be stale
      const { groups, setGroups, selectedChatData, userInfo: ui } =
        useAppStore.getState();

      if (type === "memberRemoved" && payload?.userId === ui?.id) {
        const updated = groups.filter((g) => g._id !== groupId);
        setGroups(updated);
        if (selectedChatData?._id === groupId) {
          useAppStore.getState().closeChat();
        }
      }
    });

    // ── Cleanup ────────────────────────────────────────────────────────────

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [userInfo?.id]); // Only re-run when the user ID changes, not on every userInfo update

  return (
    <SocketContext.Provider value={{ getSocket }}>
      {children}
    </SocketContext.Provider>
  );
};
