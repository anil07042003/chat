import { useEffect, useState, useCallback } from "react";
import { useAppStore } from "../../store";
import { apiClient } from "../../lib/api-client";
import {
  GET_DM_CONTACTS_ROUTE,
  GET_USER_GROUPS_ROUTE,
  GET_FRIEND_REQUESTS_ROUTE,
} from "../../utils/constants";
import Avatar from "../ui/Avatar";
import Spinner from "../ui/Spinner";
import { getFullName, formatMessageTime, truncateText } from "../../utils/helpers";
import { IoSearch, IoAdd, IoPeople } from "react-icons/io5";
import NewChatModal from "./NewChatModal";
import CreateGroupModal from "./CreateGroupModal";

const ChatList = ({ onChatSelect }) => {
  const {
    userInfo,
    activePanel,
    directMessagesContacts,
    setDirectMessagesContacts,
    groups,
    setGroups,
    friendRequests,
    setFriendRequests,
    setFriendRequestsCount,
    selectedChatData,
    setSelectedChatData,
    setSelectedChatType,
    setSelectedChatMessages,
    clearUnread,
    unreadCounts,
    chatFilter,
    setChatFilter,
  } = useAppStore();

  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showNewChat, setShowNewChat] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);

  const loadChats = useCallback(async () => {
    setLoading(true);
    try {
      const [dmRes, groupRes] = await Promise.all([
        apiClient.get(GET_DM_CONTACTS_ROUTE),
        apiClient.get(GET_USER_GROUPS_ROUTE),
      ]);
      setDirectMessagesContacts(dmRes.data.contacts || []);
      setGroups(groupRes.data.groups || []);
    } catch (err) {
      console.error("Load chats error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadFriendRequests = useCallback(async () => {
    try {
      const res = await apiClient.get(GET_FRIEND_REQUESTS_ROUTE);
      const requests = res.data.friendRequests || [];
      setFriendRequests(requests);
      setFriendRequestsCount(requests.length);
    } catch (err) {
      console.error("Load friend requests error:", err);
    }
  }, []);

  useEffect(() => {
    if (activePanel === "chats" || activePanel === "groups" || activePanel === null) loadChats();
    if (activePanel === "requests") loadFriendRequests();
  }, [activePanel]);

  const handleSelectContact = (contact) => {
    setSelectedChatType("contact");
    setSelectedChatData(contact);
    setSelectedChatMessages([]);
    clearUnread(contact._id);
    onChatSelect?.();
  };

  const handleSelectGroup = (group) => {
    setSelectedChatType("group");
    setSelectedChatData(group);
    setSelectedChatMessages([]);
    clearUnread(group._id);
    onChatSelect?.();
  };

  const handleGroupCreated = (group) => {
    setShowCreateGroup(false);
    setChatFilter("groups");
    handleSelectGroup(group);
  };

  const filteredDMs = directMessagesContacts.filter((c) => {
    if (!searchQuery) return true;
    const name = getFullName(c).toLowerCase();
    return name.includes(searchQuery.toLowerCase()) || c.email?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const filteredGroups = groups.filter((g) => {
    if (!searchQuery) return true;
    return g.name?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const hasVisibleDMs = (chatFilter === "all" || chatFilter === "dms") && filteredDMs.length > 0;
  const hasVisibleGroups = (chatFilter === "all" || chatFilter === "groups") && filteredGroups.length > 0;

  if (activePanel === "requests") return null;
  if (activePanel === "contacts") return null;
  if (activePanel === "settings") return null;
  if (activePanel === "calls")    return null;
  // null, "chats", or "groups" renders the chats list below.

  return (
    <div className="flex flex-col h-full min-w-0 bg-surface-900">
      {/* Header */}
      <div className="p-3 sm:p-4 border-b border-surface-800 flex-shrink-0">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="text-lg font-semibold text-white">
            {chatFilter === "groups" ? "Groups" : "Messages"}
          </h2>
          <div className="flex gap-1">
            <button
              onClick={() => {
                console.log("Groups clicked");
                setChatFilter("groups");
                setShowCreateGroup(true);
              }}
              disabled={false}
              className="p-2 rounded-xl hover:bg-surface-800 text-surface-400 hover:text-white transition-colors cursor-pointer"
              title="Create group"
            >
              <IoPeople size={20} />
            </button>
            <button
              onClick={() => setShowNewChat(true)}
              disabled={false}
              className="p-2 rounded-xl hover:bg-surface-800 text-surface-400 hover:text-white transition-colors cursor-pointer"
              title="New chat"
            >
              <IoAdd size={20} />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <IoSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search chats..."
            className="w-full bg-surface-800 border border-surface-700 text-white placeholder-surface-500 rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-nexchat-500 transition-colors"
          />
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 mt-3 overflow-x-auto no-scrollbar">
          {["all", "dms", "groups"].map((f) => (
            <button
              key={f}
              onClick={() => {
                if (f === "groups") console.log("Groups clicked");
                setChatFilter(f);
              }}
              disabled={false}
              className={`flex-1 min-w-[68px] py-1.5 rounded-lg text-xs font-medium transition-all duration-200 capitalize cursor-pointer ${
                chatFilter === f
                  ? "bg-nexchat-600/20 text-nexchat-400 border border-nexchat-600/30"
                  : "text-surface-500 hover:text-surface-300"
              }`}
            >
              {f === "all" ? "All" : f === "dms" ? "DMs" : "Groups"}
            </button>
          ))}
        </div>
      </div>

      {/* Chat list */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Spinner />
          </div>
        ) : (
          <>
            {/* DMs */}
            {hasVisibleDMs && (
              <div>
                {chatFilter === "all" && (
                  <div className="px-4 py-2">
                    <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider">
                      Direct Messages
                    </span>
                  </div>
                )}
                {filteredDMs.map((contact) => (
                  <ChatListItem
                    key={contact._id}
                    item={contact}
                    type="contact"
                    isActive={selectedChatData?._id === contact._id}
                    unreadCount={unreadCounts[contact._id] || 0}
                    onClick={() => handleSelectContact(contact)}
                  />
                ))}
              </div>
            )}

            {/* Groups */}
            {hasVisibleGroups && (
              <div>
                {chatFilter === "all" && (
                  <div className="px-4 py-2 mt-1">
                    <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider">
                      Groups
                    </span>
                  </div>
                )}
                {filteredGroups.map((group) => (
                  <ChatListItem
                    key={group._id}
                    item={group}
                    type="group"
                    isActive={selectedChatData?._id === group._id}
                    unreadCount={unreadCounts[group._id] || 0}
                    onClick={() => handleSelectGroup(group)}
                  />
                ))}
              </div>
            )}

            {/* Empty state */}
            {!hasVisibleDMs && !hasVisibleGroups && (
              <div className="flex flex-col items-center justify-center h-48 text-center px-6">
                <div className="text-4xl mb-3">💬</div>
                <p className="text-surface-400 text-sm">
                  {searchQuery
                    ? chatFilter === "groups"
                      ? "No groups found"
                      : "No chats found"
                    : chatFilter === "groups"
                      ? "No groups yet"
                      : "No conversations yet"}
                </p>
                {!searchQuery && (
                  <button
                    onClick={() => {
                      if (chatFilter === "groups") {
                        console.log("Groups clicked");
                        setShowCreateGroup(true);
                      } else {
                        setShowNewChat(true);
                      }
                    }}
                    disabled={false}
                    className="mt-3 text-nexchat-400 text-sm hover:text-nexchat-300 transition-colors cursor-pointer"
                  >
                    {chatFilter === "groups" ? "Create a group" : "Start a new chat"}
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {showNewChat && <NewChatModal onClose={() => setShowNewChat(false)} onSelect={handleSelectContact} />}
      {showCreateGroup && (
        <CreateGroupModal
          onClose={() => setShowCreateGroup(false)}
          onCreated={handleGroupCreated}
        />
      )}
    </div>
  );
};

const ChatListItem = ({ item, type, isActive, unreadCount, onClick }) => {
  const isGroup = type === "group";
  const name = isGroup ? item.name : getFullName(item);
  const visibleLastMessage = getVisibleLastMessage(item);
  const time = visibleLastMessage?.createdAt || visibleLastMessage?.timestamp || null;

  const getLastMessagePreview = () => {
    if (!visibleLastMessage) return "No messages yet";
    const visible = visibleLastMessage;
    if (typeof visible === "string") return truncateText(visible, 35);
    if (visible.messageType === "text") return truncateText(visible.content, 35);
    if (visible.messageType) return getMessageTypePreview(visible);
    return truncateText(visible.content || "No messages yet", 35);

    if (isGroup && item.lastMessage) {
      const msg = item.lastMessage;
      if (msg.messageType === "text") return truncateText(msg.content, 35);
      return `📎 ${msg.messageType}`;
    }
    if (typeof item.lastMessage === "string") return truncateText(item.lastMessage, 35);
    return "";
  };

  return (
    <button
      onClick={onClick}
      className={`w-full min-w-0 flex items-center gap-2.5 sm:gap-3 px-3 sm:px-4 py-3 min-h-[68px] transition-all duration-150 hover:bg-surface-800 ${
        isActive ? "bg-nexchat-600/10 border-r-2 border-nexchat-500" : ""
      }`}
    >
      <div className="relative flex-shrink-0">
        {isGroup ? (
          <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center text-white font-semibold text-sm ${
            ["bg-violet-500", "bg-blue-500", "bg-emerald-500", "bg-rose-500"][
              item.name?.charCodeAt(0) % 4 || 0
            ]
          }`}>
            {item.image ? (
              <img src={`${import.meta.env.VITE_SERVER_URL}/${item.image}`} alt={item.name} className="w-full h-full object-cover rounded-full" />
            ) : (
              item.name?.[0]?.toUpperCase()
            )}
          </div>
        ) : (
          <Avatar user={item} size="md" showOnline />
        )}
      </div>

      <div className="flex-1 min-w-0 text-left overflow-hidden">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <span className={`font-medium text-sm truncate min-w-0 ${isActive ? "text-nexchat-300" : "text-white"}`}>
            {name}
          </span>
          {time && (
            <span className="hidden min-[380px]:inline text-[11px] text-surface-500 flex-shrink-0">
              {formatMessageTime(time)}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5 min-w-0">
          <span className="text-xs text-surface-500 truncate min-w-0">
            {getLastMessagePreview()}
          </span>
          {unreadCount > 0 && (
            <span className="badge ml-2 flex-shrink-0">{unreadCount > 99 ? "99+" : unreadCount}</span>
          )}
        </div>
      </div>
    </button>
  );
};

const getVisibleLastMessage = (item) => {
  const candidate =
    item.visibleLastMessage ??
    (typeof item.lastMessage === "object"
      ? item.lastMessage
      : item.lastMessage
        ? {
          content: item.lastMessage,
          messageType: "text",
          createdAt: item.lastMessageTime,
        }
        : null);

  if (!candidate) return null;

  const messageTime =
    candidate.createdAt ||
    candidate.timestamp ||
    item.lastMessageTime ||
    item.lastActivity ||
    item.updatedAt;

  if (
    item.clearedAt &&
    messageTime &&
    new Date(messageTime) <= new Date(item.clearedAt)
  ) {
    return null;
  }

  if (typeof candidate === "string") {
    return {
      content: candidate,
      messageType: "text",
      createdAt: messageTime,
    };
  }

  return {
    ...candidate,
    createdAt: candidate.createdAt || candidate.timestamp || messageTime,
  };
};

const getMessageTypePreview = (message) => {
  if (message.messageType === "image") return "Photo";
  if (message.messageType === "video") return "Video";
  if (message.messageType === "audio") return "Audio";
  if (message.messageType === "voice") return "Voice message";
  if (message.messageType === "file") {
    return message.fileName ? `File: ${message.fileName}` : "File";
  }
  if (message.messageType === "gif") return "GIF";
  return message.content || message.messageType || "No messages yet";
};

export default ChatList;
