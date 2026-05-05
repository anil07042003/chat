import { useState } from "react";
import { useAppStore } from "../../store";
import Avatar from "../ui/Avatar";
import { getFullName, formatLastSeen } from "../../utils/helpers";
import {
  IoArrowBack,
  IoCall,
  IoVideocam,
  IoSearch,
  IoEllipsisVertical,
  IoInformationCircle,
} from "react-icons/io5";
import { useSocket } from "../../context/SocketContext";
import { apiClient } from "../../lib/api-client";
import {
  BLOCK_CHAT_ROUTE,
  CLEAR_CHAT_ROUTE,
  DELETE_CHAT_ROUTE,
  INITIATE_CALL_ROUTE,
  MUTE_CHAT_ROUTE,
} from "../../utils/constants";
import { toast } from "react-toastify";
import ChatInfoPanel from "./ChatInfoPanel";
import SearchMessagesPanel from "./SearchMessagesPanel";
import ChatOptionsMenu from "./ChatOptionsMenu";
import ClearChatModal from "./ClearChatModal";

const ChatHeader = ({ onBack, onChatCleared }) => {
  const {
    selectedChatData,
    selectedChatType,
    typingUsers,
    setActiveCall,
    closeChat,
    removeChatFromList,
    updateChatMeta,
  } = useAppStore();

  const { getSocket } = useSocket();
  const [showInfo, setShowInfo] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [clearingChat, setClearingChat] = useState(false);
  const [, setBusyAction] = useState(null);

  const isGroup = selectedChatType === "group";
  const name = isGroup ? selectedChatData?.name : getFullName(selectedChatData);
  const chatId = selectedChatData?._id;
  const typingList = typingUsers[chatId] || [];
  const isTyping = typingList.length > 0;

  const getSubtitle = () => {
    if (isTyping) {
      return isGroup ? `${typingList.length} typing...` : "typing...";
    }
    if (isGroup) {
      const count = selectedChatData?.members?.length || 0;
      return `${count} member${count !== 1 ? "s" : ""}`;
    }
    // For DMs: respect the contact's privacy settings.
    // The server already filters isOnline/lastSeen based on their settings,
    // so we just display what we receive — null means hidden.
    if (selectedChatData?.isOnline) return "online";
    if (selectedChatData?.lastSeen) return `last seen ${formatLastSeen(selectedChatData.lastSeen)}`;
    return "";
  };

  const handleCall = async (callType) => {
    if (!selectedChatData?._id) return;
    const socket = getSocket();
    if (!socket) return;

    try {
      const res = await apiClient.post(INITIATE_CALL_ROUTE, {
        recipientId: selectedChatData._id,
        callType,
        callMode: "direct",
      });

      const call = res.data.call;
      // Set activeCall — CallModal will mount and send the real callOffer
      // with the SDP once the peer connection and local media are ready.
      // Do NOT emit callOffer here — there is no SDP yet.
      setActiveCall({ ...call, callType, isInitiator: true });
    } catch (err) {
      toast.error("Failed to initiate call");
    }
  };

  const openClearModal = () => {
    setShowMenu(false);
    setShowClearModal(true);
  };

  const handleViewProfile = () => {
    setShowInfo(true);
  };

  const handleSearchMessages = () => {
    setShowSearch(true);
  };

  const handleToggleMute = async () => {
    if (!selectedChatData?._id || !selectedChatType) return;

    const previousMuted = Boolean(selectedChatData.isMuted);
    updateChatMeta(selectedChatData._id, selectedChatType, {
      isMuted: !previousMuted,
    });

    setBusyAction("mute");
    try {
      const res = await apiClient.post(MUTE_CHAT_ROUTE(selectedChatData._id), {
        chatType: selectedChatType,
      });
      updateChatMeta(selectedChatData._id, selectedChatType, {
        isMuted: res.data.muted,
      });
      toast.success(res.data.muted ? "Muted successfully" : "Notifications unmuted");
    } catch (err) {
      updateChatMeta(selectedChatData._id, selectedChatType, {
        isMuted: previousMuted,
      });
      toast.error(err.response?.data?.error || "Failed to update mute setting");
    } finally {
      setBusyAction(null);
    }
  };

  const handleClearChat = async () => {
    if (!selectedChatData?._id || !selectedChatType) return;

    setClearingChat(true);
    try {
      const res = await apiClient.post(CLEAR_CHAT_ROUTE(selectedChatData._id), {
        chatType: selectedChatType,
      });
      onChatCleared?.(res.data.clearedAt);
      setShowClearModal(false);
      toast.success("Chat cleared successfully.");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to clear chat");
    } finally {
      setClearingChat(false);
    }
  };

  const handleDeleteChat = async () => {
    if (!selectedChatData?._id || !selectedChatType) return;

    const chatId = selectedChatData._id;
    const chatType = selectedChatType;

    setBusyAction("delete");
    try {
      await apiClient.delete(DELETE_CHAT_ROUTE(chatId), {
        data: { chatType },
      });
      removeChatFromList(chatId, chatType);
      closeChat();
      toast.success("Chat deleted");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to delete chat");
    } finally {
      setBusyAction(null);
    }
  };

  const handleBlockUser = async () => {
    if (!selectedChatData?._id || selectedChatType !== "contact") return;

    const chatId = selectedChatData._id;

    setBusyAction("block");
    try {
      await apiClient.post(BLOCK_CHAT_ROUTE(chatId), {
        chatType: "contact",
      });
      updateChatMeta(chatId, "contact", { isBlocked: true });
      toast.success("User blocked");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to block user");
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <>
      {/* flex-shrink-0 ensures the header never collapses in the grid */}
      <div className="flex items-center gap-2 sm:gap-3 px-2 sm:px-3 md:px-4 py-2.5 sm:py-3 bg-surface-900 border-b border-surface-800 flex-shrink-0 min-h-0 min-w-0 overflow-hidden">
        {/* Back button (mobile) */}
        <button
          onClick={onBack}
          className="md:hidden p-1.5 rounded-lg hover:bg-surface-800 text-surface-400 hover:text-white transition-colors flex-shrink-0"
        >
          <IoArrowBack size={20} />
        </button>

        {/* Avatar */}
        <div
          className="cursor-pointer flex-shrink-0"
          onClick={() => setShowInfo(true)}
        >
          {isGroup ? (
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm ${
              ["bg-violet-500", "bg-blue-500", "bg-emerald-500", "bg-rose-500"][
                selectedChatData?.name?.charCodeAt(0) % 4 || 0
              ]
            }`}>
              {selectedChatData?.image ? (
                <img
                  src={`${import.meta.env.VITE_SERVER_URL}/${selectedChatData.image}`}
                  alt={selectedChatData.name}
                  className="w-full h-full object-cover rounded-full"
                />
              ) : (
                selectedChatData?.name?.[0]?.toUpperCase()
              )}
            </div>
          ) : (
            <Avatar user={selectedChatData} size="sm" showOnline />
          )}
        </div>

        {/* Name & status */}
        <div
          className="flex-1 min-w-0 cursor-pointer"
          onClick={() => setShowInfo(true)}
        >
          <h3 className="font-semibold text-white text-sm sm:text-base truncate leading-tight">{name}</h3>
          <p className={`text-xs truncate ${isTyping ? "text-nexchat-400" : "text-surface-500"}`}>
            {getSubtitle()}
          </p>
        </div>

        {/* Actions */}
        <div className="chat-header-actions flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="p-1.5 sm:p-2 rounded-xl hover:bg-surface-800 text-surface-400 hover:text-white transition-colors optional-action"
            title="Search messages"
          >
            <IoSearch size={17} />
          </button>

          {!isGroup && (
            <>
              <button
                onClick={() => handleCall("audio")}
                className="p-1.5 sm:p-2 rounded-xl hover:bg-surface-800 text-surface-400 hover:text-white transition-colors"
                title="Audio call"
              >
                <IoCall size={17} />
              </button>
              <button
                onClick={() => handleCall("video")}
                className="p-1.5 sm:p-2 rounded-xl hover:bg-surface-800 text-surface-400 hover:text-white transition-colors optional-action"
                title="Video call"
              >
                <IoVideocam size={17} />
              </button>
            </>
          )}

          <button
            onClick={() => setShowInfo(true)}
            className="p-1.5 sm:p-2 rounded-xl hover:bg-surface-800 text-surface-400 hover:text-white transition-colors"
            title="Info"
          >
            <IoInformationCircle size={17} />
          </button>

          <button
            onClick={() => setShowMenu((value) => !value)}
            className="p-1.5 sm:p-2 rounded-xl hover:bg-accent-soft text-surface-400 hover:text-white transition-colors"
            title="Chat options"
            aria-expanded={showMenu}
            aria-label="Chat options"
          >
            <IoEllipsisVertical size={17} />
          </button>
        </div>
      </div>

      <ChatOptionsMenu
        isOpen={showMenu}
        isGroup={isGroup}
        isMuted={Boolean(selectedChatData?.isMuted)}
        isBlocked={Boolean(selectedChatData?.isBlocked)}
        onClose={() => setShowMenu(false)}
        onViewProfile={handleViewProfile}
        onSearchMessages={handleSearchMessages}
        onToggleMute={handleToggleMute}
        onClearChat={openClearModal}
        onDeleteChat={handleDeleteChat}
        onBlockUser={handleBlockUser}
      />

      {showSearch && (
        <SearchMessagesPanel onClose={() => setShowSearch(false)} />
      )}

      {showInfo && (
        <ChatInfoPanel onClose={() => setShowInfo(false)} />
      )}

      <ClearChatModal
        isOpen={showClearModal}
        chatName={name}
        clearing={clearingChat}
        onCancel={() => setShowClearModal(false)}
        onConfirm={handleClearChat}
      />
    </>
  );
};

export default ChatHeader;
