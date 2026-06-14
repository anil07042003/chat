import { useEffect, useRef } from "react";
import {
  IoBanOutline,
  IoCloseCircleOutline,
  IoEllipsisVertical,
  IoNotificationsOffOutline,
  IoNotificationsOutline,
  IoPersonCircleOutline,
  IoSearchOutline,
  IoTrashBinOutline,
  IoTrashOutline,
} from "react-icons/io5";

const ChatOptionsMenu = ({
  isOpen,
  isGroup,
  isMuted,
  isBlocked,
  onClose,
  onViewProfile,
  onSearchMessages,
  onToggleMute,
  onClearChat,
  onDeleteChat,
  onBlockUser,
}) => {
  const menuRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        onClose();
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const runAction = (action) => {
    action?.();
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="absolute right-2 top-14 z-50 w-64 origin-top-right overflow-hidden rounded-2xl border theme-border theme-card py-1 shadow-2xl shadow-black/30 animate-slide-up sm:right-4"
    >
      <div className="flex items-center gap-2 border-b theme-border px-3 py-2.5 text-xs font-semibold uppercase tracking-[0.16em] theme-text-muted">
        <IoEllipsisVertical size={14} className="text-accent" />
        Chat options
      </div>

      <MenuItem
        icon={IoPersonCircleOutline}
        label={isGroup ? "View Group Info" : "View Profile"}
        onClick={() => runAction(onViewProfile)}
      />
      <MenuItem
        icon={IoSearchOutline}
        label="Search Messages"
        onClick={() => runAction(onSearchMessages)}
      />
      <MenuItem
        icon={isMuted ? IoNotificationsOutline : IoNotificationsOffOutline}
        label={isMuted ? "Unmute Notifications" : "Mute Notifications"}
        onClick={() => runAction(onToggleMute)}
      />
      <MenuItem
        icon={IoTrashOutline}
        label="Clear Chat"
        onClick={() => runAction(onClearChat)}
      />
      <MenuItem
        icon={IoTrashBinOutline}
        label="Delete Chat"
        danger
        onClick={() => runAction(onDeleteChat)}
      />
      {!isGroup && (
        <MenuItem
          icon={IoBanOutline}
          label={isBlocked ? "User Blocked" : "Block User"}
          danger
          disabled={isBlocked}
          onClick={() => runAction(onBlockUser)}
        />
      )}

      <div className="my-1 border-t theme-border" />
      <MenuItem
        icon={IoCloseCircleOutline}
        label="Close Menu"
        muted
        onClick={onClose}
      />
    </div>
  );
};

const MenuItem = ({
  icon: Icon,
  label,
  danger = false,
  muted = false,
  disabled = false,
  onClick,
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={[
      "flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm font-medium transition",
      "disabled:cursor-not-allowed disabled:opacity-50",
      danger
        ? "text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
        : muted
          ? "theme-text-muted hover:bg-[var(--bg-elevated)]"
          : "theme-text-secondary hover:bg-accent-soft",
    ].join(" ")}
  >
    <span className="flex h-8 w-8 items-center justify-center rounded-xl theme-elevated">
      <Icon size={17} />
    </span>
    <span className="min-w-0 truncate">{label}</span>
  </button>
);

export default ChatOptionsMenu;
