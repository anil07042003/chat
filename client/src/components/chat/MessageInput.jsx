import { useState, useRef, useEffect, useCallback } from "react";
import { useAppStore } from "../../store";
import { useSocket } from "../../context/SocketContext";
import { apiClient } from "../../lib/api-client";
import { UPLOAD_FILE_ROUTE } from "../../utils/constants";
import { debounce } from "../../utils/helpers";
import {
  IoSend, IoAttach, IoHappy, IoMic, IoClose,
  IoImage, IoDocument, IoMusicalNote, IoVideocam,
} from "react-icons/io5";
import EmojiPicker from "emoji-picker-react";
import { toast } from "react-toastify";

const MAX_TEXTAREA_HEIGHT = 120;

const getThemeColors = () => {
  const theme = document.documentElement.getAttribute("data-theme") || "dark";
  if (theme === "light") {
    return { bg: "#e4e4e7", bgFocus: "#ffffff", text: "#09090b", placeholder: "#71717a", border: "#d4d4d8" };
  }
  return { bg: "#27272a", bgFocus: "#27272a", text: "#ffffff", placeholder: "#71717a", border: "#3f3f46" };
};

// â”€â”€ Portal-based popup â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Renders children in a fixed-position container anchored to a trigger element.
// This escapes ALL overflow:hidden parents â€” the only reliable solution when
// the chat grid clips absolute-positioned children.
const AnchoredPopup = ({ anchorRef, open, children, align = "left" }) => {
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!open || !anchorRef.current) return;

    const update = () => {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (!rect) return;

      const vw = window.innerWidth;
      const vh = window.innerHeight;

      // Position above the anchor button
      let top  = rect.top - 8;   // 8px gap above the button
      let left = align === "left" ? rect.left : rect.right;

      // Clamp so popup never goes off-screen (will be adjusted by transform below)
      setPos({ top, left, rectBottom: rect.bottom, rectLeft: rect.left, rectRight: rect.right, vw, vh });
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, anchorRef, align]);

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        // Anchor to bottom of popup = top of anchor button
        bottom: pos.vh ? pos.vh - pos.top : 0,
        left: align === "left" ? pos.rectLeft : undefined,
        right: align === "right" ? (pos.vw ? pos.vw - pos.rectRight : 0) : undefined,
        zIndex: 9999,
        // Ensure popup doesn't go off left edge
        maxWidth: `calc(100vw - 16px)`,
      }}
    >
      {children}
    </div>
  );
};

