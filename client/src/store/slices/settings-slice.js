export const createSettingsSlice = (set, get) => ({
  // Appearance Settings
  themeColor: localStorage.getItem("themeColor") || "blue",
  fontSize: localStorage.getItem("fontSize") || "normal",
  darkMode: localStorage.getItem("darkMode") !== "false",
  language: localStorage.getItem("language") || "en",

  // Notification Settings
  notificationsEnabled: localStorage.getItem("notificationsEnabled") !== "false",
  soundEnabled: localStorage.getItem("soundEnabled") !== "false",
  vibrationEnabled: localStorage.getItem("vibrationEnabled") !== "false",

  // Privacy Settings
  lastSeenVisible: localStorage.getItem("lastSeenVisible") !== "false",
  onlineStatusVisible: localStorage.getItem("onlineStatusVisible") !== "false",
  readReceiptsEnabled: localStorage.getItem("readReceiptsEnabled") !== "false",

  // Muted chats and blocked users
  mutedChats: JSON.parse(localStorage.getItem("mutedChats") || "[]"),
  blockedUsers: JSON.parse(localStorage.getItem("blockedUsers") || "[]"),

  // Setters
  setThemeColor: (themeColor) => {
    localStorage.setItem("themeColor", themeColor);
    set({ themeColor });
  },
  setFontSize: (fontSize) => {
    localStorage.setItem("fontSize", fontSize);
    set({ fontSize });
  },
  setDarkMode: (darkMode) => {
    localStorage.setItem("darkMode", darkMode);
    set({ darkMode });
  },
  setLanguage: (language) => {
    localStorage.setItem("language", language);
    set({ language });
  },
  setNotificationsEnabled: (notificationsEnabled) => {
    localStorage.setItem("notificationsEnabled", notificationsEnabled);
    set({ notificationsEnabled });
  },
  setSoundEnabled: (soundEnabled) => {
    localStorage.setItem("soundEnabled", soundEnabled);
    set({ soundEnabled });
  },
  setVibrationEnabled: (vibrationEnabled) => {
    localStorage.setItem("vibrationEnabled", vibrationEnabled);
    set({ vibrationEnabled });
  },
  setLastSeenVisible: (lastSeenVisible) => {
    localStorage.setItem("lastSeenVisible", lastSeenVisible);
    set({ lastSeenVisible });
  },
  setOnlineStatusVisible: (onlineStatusVisible) => {
    localStorage.setItem("onlineStatusVisible", onlineStatusVisible);
    set({ onlineStatusVisible });
  },
  setReadReceiptsEnabled: (readReceiptsEnabled) => {
    localStorage.setItem("readReceiptsEnabled", readReceiptsEnabled);
    set({ readReceiptsEnabled });
  },
  addMutedChat: (chatId) => {
    const { mutedChats } = get();
    if (!mutedChats.includes(chatId)) {
      const updated = [...mutedChats, chatId];
      localStorage.setItem("mutedChats", JSON.stringify(updated));
      set({ mutedChats: updated });
    }
  },
  removeMutedChat: (chatId) => {
    const { mutedChats } = get();
    const updated = mutedChats.filter((id) => id !== chatId);
    localStorage.setItem("mutedChats", JSON.stringify(updated));
    set({ mutedChats: updated });
  },
  addBlockedUser: (userId) => {
    const { blockedUsers } = get();
    if (!blockedUsers.includes(userId)) {
      const updated = [...blockedUsers, userId];
      localStorage.setItem("blockedUsers", JSON.stringify(updated));
      set({ blockedUsers: updated });
    }
  },
  removeBlockedUser: (userId) => {
    const { blockedUsers } = get();
    const updated = blockedUsers.filter((id) => id !== userId);
    localStorage.setItem("blockedUsers", JSON.stringify(updated));
    set({ blockedUsers: updated });
  },
});
