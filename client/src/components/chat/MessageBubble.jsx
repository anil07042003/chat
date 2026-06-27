import { useState, useRef, useEffect } from "react";
import { useAppStore } from "../../store";
import { useSocket } from "../../context/SocketContext";
import { apiClient } from "../../lib/api-client";
import {
  formatMessageTime,
  getImageUrl,
  isImageFile,
  isVideoFile,
  isAudioFile,
  formatFileSize,
  formatDuration,
  getFileIcon,
  getFullName,
} from "../../utils/helpers";
import {
  HOST,
  EDIT_MESSAGE_ROUTE,
  DELETE_MESSAGE_ROUTE,
  REACT_MESSAGE_ROUTE,
  STAR_MESSAGE_ROUTE,
} from "../../utils/constants";
import Avatar from "../ui/Avatar";
import {
  IoCheckmark,
  IoCheckmarkDone,
  IoEllipsisHorizontal,
  IoArrowUndo,
  IoArrowRedo,
  IoPencil,
  IoTrash,
  IoStar,
  IoStarOutline,
  IoDownload,
  IoCopy,
  IoPlay,
  IoPause,
} from "react-icons/io5";
import { toast } from "react-toastify";
import EmojiPicker from "emoji-picker-react";

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

const MessageBubble = ({ message, isMine, isGroup }) => {
  const {
    userInfo, selectedChatData, selectedChatType, updateMessage, removeMessage,
    directMessagesContacts, groups,
  } = useAppStore();
  const { getSocket } = useSocket();
  const [showMenu, setShowMenu] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content || "");
  const [isPlaying, setIsPlaying] = useState(false);
  const [showForwardPicker, setShowForwardPicker] = useState(false);
  const audioRef = useRef(null);
  const menuRef = useRef(null);
  const longPressTimerRef = useRef(null);
  const pointerStartRef = useRef(null);

  const mediaAutoDownload = userInfo?.chatSettings?.mediaAutoDownload !== false;
  const [mediaLoaded, setMediaLoaded] = useState(mediaAutoDownload);

  useEffect(() => {
    setMediaLoaded(mediaAutoDownload);
  }, [mediaAutoDownload, message._id]);

  useEffect(() => () => clearTimeout(longPressTimerRef.current), []);

  if (message.isDeleted) {
    return (
      <div className={`flex ${isMine ? "justify-end" : "justify-start"} mb-1`}>
        <div className="flex items-center gap-2 px-4 py-2 bg-surface-800/50 rounded-2xl border border-surface-700/50">
          <span className="text-surface-500 text-sm italic">🚫 Message deleted</span>
        </div>
      </div>
    );
  }

  const handleReaction = async (emoji) => {
    const socket = getSocket();
    if (!socket) return;

    socket.emit("messageReaction", {
      messageId: message._id,
      userId: userInfo.id,
      emoji,
      recipientId: selectedChatType === "contact" ? selectedChatData._id : undefined,
      groupId: selectedChatType === "group" ? selectedChatData._id : undefined,
    });
    setShowReactions(false);
    setShowEmojiPicker(false);
  };

  const handleEdit = async () => {
    if (!editContent.trim()) return;
    const socket = getSocket();
    if (!socket) return;

    socket.emit("editMessage", {
      messageId: message._id,
      content: editContent.trim(),
      recipientId: selectedChatType === "contact" ? selectedChatData._id : undefined,
      groupId: selectedChatType === "group" ? selectedChatData._id : undefined,
    });
    setIsEditing(false);
  };

  const handleDelete = async (deleteForEveryone) => {
    const socket = getSocket();
    if (!socket) return;

    socket.emit("deleteMessage", {
      messageId: message._id,
      deleteForEveryone,
      senderId: userInfo.id,
      recipientId: selectedChatType === "contact" ? selectedChatData._id : undefined,
      groupId: selectedChatType === "group" ? selectedChatData._id : undefined,
    });

    // Both delete modes remove the bubble for the current user immediately.
    removeMessage(message._id);
    setShowMenu(false);
  };

  const cancelLongPress = () => {
    clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
  };

  const handlePointerDown = (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    if (event.target.closest("button, a, input, textarea, video, audio")) return;
    pointerStartRef.current = { x: event.clientX, y: event.clientY };
    cancelLongPress();
    longPressTimerRef.current = setTimeout(() => {
      setShowMenu(true);
      setShowReactions(false);
      navigator.vibrate?.(35);
    }, 550);
  };

  const handlePointerMove = (event) => {
    const start = pointerStartRef.current;
    if (!start) return;
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10) {
      cancelLongPress();
    }
  };

  const handleForward = (targetId, targetType) => {
    const socket = getSocket();
    if (!socket) return;

    const forwardedMessage = {
      sender: userInfo.id,
      messageType: message.messageType,
      content: message.content,
      fileUrl: message.fileUrl,
      fileName: message.fileName,
      fileSize: message.fileSize,
      fileMimeType: message.fileMimeType,
      thumbnailUrl: message.thumbnailUrl,
      duration: message.duration,
      gifUrl: message.gifUrl,
      stickerUrl: message.stickerUrl,
      isForwarded: true,
      forwardedFrom: message.sender?._id || message.sender,
    };

    if (targetType === "group") {
      socket.emit("sendGroupMessage", { ...forwardedMessage, groupId: targetId });
    } else {
      socket.emit("sendMessage", { ...forwardedMessage, recipient: targetId });
    }

    setShowForwardPicker(false);
    setShowMenu(false);
    toast.success("Message forwarded");
  };

  const handleCopy = () => {
    if (message.content) {
      navigator.clipboard.writeText(message.content);
      toast.success("Copied to clipboard");
    }
    setShowMenu(false);
  };

  const handleStar = async () => {
    try {
      await apiClient.put(`${STAR_MESSAGE_ROUTE}/${message._id}`);
      updateMessage(message._id, {
        starredBy: message.starredBy?.includes(userInfo.id)
          ? message.starredBy.filter((id) => id !== userInfo.id)
          : [...(message.starredBy || []), userInfo.id],
      });
    } catch (err) {
      toast.error("Failed to star message");
    }
    setShowMenu(false);
  };

  const handleDownload = () => {
    if (message.fileUrl) {
      const url = `${HOST}/${message.fileUrl}`;
      const a = document.createElement("a");
      a.href = url;
      a.download = message.fileName || "file";
      a.click();
    }
    setShowMenu(false);
  };

  const toggleAudio = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const isStarred = message.starredBy?.includes(userInfo?.id);
  const myReaction = message.reactions?.find((r) => r.user === userInfo?.id || r.user?._id === userInfo?.id);

  const renderContent = () => {
    const { messageType, content, fileUrl, fileName, fileSize, fileMimeType, duration, gifUrl } = message;
    const fileFullUrl = fileUrl ? `${HOST}/${fileUrl}` : null;

    if (messageType === "text") {
      if (isEditing) {
        return (
          <div className="min-w-[200px]">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full bg-surface-700 text-white rounded-lg p-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-nexchat-500"
              rows={3}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleEdit(); }
                if (e.key === "Escape") setIsEditing(false);
              }}
            />
            <div className="flex gap-2 mt-2">
              <button onClick={handleEdit} className="text-xs bg-nexchat-600 text-white px-3 py-1 rounded-lg hover:bg-nexchat-500">Save</button>
              <button onClick={() => setIsEditing(false)} className="text-xs bg-surface-700 text-white px-3 py-1 rounded-lg hover:bg-surface-600">Cancel</button>
            </div>
          </div>
        );
      }
      return (
        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
          {content}
          {message.isEdited && (
            <span className="text-[10px] text-surface-400 ml-1">(edited)</span>
          )}
        </p>
      );
    }

    if (messageType === "image" && fileFullUrl) {      if (!mediaLoaded) {
        return (
          <div className="rounded-2xl border border-surface-700 bg-surface-800 px-4 py-6 text-center max-w-xs">
            <p className="text-sm text-surface-300 mb-3">Image loading is disabled. Tap to load.</p>
            <button
              onClick={() => setMediaLoaded(true)}
              className="text-sm bg-nexchat-600 text-white px-3 py-2 rounded-xl hover:bg-nexchat-500 transition-colors"
            >
              Load Image
            </button>
          </div>
        );
      }
      return (
        <div className="rounded-xl overflow-hidden max-w-xs cursor-pointer" onClick={() => window.open(fileFullUrl, "_blank")}>
          <img
            src={fileFullUrl}
            alt={fileName || "Image"}
            className="w-full max-h-64 object-cover"
            loading="lazy"
          />
        </div>
      );
    }

    if (messageType === "video" && fileFullUrl) {
      if (!mediaLoaded) {
        return (
          <div className="rounded-2xl border border-surface-700 bg-surface-800 px-4 py-6 text-center max-w-xs">
            <p className="text-sm text-surface-300 mb-3">Video download is disabled. Tap to load.</p>
            <button
              onClick={() => setMediaLoaded(true)}
              className="text-sm bg-nexchat-600 text-white px-3 py-2 rounded-xl hover:bg-nexchat-500 transition-colors"
            >
              Load Video
            </button>
          </div>
        );
      }
      return (
        <div className="rounded-xl overflow-hidden max-w-xs">
          <video
            src={fileFullUrl}
            controls
            className="w-full max-h-64"
            preload="metadata"
          />
        </div>
      );
    }

    if ((messageType === "audio" || messageType === "voice") && fileFullUrl) {
      if (!mediaLoaded) {
        return (
          <div className="rounded-2xl border border-surface-700 bg-surface-800 px-4 py-6 text-center max-w-xs">
            <p className="text-sm text-surface-300 mb-3">Audio download is disabled. Tap to load.</p>
            <button
              onClick={() => setMediaLoaded(true)}
              className="text-sm bg-nexchat-600 text-white px-3 py-2 rounded-xl hover:bg-nexchat-500 transition-colors"
            >
              Load Audio
            </button>
          </div>
        );
      }
      return (
        <div className="flex items-center gap-3 w-full min-w-[160px] max-w-[240px]">
          <button
            onClick={toggleAudio}
            className="w-10 h-10 rounded-full bg-nexchat-600/30 flex items-center justify-center hover:bg-nexchat-600/50 transition-colors flex-shrink-0"
          >
            {isPlaying ? <IoPause size={18} /> : <IoPlay size={18} />}
          </button>
          <div className="flex-1 min-w-0">
            <div className="h-1 bg-surface-600 rounded-full">
              <div className="h-full bg-nexchat-500 rounded-full w-0" />
            </div>
            {duration && (
              <span className="text-xs text-surface-400 mt-1">{formatDuration(duration)}</span>
            )}
          </div>
          <audio
            ref={audioRef}
            src={fileFullUrl}
            onEnded={() => setIsPlaying(false)}
            className="hidden"
          />
        </div>
      );
    }

    if (messageType === "gif" && gifUrl) {
      if (!mediaLoaded) {
        return (
          <div className="rounded-2xl border border-surface-700 bg-surface-800 px-4 py-6 text-center max-w-xs">
            <p className="text-sm text-surface-300 mb-3">GIF loading is disabled. Tap to load.</p>
            <button
              onClick={() => setMediaLoaded(true)}
              className="text-sm bg-nexchat-600 text-white px-3 py-2 rounded-xl hover:bg-nexchat-500 transition-colors"
            >
              Load GIF
            </button>
          </div>
        );
      }
      return (
        <div className="rounded-xl overflow-hidden max-w-xs">
          <img src={gifUrl} alt="GIF" className="w-full max-h-48 object-cover" />
        </div>
      );
    }

    if (messageType === "file" && fileFullUrl) {
      if (!mediaLoaded) {
        return (
          <div className="rounded-2xl border border-surface-700 bg-surface-800 px-4 py-6 text-center max-w-xs">
            <p className="text-sm text-surface-300 mb-3">File download is disabled. Tap to load.</p>
            <button
              onClick={() => setMediaLoaded(true)}
              className="text-sm bg-nexchat-600 text-white px-3 py-2 rounded-xl hover:bg-nexchat-500 transition-colors"
            >
              Load File
            </button>
          </div>
        );
      }
      return (
        <div className="flex items-center gap-3 w-full min-w-[160px] max-w-[260px]">
          <div className="w-10 h-10 rounded-xl bg-surface-700 flex items-center justify-center text-xl flex-shrink-0">
            {getFileIcon(fileMimeType, fileName)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{fileName || "File"}</p>
            {fileSize && <p className="text-xs text-surface-400">{formatFileSize(fileSize)}</p>}
          </div>
          <button
            onClick={handleDownload}
            className="p-1.5 rounded-lg hover:bg-surface-700 text-surface-400 hover:text-white transition-colors flex-shrink-0"
          >
            <IoDownload size={16} />
          </button>
        </div>
      );
    }

    return <p className="text-sm text-surface-400 italic">Unsupported message type</p>;
  };

  const renderStatus = () => {
    if (!isMine) return null;

    const recipientId = message.recipient?._id || message.recipient || selectedChatData?._id;
    const seenBy = (message.seenBy || []).map((id) => id?._id || id);
    const deliveredTo = (message.deliveredTo || []).map((id) => id?._id || id);
    const status =
      message.status === "seen" || seenBy.includes(recipientId)
        ? "seen"
        : message.status === "delivered" || deliveredTo.includes(recipientId)
          ? "delivered"
          : "sent";

    const config = {
      sent: {
        label: "Sent",
        Icon: IoCheckmark,
        className: "text-gray-300/95",
      },
      delivered: {
        label: "Delivered",
        Icon: IoCheckmarkDone,
        className: "text-gray-200",
      },
      seen: {
        label: "Seen",
        Icon: IoCheckmarkDone,
        className: "text-[#60A5FA] drop-shadow-[0_0_6px_rgba(96,165,250,0.75)]",
      },
    }[status];

    const StatusIcon = config.Icon;

    return (
      <span
        className="relative inline-flex h-[18px] w-[18px] items-center justify-center align-middle leading-none group/status"
        title={config.label}
        aria-label={config.label}
      >
        <StatusIcon
          size={17}
          strokeWidth={2.6}
          className={`${config.className} drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)] transition-colors duration-150`}
          aria-hidden="true"
        />
        <span className="pointer-events-none absolute bottom-full right-0 z-30 mb-1.5 whitespace-nowrap rounded-md border border-surface-700 bg-surface-950/95 px-2 py-1 text-[10px] font-medium text-gray-100 opacity-0 shadow-xl shadow-black/30 transition-opacity duration-150 group-hover/status:opacity-100">
          {config.label}
        </span>
      </span>
    );
  };

  const reactionGroups = message.reactions?.reduce((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] || 0) + 1;
    return acc;
  }, {});

  return (
    <div
      className={`flex ${isMine ? "justify-end" : "justify-start"} mb-1 group message-enter`}
      onMouseLeave={() => { setShowMenu(false); setShowReactions(false); }}
    >
      {/* Avatar for group messages */}
      {isGroup && !isMine && (
        <div className="mr-2 mt-auto mb-1 flex-shrink-0">
          <Avatar user={message.sender} size="xs" />
        </div>
      )}

      <div className={`flex flex-col ${isMine ? "items-end" : "items-start"} max-w-[82%] sm:max-w-[75%] md:max-w-[70%]`}>
        {/* Sender name in group */}
        {isGroup && !isMine && message.sender && (
          <span className="text-xs text-nexchat-400 font-medium mb-1 ml-1">
            {getFullName(message.sender)}
          </span>
        )}

        {/* Reply preview */}
        {message.replyTo && (
          <div className={`mb-1 px-3 py-1.5 rounded-xl border-l-2 border-nexchat-500 bg-surface-800/50 max-w-full ${isMine ? "mr-0" : "ml-0"}`}>
            <p className="text-xs text-nexchat-400 font-medium">
              {message.replyTo.sender?.firstName || "Reply"}
            </p>
            <p className="text-xs text-surface-400 truncate">
              {message.replyTo.content || message.replyTo.messageType}
            </p>
          </div>
        )}

        {/* Message bubble */}
        <div
          className="relative select-none"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={cancelLongPress}
          onPointerCancel={cancelLongPress}
          onContextMenu={(event) => { event.preventDefault(); setShowMenu(true); }}
        >
          {/* Hover actions — hidden on touch/small screens, shown on hover for pointer devices */}
          <div
            className={`absolute top-1/2 -translate-y-1/2 ${isMine ? "-left-10 sm:-left-16" : "-right-10 sm:-right-16"} flex gap-1 z-10 opacity-100 pointer-events-auto sm:opacity-0 sm:pointer-events-none sm:group-hover:opacity-100 sm:group-hover:pointer-events-auto transition-opacity`}
          >
            <button
              onClick={() => setShowReactions(!showReactions)}
              className="hidden sm:block p-1.5 rounded-lg bg-surface-800 hover:bg-surface-700 text-surface-400 hover:text-white transition-colors text-sm"
              title="React"
            >
              😊
            </button>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1.5 rounded-lg bg-surface-800 hover:bg-surface-700 text-surface-400 hover:text-white transition-colors"
              title="More"
            >
              <IoEllipsisHorizontal size={14} />
            </button>
          </div>

          {/* Quick reactions */}
          {showReactions && (
            <div
              className={`absolute ${isMine ? "right-0" : "left-0"} -top-12 bg-surface-800 border border-surface-700 rounded-2xl px-2 py-1.5 flex gap-1 z-20 shadow-xl`}
            >
              {QUICK_REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleReaction(emoji)}
                  className={`text-lg hover:scale-125 transition-transform ${myReaction?.emoji === emoji ? "opacity-100" : "opacity-70 hover:opacity-100"}`}
                >
                  {emoji}
                </button>
              ))}
              <button
                onClick={() => { setShowEmojiPicker(true); setShowReactions(false); }}
                className="text-surface-400 hover:text-white text-sm px-1"
              >
                +
              </button>
            </div>
          )}

          {/* Context menu */}
          {showMenu && (
            <div
              className={`absolute ${isMine ? "right-0" : "left-0"} top-full mt-1 bg-surface-800 border border-surface-700 rounded-xl shadow-xl z-20 min-w-[160px] max-w-[200px] overflow-hidden`}
            >
              <button onClick={() => { setShowReactions(true); setShowMenu(false); }} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-white hover:bg-surface-700 transition-colors">
                <span aria-hidden="true">☺</span> React
              </button>
              {message.messageType === "text" && (
                <button onClick={handleCopy} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-white hover:bg-surface-700 transition-colors">
                  <IoCopy size={14} /> Copy
                </button>
              )}
              <button onClick={handleStar} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-white hover:bg-surface-700 transition-colors">
                {isStarred ? <IoStar size={14} className="text-amber-400" /> : <IoStarOutline size={14} />}
                {isStarred ? "Unstar" : "Star"}
              </button>
              {isMine && message.messageType === "text" && (
                <button onClick={() => { setIsEditing(true); setShowMenu(false); }} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-white hover:bg-surface-700 transition-colors">
                  <IoPencil size={14} /> Edit
                </button>
              )}
              {(message.fileUrl) && (
                <button onClick={handleDownload} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-white hover:bg-surface-700 transition-colors">
                  <IoDownload size={14} /> Download
                </button>
              )}
              <div className="h-px bg-surface-700 my-1" />
              <button onClick={() => handleDelete(false)} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-rose-400 hover:bg-surface-700 transition-colors">
                <IoTrash size={14} /> Delete for me
              </button>
              <button onClick={() => { setShowForwardPicker(true); setShowMenu(false); }} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-white hover:bg-surface-700 transition-colors">
                <IoArrowRedo size={14} /> Forward
              </button>
              {isMine && (
                  <button onClick={() => handleDelete(true)} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-rose-400 hover:bg-surface-700 transition-colors">
                    <IoTrash size={14} /> Delete for everyone
                  </button>
              )}
            </div>
          )}

          <div
            className={`${
              isMine ? "chat-bubble-sent" : "chat-bubble-received"
            } relative`}
          >
            {renderContent()}

            {/* Time & status */}
            <div className={`mt-1 flex items-center ${isMine ? "justify-end gap-1.5" : "justify-start"}`}>
              <span className="message-time leading-none">
                {formatMessageTime(message.createdAt || message.timestamp)}
              </span>
              {renderStatus()}
            </div>
          </div>

          {/* Reactions display */}
          {reactionGroups && Object.keys(reactionGroups).length > 0 && (
            <div className={`flex gap-1 mt-1 flex-wrap ${isMine ? "justify-end" : "justify-start"}`}>
              {Object.entries(reactionGroups).map(([emoji, count]) => (
                <button
                  key={emoji}
                  onClick={() => handleReaction(emoji)}
                  className={`flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs border transition-colors ${
                    myReaction?.emoji === emoji
                      ? "bg-nexchat-600/30 border-nexchat-500/50 text-nexchat-300"
                      : "bg-surface-800 border-surface-700 text-surface-300 hover:bg-surface-700"
                  }`}
                >
                  <span>{emoji}</span>
                  {count > 1 && <span>{count}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Full emoji picker */}
      {showEmojiPicker && (
        <div
          className={`fixed z-50 bottom-24`}
          style={{
            left: isMine ? "auto" : "8px",
            right: isMine ? "8px" : "auto",
          }}
        >
          <EmojiPicker
            onEmojiClick={(e) => { handleReaction(e.emoji); setShowEmojiPicker(false); }}
            theme="dark"
            height={300}
            width={Math.min(280, window.innerWidth - 16)}
          />
        </div>
      )}

      {showForwardPicker && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-3 sm:items-center" onClick={() => setShowForwardPicker(false)}>
          <div className="max-h-[70vh] w-full max-w-sm overflow-hidden rounded-2xl border border-surface-700 bg-surface-900 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-surface-700 px-4 py-3">
              <h3 className="font-semibold text-white">Forward message</h3>
              <button onClick={() => setShowForwardPicker(false)} className="rounded-lg px-2 py-1 text-surface-400 hover:bg-surface-800 hover:text-white">✕</button>
            </div>
            <div className="max-h-[55vh] overflow-y-auto p-2">
              {[...(directMessagesContacts || []).map((contact) => ({ ...contact, targetType: "contact", label: getFullName(contact) })),
                ...(groups || []).map((group) => ({ ...group, targetType: "group", label: group.name }))]
                .filter((target) => target._id)
                .map((target) => (
                  <button key={`${target.targetType}-${target._id}`} onClick={() => handleForward(target._id, target.targetType)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-white hover:bg-surface-800">
                    <Avatar user={target} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{target.label || target.email || "Chat"}</span>
                    <span className="text-xs capitalize text-surface-500">{target.targetType}</span>
                  </button>
                ))}
              {!(directMessagesContacts?.length || groups?.length) && (
                <p className="p-6 text-center text-sm text-surface-400">No chats available</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MessageBubble;