const MessageInput = () => {
  const {
    selectedChatData, selectedChatType, userInfo,
    isUploading, setIsUploading, uploadProgress, setUploadProgress,
  } = useAppStore();

  const { getSocket } = useSocket();
  const [message, setMessage]         = useState("");
  const [showEmoji, setShowEmoji]     = useState(false);
  const [showAttach, setShowAttach]   = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [replyTo, setReplyTo]         = useState(null);
  const [emojiPickerWidth, setEmojiPickerWidth] = useState(300);

  const inputRef         = useRef(null);
  const emojiButtonRef   = useRef(null);
  const attachButtonRef  = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const audioChunksRef   = useRef([]);
  const typingTimeoutRef = useRef(null);

  // Responsive emoji picker width
  useEffect(() => {
    const calc = () => setEmojiPickerWidth(Math.min(300, window.innerWidth - 24));
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, []);

  const resizeTextarea = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT) + "px";
  }, []);

  useEffect(() => { resizeTextarea(); }, [message]);

  useEffect(() => {
    inputRef.current?.focus();
    if (inputRef.current) inputRef.current.style.height = "auto";
    setMessage("");
    setReplyTo(null);
    setShowEmoji(false);
    setShowAttach(false);
  }, [selectedChatData?._id]);

  const sendTypingStatus = useCallback(
    (isTyping, force = false) => {
      const privacySettings = useAppStore.getState().userInfo?.privacySettings;
      if (!force && isTyping && privacySettings?.typingIndicatorEnabled === false) return;
      const socket = getSocket();
      if (!socket) return;
      socket.emit("typing", {
        sender: userInfo?.id,
        recipient: selectedChatType === "contact" ? selectedChatData?._id : undefined,
        groupId:   selectedChatType === "group"   ? selectedChatData?._id : undefined,
        isTyping,
      });
    },
    [selectedChatData, selectedChatType, getSocket, userInfo]
  );

  const emitTyping = useCallback(
    debounce((isTyping, force = false) => { sendTypingStatus(isTyping, force); }, 300),
    [sendTypingStatus]
  );

  const handleInputChange = (e) => {
    setMessage(e.target.value);
    emitTyping(true);
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => emitTyping(false, true), 2000);
  };

  const sendTextMessage = () => {
    if (!message.trim()) return;
    const socket = getSocket();
    if (!socket) return;
    const msgData = { sender: userInfo.id, messageType: "text", content: message.trim(), replyTo: replyTo?._id };
    if (selectedChatType === "contact") socket.emit("sendMessage", { ...msgData, recipient: selectedChatData._id });
    else socket.emit("sendGroupMessage", { ...msgData, groupId: selectedChatData._id });
    setMessage("");
    setReplyTo(null);
    emitTyping(false);
    if (inputRef.current) inputRef.current.style.height = "auto";
    inputRef.current?.focus();
  };

  useEffect(() => {
    if (userInfo?.privacySettings?.typingIndicatorEnabled === false) {
      clearTimeout(typingTimeoutRef.current);
      sendTypingStatus(false, true);
    }
  }, [userInfo?.privacySettings?.typingIndicatorEnabled, selectedChatData?._id, selectedChatType, sendTypingStatus]);

  useEffect(() => {
    return () => { clearTimeout(typingTimeoutRef.current); sendTypingStatus(false, true); };
  }, [selectedChatData?._id, selectedChatType, sendTypingStatus]);

  const handleKeyDown = (e) => {
    const enterToSend = userInfo?.chatSettings?.enterToSend !== false;
    if (e.key === "Enter" && !e.shiftKey && enterToSend) { e.preventDefault(); sendTextMessage(); }
  };

  const handleBlur = () => { clearTimeout(typingTimeoutRef.current); emitTyping(false, true); };

  const handleFileUpload = async (file, messageType) => {
    if (!file) return;
    if (file.size > 100 * 1024 * 1024) { toast.error("File size exceeds 100MB limit"); return; }
    setIsUploading(true);
    setUploadProgress(0);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await apiClient.post(UPLOAD_FILE_ROUTE, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (e) => setUploadProgress(Math.round((e.loaded * 100) / e.total)),
      });
      const socket = getSocket();
      if (!socket) return;
      const msgData = { sender: userInfo.id, messageType, fileUrl: res.data.fileUrl, fileName: res.data.fileName, fileSize: res.data.fileSize, fileMimeType: res.data.fileMimeType, replyTo: replyTo?._id };
      if (selectedChatType === "contact") socket.emit("sendMessage", { ...msgData, recipient: selectedChatData._id });
      else socket.emit("sendGroupMessage", { ...msgData, groupId: selectedChatData._id });
      setReplyTo(null);
      toast.success("File sent!");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to upload file");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleFileSelect = (e, type) => {
    const file = e.target.files?.[0];
    if (!file) return;
    let messageType = type;
    if (!messageType) {
      if (file.type.startsWith("image/")) messageType = "image";
      else if (file.type.startsWith("video/")) messageType = "video";
      else if (file.type.startsWith("audio/")) messageType = "audio";
      else messageType = "file";
    }
    handleFileUpload(file, messageType);
    e.target.value = "";
    setShowAttach(false);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      mediaRecorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: "audio/webm" });
        stream.getTracks().forEach((t) => t.stop());
        await handleFileUpload(file, "voice");
      };
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
    } catch { toast.error("Microphone access denied"); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(recordingTimerRef.current);
      setRecordingTime(0);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(recordingTimerRef.current);
      setRecordingTime(0);
    }
  };

  const fmtTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
  const colors = getThemeColors();
  const isBlockedChat = selectedChatType === "contact" && selectedChatData?.isBlocked;

  if (isBlockedChat) {
    return (
      <div className="border-t theme-border app-bg px-4 py-3 text-center">
        <p className="text-sm font-medium theme-text-secondary">You blocked this user</p>
        <p className="mt-1 text-xs theme-text-muted">Unblock them from settings to send messages again.</p>
      </div>
    );
  }

  return (
    <div
      className="bg-surface-900 border-t border-surface-800 px-2 py-2 sm:px-3 sm:py-2 md:px-4 md:py-3"
      style={{ maxWidth: "100%" }}
    >
      {/* Reply preview */}
      {replyTo && (
        <div className="flex items-center gap-2 mb-2 px-2 sm:px-3 py-2 bg-surface-800 rounded-xl border-l-2 border-nexchat-500">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-nexchat-400 font-medium truncate">Replying to {replyTo.sender?.firstName || "message"}</p>
            <p className="text-xs text-surface-400 truncate">{replyTo.content || replyTo.messageType}</p>
          </div>
          <button onClick={() => setReplyTo(null)} className="text-surface-500 hover:text-white flex-shrink-0 p-1">
            <IoClose size={14} />
          </button>
        </div>
      )}

      {/* Upload progress */}
      {isUploading && (
        <div className="mb-2">
          <div className="flex items-center justify-between text-xs text-surface-400 mb-1">
            <span>Uploading...</span><span>{uploadProgress}%</span>
          </div>
          <div className="h-1 bg-surface-700 rounded-full overflow-hidden">
            <div className="h-full bg-nexchat-500 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
          </div>
        </div>
      )}

      {/* Recording UI */}
      {isRecording ? (
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button onClick={cancelRecording} className="p-2 rounded-xl bg-surface-800 text-rose-400 hover:bg-surface-700 flex-shrink-0">
            <IoClose size={18} />
          </button>
          <div className="flex-1 flex items-center gap-2 min-w-0">
            <div className="w-2 h-2 bg-rose-500 rounded-full animate-pulse flex-shrink-0" />
            <span className="text-white font-mono text-sm">{fmtTime(recordingTime)}</span>
            <span className="text-surface-400 text-xs truncate hidden sm:block">Recording...</span>
          </div>
          <button onClick={stopRecording} className="p-2 sm:p-2.5 rounded-xl bg-nexchat-600 text-white hover:bg-nexchat-500 transition-colors flex-shrink-0">
            <IoSend size={16} />
          </button>
        </div>
      ) : (
        <div className="flex items-end gap-1 sm:gap-1.5">

          {/* â”€â”€ Emoji button + fixed-position picker â”€â”€ */}
          <div className="relative flex-shrink-0">
            <button
              ref={emojiButtonRef}
              onClick={() => { setShowEmoji(!showEmoji); setShowAttach(false); }}
              className="p-2 rounded-xl hover:bg-surface-800 text-surface-400 hover:text-white transition-colors"
              aria-label="Emoji"
            >
              <IoHappy size={19} />
            </button>

            {/* Emoji picker â€” fixed position to escape overflow:hidden parents */}
            <AnchoredPopup anchorRef={emojiButtonRef} open={showEmoji} align="left">
              <div className="animate-slide-up">
                <EmojiPicker
                  onEmojiClick={(e) => {
                    setMessage((prev) => prev + e.emoji);
                    inputRef.current?.focus();
                  }}
                  theme={document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark"}
                  height={320}
                  width={emojiPickerWidth}
                  lazyLoadEmojis
                />
              </div>
            </AnchoredPopup>
          </div>

          {/* â”€â”€ Attach button + fixed-position menu â”€â”€ */}
          <div className="relative flex-shrink-0">
            <button
              ref={attachButtonRef}
              onClick={() => { setShowAttach(!showAttach); setShowEmoji(false); }}
              className="p-2 rounded-xl hover:bg-surface-800 text-surface-400 hover:text-white transition-colors"
              aria-label="Attach file"
            >
              <IoAttach size={19} />
            </button>

            {/* Attach menu â€” fixed position to escape overflow:hidden parents */}
            <AnchoredPopup anchorRef={attachButtonRef} open={showAttach} align="left">
              <div className="bg-surface-800 border border-surface-700 rounded-2xl p-1.5 shadow-2xl min-w-[140px] animate-slide-up">
                {[
                  { icon: IoImage,       label: "Image",    accept: "image/*",  type: "image"  },
                  { icon: IoVideocam,    label: "Video",    accept: "video/*",  type: "video"  },
                  { icon: IoMusicalNote, label: "Audio",    accept: "audio/*",  type: "audio"  },
                  { icon: IoDocument,   label: "Document", accept: "*/*",      type: "file"   },
                ].map(({ icon: Icon, label, accept, type }) => (
                  <label
                    key={type}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-surface-700 cursor-pointer transition-colors"
                  >
                    <Icon size={17} className="text-nexchat-400 flex-shrink-0" />
                    <span className="text-sm text-white whitespace-nowrap">{label}</span>
                    <input type="file" accept={accept} className="hidden" onChange={(e) => handleFileSelect(e, type)} />
                  </label>
                ))}
              </div>
            </AnchoredPopup>
          </div>

          {/* Text input */}
          <div className="flex-1 min-w-0">
            <textarea
              ref={inputRef}
              value={message}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onBlur={handleBlur}
              placeholder="Type a message..."
              rows={1}
              className="msg-input w-full border border-surface-700 rounded-2xl px-3 py-2.5 focus:outline-none focus:border-nexchat-500 resize-none block"
              style={{
                maxHeight: `${MAX_TEXTAREA_HEIGHT}px`,
                overflowY: "auto",
                backgroundColor: colors.bg,
                color: colors.text,
                caretColor: colors.text,
              }}
            />
          </div>

          {/* Send / Mic */}
          {message.trim() ? (
            <button
              onClick={sendTextMessage}
              className="p-2 sm:p-2.5 rounded-xl bg-nexchat-600 text-white hover:bg-nexchat-500 transition-all duration-200 active:scale-95 flex-shrink-0"
              aria-label="Send message"
            >
              <IoSend size={17} />
            </button>
          ) : (
            <button
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onTouchStart={startRecording}
              onTouchEnd={stopRecording}
              className="p-2 sm:p-2.5 rounded-xl hover:bg-surface-800 text-surface-400 hover:text-white transition-colors flex-shrink-0"
              aria-label="Hold to record voice message"
            >
              <IoMic size={19} />
            </button>
          )}
        </div>
      )}

      {/* Backdrop â€” closes popups when clicking outside */}
      {(showEmoji || showAttach) && (
        <div
          className="fixed inset-0"
          style={{ zIndex: 9998 }}
          onClick={() => { setShowEmoji(false); setShowAttach(false); }}
        />
      )}
    </div>
  );
};

export default MessageInput;
