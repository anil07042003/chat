import { useAppStore } from "../../store";
import { useNavigate } from "react-router-dom";
import Avatar from "../ui/Avatar";
import {
  IoChatbubbles,
  IoPeople,
  IoPersonAdd,
  IoSettings,
  IoCall,
  IoChatbubblesOutline,
  IoPeopleOutline,
  IoPersonAddOutline,
  IoSettingsOutline,
  IoCallOutline,
} from "react-icons/io5";

const NAV_ITEMS = [
  { id: "chats",    icon: IoChatbubblesOutline, activeIcon: IoChatbubbles,  label: "Chats"    },
  { id: "groups",   icon: IoPeopleOutline,       activeIcon: IoPeople,       label: "Groups"   },
  { id: "contacts", icon: IoPeopleOutline,       activeIcon: IoPeople,       label: "Contacts" },
  { id: "requests", icon: IoPersonAddOutline,    activeIcon: IoPersonAdd,    label: "Requests" },
  { id: "calls",    icon: IoCallOutline,          activeIcon: IoCall,         label: "Calls"    },
  { id: "settings", icon: IoSettingsOutline,      activeIcon: IoSettings,     label: "Settings" },
];

const Sidebar = () => {
  const navigate = useNavigate();
  const {
    userInfo,
    activePanel,
    setActivePanel,
    friendRequestsCount,
    selectedChatData,
    setChatFilter,
  } = useAppStore();

  // Compact when a chat is open — shrinks from w-14 to w-12
  const isCompact = !!selectedChatData;

  const handleNavClick = (id) => {
    if (id === "groups") {
      console.log("Groups clicked");
      setActivePanel("groups");
      setChatFilter("groups");
      navigate("/groups");
      return;
    }

    if (id === "chats") {
      setChatFilter("all");
      navigate("/chat");
    }

    setActivePanel(activePanel === id ? null : id);
  };

  // Open settings to profile section
  const handleAvatarClick = () => {
    setActivePanel(activePanel === "settings" ? null : "settings");
    // Store that we want to open profile section
    if (activePanel !== "settings") {
      localStorage.setItem("openSettingsToProfile", "true");
    }
  };

  return (
    <div
      className={`
        mobile-bottom-nav flex flex-row sm:flex-col items-center theme-panel border-t sm:border-t-0 sm:border-r theme-border
        px-1 py-1.5 sm:px-0 sm:py-3 gap-1 flex-shrink-0
        h-14 sm:h-full w-full sm:w-auto
        transition-all duration-300 ease-in-out
        ${isCompact ? "sm:w-12" : "sm:w-16"}
      `}
    >
      {/* Logo — BaatChit brand image */}
      <div
        className={`
          rounded-xl overflow-hidden hidden sm:flex items-center justify-center mb-2 flex-shrink-0
          transition-all duration-300 theme-card
          ${isCompact ? "w-8 h-8" : "w-9 h-9 sm:w-10 sm:h-10"}
        `}
      >
        <img
          src="/baatchit-icon.svg"
          alt="BaatChit"
          className="w-full h-full object-cover"
        />
      </div>

      {/* Nav items */}
      <nav className="flex flex-row sm:flex-col gap-0.5 flex-1 w-full px-1 min-w-0">
        {NAV_ITEMS.map(({ id, icon: Icon, activeIcon: ActiveIcon, label }) => {
          const isActive  = activePanel === id;
          const showBadge = id === "requests" && friendRequestsCount > 0;

          return (
            <button
              key={id}
              onClick={() => handleNavClick(id)}
              title={label}
              aria-label={label}
              disabled={false}
              className={`
                relative flex-1 sm:flex-none sm:w-full h-11 sm:h-auto sm:aspect-square rounded-xl flex items-center justify-center
                transition-all duration-200 group touch-compact cursor-pointer
                ${isActive
                  ? "bg-nexchat-600/20 text-nexchat-400"
                  : "text-surface-500 hover:bg-surface-800 hover:text-surface-300"
                }
              `}
            >
              {isActive
                ? <ActiveIcon size={isCompact ? 17 : 20} />
                : <Icon      size={isCompact ? 17 : 20} />
              }

              {showBadge && (
                <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 bg-rose-500 rounded-full text-[8px] font-bold text-white flex items-center justify-center leading-none">
                  {friendRequestsCount > 9 ? "9+" : friendRequestsCount}
                </span>
              )}

              {/* Tooltip — only on pointer devices */}
              <span className="absolute left-full ml-2 bg-surface-800 text-white text-xs px-2 py-1 rounded-lg whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-lg hidden sm:block">
                {label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* User avatar — dot reflects the user's own online status visibility setting */}
      <div className="ml-1 sm:ml-0 sm:mt-auto sm:pt-1 flex-shrink-0">
        <Avatar
          user={{
            ...userInfo,
            // Show green dot only if the user has online status visible enabled.
            // If they turned it off, show grey dot (appears offline to others too).
            isOnline: userInfo?.privacySettings?.onlineStatusVisible !== false
              ? (userInfo?.isOnline ?? true)
              : false,
          }}
          size={isCompact ? "xs" : "sm"}
          showOnline
          onClick={handleAvatarClick}
          className="cursor-pointer hover:ring-2 hover:ring-nexchat-500 rounded-full transition-all"
        />
      </div>
    </div>
  );
};

export default Sidebar;
