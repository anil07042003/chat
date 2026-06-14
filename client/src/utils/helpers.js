import moment from "moment";
import { HOST, AVATAR_COLORS } from "./constants";

export const getAvatarColor = (index = 0) => AVATAR_COLORS[index % AVATAR_COLORS.length];

export const getInitials = (firstName, lastName) => {
  const f = firstName?.[0]?.toUpperCase() || "";
  const l = lastName?.[0]?.toUpperCase() || "";
  return f + l || "?";
};

export const getFullName = (user) => {
  if (!user) return "Unknown";
  return `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email || "Unknown";
};

export const getImageUrl = (imagePath) => {
  if (!imagePath) return null;
  if (imagePath.startsWith("http")) return imagePath;
  return `${HOST}/${imagePath}`;
};

export const formatMessageTime = (timestamp) => {
  if (!timestamp) return "";
  const m = moment(timestamp);
  const now = moment();

  if (m.isSame(now, "day")) return m.format("HH:mm");
  if (m.isSame(now.clone().subtract(1, "day"), "day")) return "Yesterday";
  if (m.isSame(now, "week")) return m.format("ddd");
  if (m.isSame(now, "year")) return m.format("MMM D");
  return m.format("MMM D, YYYY");
};

export const formatLastSeen = (lastSeen) => {
  if (!lastSeen) return "";
  const m = moment(lastSeen);
  const now = moment();
  const diff = now.diff(m, "minutes");

  if (diff < 1) return "just now";
  if (diff < 60) return `${diff}m ago`;
  if (diff < 1440) return m.format("HH:mm");
  if (m.isSame(now.clone().subtract(1, "day"), "day")) return `Yesterday ${m.format("HH:mm")}`;
  return m.format("MMM D");
};

export const formatFileSize = (bytes) => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

export const formatDuration = (seconds) => {
  if (!seconds) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
};

export const isImageFile = (mimeType, url) => {
  if (mimeType) return mimeType.startsWith("image/");
  if (url) return /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url);
  return false;
};

export const isVideoFile = (mimeType, url) => {
  if (mimeType) return mimeType.startsWith("video/");
  if (url) return /\.(mp4|webm|ogg|mov)$/i.test(url);
  return false;
};

export const isAudioFile = (mimeType, url) => {
  if (mimeType) return mimeType.startsWith("audio/");
  if (url) return /\.(mp3|wav|ogg|m4a|aac)$/i.test(url);
  return false;
};

export const getFileIcon = (mimeType, fileName) => {
  if (!mimeType && !fileName) return "📎";
  const type = mimeType || "";
  const name = fileName || "";

  if (type.startsWith("image/") || /\.(jpg|jpeg|png|gif|webp)$/i.test(name)) return "🖼️";
  if (type.startsWith("video/") || /\.(mp4|webm|mov)$/i.test(name)) return "🎥";
  if (type.startsWith("audio/") || /\.(mp3|wav|ogg)$/i.test(name)) return "🎵";
  if (type.includes("pdf") || /\.pdf$/i.test(name)) return "📄";
  if (type.includes("word") || /\.(doc|docx)$/i.test(name)) return "📝";
  if (type.includes("excel") || /\.(xls|xlsx)$/i.test(name)) return "📊";
  if (type.includes("zip") || /\.(zip|rar|7z)$/i.test(name)) return "🗜️";
  return "📎";
};

export const truncateText = (text, maxLength = 50) => {
  if (!text) return "";
  return text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
};

export const generateRoomId = (id1, id2) => {
  return [id1, id2].sort().join("-");
};

export const debounce = (fn, delay) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
};
