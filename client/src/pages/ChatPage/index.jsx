import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAppStore } from "../../store";
import Sidebar from "../../components/chat/Sidebar";
import ChatList from "../../components/chat/ChatList";
import ChatWindow from "../../components/chat/ChatWindow";
import EmptyChat from "../../components/chat/EmptyChat";
import IncomingCallModal from "../../components/call/IncomingCallModal";
import CallModal from "../../components/call/CallModal";
import SettingsPanel from "../../components/chat/SettingsPanel";
import ContactsPanel from "../../components/chat/ContactsPanel";
import CallHistoryPanel from "../../components/chat/CallHistoryPanel";
import FriendRequestsPanel from "../../components/chat/FriendRequestsPanel";

// Panels that replace the full content area (sidebar + chat columns)
const FULL_WIDTH_PANELS = ["settings", "contacts", "calls", "requests"];

const ChatPage = () => {
  const {
    userInfo,
    selectedChatData,
    incomingCall,
    activeCall,
    activePanel,
    setActivePanel,
    setChatFilter,
  } = useAppStore();
  const navigate = useNavigate();
  const location = useLocation();

  // "list" = show chat list column, "chat" = show chat window (mobile only)
  const [mobileView, setMobileView] = useState("list");

  // Refs for outside-click detection
  const sidebarRef = useRef(null);
  const panelRef   = useRef(null);

  // Auth guard
  useEffect(() => {
    if (!userInfo) navigate("/auth");
  }, [userInfo, navigate]);

  useEffect(() => {
    if (location.pathname === "/groups") {
      setActivePanel("groups");
      setChatFilter("groups");
    }
  }, [location.pathname, setActivePanel, setChatFilter]);

  // Escape → close active panel / chat window
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        if (activePanel !== null && activePanel !== "chats") {
          setActivePanel(null);
        } else {
          useAppStore.getState().closeChat();
          setMobileView("list");
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activePanel]);

  // Outside-click: close the open panel when clicking outside both
  // the icon sidebar AND the panel/chat-list column.
  useEffect(() => {
    if (activePanel === null || activePanel === "chats") return;

    const handleOutsideClick = (e) => {
      const clickedSidebar = sidebarRef.current?.contains(e.target);
      const clickedPanel   = panelRef.current?.contains(e.target);
      if (!clickedSidebar && !clickedPanel) {
        setActivePanel(null);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [activePanel, setActivePanel]);

  // Selecting a chat → slide to chat view on narrow screens
  useEffect(() => {
    if (selectedChatData) setMobileView("chat");
  }, [selectedChatData?._id]);

  // Switching to a real panel → go back to list view
  useEffect(() => {
    if (activePanel !== null) setMobileView("list");
  }, [activePanel]);

  const isFullWidthPanel = activePanel && FULL_WIDTH_PANELS.includes(activePanel);

  const renderFullWidthPanel = () => {
    switch (activePanel) {
      case "settings":
        return <SettingsPanel />;
      case "contacts":
        return (
          <ContactsPanel
            onSelectContact={(contact) => {
              useAppStore.getState().setSelectedChatType("contact");
              useAppStore.getState().setSelectedChatData(contact);
              useAppStore.getState().setSelectedChatMessages([]);
              setActivePanel(null);
              setMobileView("chat");
            }}
          />
        );
      case "calls":
        return <CallHistoryPanel />;
      case "requests":
        return <FriendRequestsPanel />;
      default:
        return null;
    }
  };

  return (
    <div
      className="flex flex-col-reverse sm:flex-row overflow-hidden app-bg"
      style={{ height: "var(--app-height)", width: "100vw", maxWidth: "100vw" }}
    >
      {/* ── ICON SIDEBAR — always visible, narrows when chat open ── */}
      <div ref={sidebarRef} className="flex-shrink-0 min-w-0">
        <Sidebar />
      </div>

      {/* ── FULL-WIDTH PANEL or CHAT COLUMNS ── */}
      {isFullWidthPanel ? (
        /* Full-width panel (Settings / Contacts / Calls / Requests) */
        <div ref={panelRef} className="flex-1 min-w-0 min-h-0 overflow-hidden">
          {renderFullWidthPanel()}
        </div>
      ) : (
        <>
          {/* ── CHAT LIST COLUMN ──
              On mobile: full width, hidden when chat is open.
              On sm+: fixed width that narrows when a chat is open.
              Transition matches the sidebar's 300ms ease-in-out. */}
          <div
            ref={panelRef}
            className={`
              flex-1 sm:flex-none sm:flex-shrink-0 flex flex-col border-r border-surface-800 min-h-0 min-w-0 max-w-full
              transition-all duration-300 ease-in-out
              ${selectedChatData
                ? "sm:w-[min(18rem,34vw)] lg:w-[min(20rem,30vw)]"
                : "sm:w-[min(20rem,42vw)] lg:w-[min(23rem,34vw)]"
              }
              ${mobileView === "list" ? "flex w-full" : "hidden sm:flex"}
            `}
          >
            <ChatList onChatSelect={() => setMobileView("chat")} />
          </div>

          {/* ── CHAT WINDOW COLUMN ── */}
          <div
            className={`
              flex-1 min-w-0 min-h-0 flex-col
              ${mobileView === "chat" ? "flex" : "hidden sm:flex"}
            `}
          >
            {selectedChatData ? (
              <ChatWindow onBack={() => {
                setMobileView("list");
              }} />
            ) : (
              <EmptyChat />
            )}
          </div>
        </>
      )}

      {/* Call modals */}
      {activeCall && <CallModal />}
      {incomingCall && !activeCall && <IncomingCallModal />}
    </div>
  );
};

export default ChatPage;
