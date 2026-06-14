export const createChatSlice = (set, get) => ({
  // Selected chat
  selectedChatType: undefined, // "contact" | "group"
  selectedChatData: undefined,
  selectedChatMessages: [],
  selectedChatMembers: [],

  // DM contacts
  directMessagesContacts: [],

  // Groups
  groups: [],

  // Friend requests
  friendRequests: [],
  friendRequestsCount: 0,

  // Upload state
  uploadProgress: 0,
  isUploading: false,

  // Typing
  typingUsers: {}, // { chatId: [userId, ...] }

  // Unread counts
  unreadCounts: {}, // { chatId: count }

  // Call state
  activeCall: null,
  incomingCall: null,

  // UI state
  activePanel: "chats", // "chats" | "groups" | "contacts" | "requests" | "settings" | "calls"
  searchQuery: "",
  chatFilter: "all", // "all" | "dms" | "groups"

  // Setters
  setSelectedChatType: (t) => set({ selectedChatType: t }),
  setSelectedChatData: (d) => set({ selectedChatData: d }),
  setSelectedChatMessages: (m) => set({ selectedChatMessages: m }),
  setSelectedChatMembers: (m) => set({ selectedChatMembers: m }),
  setDirectMessagesContacts: (c) => set({ directMessagesContacts: c }),
  setGroups: (g) => set({ groups: g }),
  setFriendRequests: (r) => set({ friendRequests: r }),
  setFriendRequestsCount: (c) => set({ friendRequestsCount: c }),
  setUploadProgress: (p) => set({ uploadProgress: p }),
  setIsUploading: (v) => set({ isUploading: v }),
  setActivePanel: (p) => set({ activePanel: p }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setChatFilter: (f) => set({ chatFilter: f }),
  setActiveCall: (c) => set({ activeCall: c }),
  setIncomingCall: (c) => set({ incomingCall: c }),
  clearSelectedChatMessages: () => set({ selectedChatMessages: [] }),
  removeChatFromList: (chatId, chatType) => {
    const { directMessagesContacts, groups, selectedChatData } = get();
    const nextState = {};

    if (chatType === "group") {
      nextState.groups = groups.filter((group) => group._id !== chatId);
    } else {
      nextState.directMessagesContacts = directMessagesContacts.filter(
        (contact) => contact._id !== chatId
      );
    }

    if (selectedChatData?._id === chatId) {
      nextState.selectedChatType = undefined;
      nextState.selectedChatData = undefined;
      nextState.selectedChatMessages = [];
      nextState.selectedChatMembers = [];
    }

    set(nextState);
  },
  updateChatMeta: (chatId, chatType, updates) => {
    const { directMessagesContacts, groups, selectedChatData } = get();
    const nextState = {};

    if (chatType === "group") {
      nextState.groups = groups.map((group) =>
        group._id === chatId ? { ...group, ...updates } : group
      );
    } else {
      nextState.directMessagesContacts = directMessagesContacts.map((contact) =>
        contact._id === chatId ? { ...contact, ...updates } : contact
      );
    }

    if (selectedChatData?._id === chatId) {
      nextState.selectedChatData = { ...selectedChatData, ...updates };
    }

    set(nextState);
  },

  closeChat: () =>
    set({
      selectedChatType: undefined,
      selectedChatData: undefined,
      selectedChatMessages: [],
      selectedChatMembers: [],
    }),

  addMessage: (message) => {
    const { selectedChatMessages, selectedChatType } = get();
    if (selectedChatMessages.some((m) => m._id === message._id)) {
      set({
        selectedChatMessages: selectedChatMessages.map((m) =>
          m._id === message._id ? { ...m, ...message } : m
        ),
      });
      return;
    }

    const formatted = {
      ...message,
      recipient:
        selectedChatType === "group"
          ? message.recipient
          : message.recipient?._id || message.recipient,
      sender:
        selectedChatType === "group"
          ? message.sender
          : message.sender?._id || message.sender,
    };
    set({ selectedChatMessages: [...selectedChatMessages, formatted] });
  },

  updateMessage: (messageId, updates) => {
    const { selectedChatMessages } = get();
    set({
      selectedChatMessages: selectedChatMessages.map((m) =>
        m._id === messageId ? { ...m, ...updates } : m
      ),
    });
  },

  removeMessage: (messageId) => {
    const { selectedChatMessages } = get();
    set({
      selectedChatMessages: selectedChatMessages.map((m) =>
        m._id === messageId
          ? { ...m, isDeleted: true, content: null, fileUrl: null }
          : m
      ),
    });
  },

  addContactsInDMContacts: (message) => {
    const userId = get().userInfo?.id;
    if (!userId) return;

    const fromId =
      message.sender?._id === userId
        ? message.recipient?._id
        : message.sender?._id;
    const fromData =
      message.sender?._id === userId ? message.recipient : message.sender;

    const dmContacts = [...get().directMessagesContacts];
    const index = dmContacts.findIndex((c) => c._id === fromId);

    const lastMsg = {
      content: message.content,
      messageType: message.messageType,
      fileUrl: message.fileUrl,
      fileName: message.fileName,
      createdAt: message.createdAt,
    };

    if (index !== -1) {
      const existing = dmContacts.splice(index, 1)[0];
      dmContacts.unshift({ ...existing, lastMessage: lastMsg.content || lastMsg.messageType, lastMessageTime: lastMsg.createdAt });
    } else if (fromData) {
      dmContacts.unshift({ ...fromData, lastMessage: lastMsg.content || lastMsg.messageType, lastMessageTime: lastMsg.createdAt });
    }

    set({ directMessagesContacts: dmContacts });
  },

  addGroup: (group) => {
    const { groups } = get();
    if (!groups.some((g) => g._id === group._id)) {
      set({ groups: [group, ...groups] });
    }
  },

  sortGroupList: (group) => {
    const { groups } = get();
    const idx = groups.findIndex((g) => g._id === group._id);
    if (idx !== -1) {
      const updated = [...groups];
      updated.splice(idx, 1);
      updated.unshift(group);
      set({ groups: updated });
    }
  },

  setTypingUser: (chatId, userId, isTyping) => {
    const { typingUsers } = get();
    const current = typingUsers[chatId] || [];
    let updated;
    if (isTyping) {
      updated = current.includes(userId) ? current : [...current, userId];
    } else {
      updated = current.filter((id) => id !== userId);
    }
    const next = { ...typingUsers };
    if (updated.length > 0) {
      next[chatId] = updated;
    } else {
      delete next[chatId];
    }
    set({ typingUsers: next });
  },

  incrementUnread: (chatId) => {
    const { unreadCounts } = get();
    set({ unreadCounts: { ...unreadCounts, [chatId]: (unreadCounts[chatId] || 0) + 1 } });
  },

  clearUnread: (chatId) => {
    const { unreadCounts } = get();
    const updated = { ...unreadCounts };
    delete updated[chatId];
    set({ unreadCounts: updated });
  },
});
