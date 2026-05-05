import { useEffect, useRef, useState, useCallback } from "react";
import { useAppStore } from "../../store";
import { apiClient } from "../../lib/api-client";
import { useSocket } from "../../context/SocketContext";
import { CHAT_WALLPAPERS, normalizeWallpaper, useSettings } from "../../context/SettingsContext";
import { GET_ALL_MESSAGES_ROUTE, GET_GROUP_MESSAGES_ROUTE } from "../../utils/constants";
import ChatHeader from "./ChatHeader";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";
import Spinner from "../ui/Spinner";

const ChatWindow = ({ onBack }) => {
  const {
    selectedChatData,
    selectedChatType,
    selectedChatMessages,
    setSelectedChatMessages,
    clearSelectedChatMessages,
    updateChatMeta,
    userInfo,
  } = useAppStore();

  const { getSocket } = useSocket();
  const { selectedWallpaper } = useSettings();
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const messagesEndRef = useRef(null);

  const loadMessages = useCallback(async (pageNum = 1, append = false) => {
    if (!selectedChatData?._id) return;
    setLoading(true);
    try {
      let msgs = [];
      if (selectedChatType === "contact") {
        const res = await apiClient.post(
          GET_ALL_MESSAGES_ROUTE,
          { id: selectedChatData._id },
          { params: { page: pageNum, limit: 50 } }
        );
        msgs = res.data.messages || [];
      } else if (selectedChatType === "group") {
        const res = await apiClient.get(
          `${GET_GROUP_MESSAGES_ROUTE}/${selectedChatData._id}`,
          { params: { page: pageNum, limit: 50 } }
        );
        msgs = res.data.messages || [];
      }
      setSelectedChatMessages(append ? [...msgs, ...selectedChatMessages] : msgs);
      setHasMore(msgs.length === 50);
    } catch (err) {
      console.error("Load messages error:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedChatData, selectedChatType]);

  useEffect(() => {
    if (selectedChatData) {
      setPage(1);
      loadMessages(1, false);
    }
  }, [selectedChatData?._id]);

  // Scroll to bottom on new messages (only when near bottom)
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedChatMessages.length]);

  const handleLoadMore = () => {
    const next = page + 1;
    setPage(next);
    loadMessages(next, true);
  };

  // Mark messages as seen
  useEffect(() => {
    if (!selectedChatData || selectedChatType !== "contact") return;
    const socket = getSocket();
    if (!socket) return;
    const myId = userInfo?.id;
    if (!myId) return;

    const unreadIds = selectedChatMessages
      .filter((m) => {
        const sid = m.sender?._id || m.sender;
        const hasSeen = (m.seenBy || []).some((id) => (id?._id || id) === myId);
        return sid !== myId && !hasSeen;
      })
      .map((m) => m._id);

    if (unreadIds.length > 0) {
      socket.emit("markMessagesSeen", {
        messageIds: unreadIds,
        viewerId: myId,
        senderId: selectedChatData._id,
      });
    }
  }, [selectedChatMessages, selectedChatData, selectedChatType, getSocket, userInfo?.id]);

  const wallpaper = CHAT_WALLPAPERS[normalizeWallpaper(selectedWallpaper)];

  return (
    /*
     * CSS Grid: 3 rows — header (auto) | messages (1fr) | input (auto)
     * This is the only layout that keeps the input pinned to the bottom
     * and the messages area scrollable at every viewport size.
     */
    <div className="chat-window-grid relative w-full app-bg overflow-hidden" style={{ maxWidth: "100%" }}>

      {/* ── Row 1: Header (auto height) ── */}
      <ChatHeader
        onBack={onBack}
        onChatCleared={(clearedAt) => {
          clearSelectedChatMessages();
          updateChatMeta(selectedChatData._id, selectedChatType, {
            clearedAt,
            visibleLastMessage: null,
            lastMessage: "",
            lastMessageTime: null,
          });
          setHasMore(false);
          setPage(1);
        }}
      />

      {/* ── Row 2: Messages (fills remaining space, scrolls) ── */}
      <div
        className="chat-messages-area"
        style={{
          backgroundImage: wallpaper.image,
          backgroundColor: wallpaper.bg,
          backgroundSize: wallpaper.size,
        }}
      >
        {loading && page === 1 ? (
          <div className="flex items-center justify-center h-full">
            <Spinner size="lg" />
          </div>
        ) : (
          <MessageList
            messages={selectedChatMessages}
            hasMore={hasMore}
            onLoadMore={handleLoadMore}
            loadingMore={loading && page > 1}
            messagesEndRef={messagesEndRef}
          />
        )}
      </div>

      {/* ── Row 3: Input (auto height, never hidden) ── */}
      <div className="chat-input-area">
        <MessageInput />
      </div>

    </div>
  );
};

export default ChatWindow;
