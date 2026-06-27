import { useState, useEffect } from "react";
import { useAppStore } from "../../store";
import { apiClient } from "../../lib/api-client";
import { GET_SETTINGS_ROUTE } from "../../utils/constants";
import {
  IoPersonCircle, IoLockClosed, IoEyeOutline, IoChatbubbleOutline,
  IoNotificationsOutline, IoColorPaletteOutline, IoCloudUploadOutline,
  IoShieldOutline, IoSearchOutline, IoChevronBack,
} from "react-icons/io5";
import ProfileSettings from "./ProfileSettings";
import AccountSettings from "./AccountSettings";
import PrivacySettings from "./PrivacySettings";
import ChatSettings from "./ChatSettings";
import NotificationSettings from "./NotificationSettings";
import AppearanceSettings from "./AppearanceSettings";
import StorageSettings from "./StorageSettings";
import SecuritySettings from "./SecuritySettings";
import { applyChatWallpaper } from "../../context/SettingsContext";
import { applyThemeToDOM } from "../../context/ThemeContext";

const SECTIONS = [
  { id: "profile",       label: "Profile",       icon: IoPersonCircle,         color: "text-violet-400" },
  { id: "account",       label: "Account",       icon: IoLockClosed,           color: "text-blue-400"   },
  { id: "privacy",       label: "Privacy",       icon: IoEyeOutline,           color: "text-emerald-400"},
  { id: "notifications", label: "Notifications", icon: IoNotificationsOutline, color: "text-amber-400"  },
  { id: "chat",          label: "Chats",         icon: IoChatbubbleOutline,    color: "text-cyan-400"   },
  { id: "appearance",    label: "Appearance",    icon: IoColorPaletteOutline,  color: "text-pink-400"   },
  { id: "storage",       label: "Storage",       icon: IoCloudUploadOutline,   color: "text-teal-400"   },
  { id: "security",      label: "Security",      icon: IoShieldOutline,        color: "text-rose-400"   },
];

const SECTION_COMPONENTS = {
  profile:       ProfileSettings,
  account:       AccountSettings,
  privacy:       PrivacySettings,
  notifications: NotificationSettings,
  chat:          ChatSettings,
  appearance:    AppearanceSettings,
  storage:       StorageSettings,
  security:      SecuritySettings,
};

const SettingsLayout = () => {
  const { userInfo, setUserInfo } = useAppStore();
  const [activeSection, setActiveSection] = useState(() => {
    // Check if we should open to profile section
    if (typeof window !== "undefined" && localStorage.getItem("openSettingsToProfile")) {
      localStorage.removeItem("openSettingsToProfile");
      return "profile";
    }
    return null;
  });
  const [search, setSearch] = useState("");

  const selectSection = (id) => {
    setActiveSection(id);
  };

  const goBack = () => {
    setActiveSection(null);
  };

  // Fetch fresh settings from DB every time the Settings panel is opened.
  // This ensures toggles always reflect the real persisted state.
  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiClient.get(GET_SETTINGS_ROUTE);
        const s = res.data.settings;
        if (!s) return;

        setUserInfo((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            bio:                  s.bio                  ?? prev.bio,
            phone:                s.phone                ?? prev.phone,
            username:             s.username             ?? prev.username,
            color:                s.color                ?? prev.color,
            image:                s.image                ?? prev.image,
            theme:                s.theme                ?? prev.theme,
            accentColor:          s.accentColor          ?? prev.accentColor,
            uiDensity:            s.uiDensity            ?? prev.uiDensity,
            animationsEnabled:    s.animationsEnabled    ?? prev.animationsEnabled,
            loginAlerts:          s.loginAlerts          ?? prev.loginAlerts,
            // Always use the server value for settings objects — they contain
            // the real persisted state, not just defaults from the JWT payload
            privacySettings:      s.privacySettings      || prev.privacySettings,
            notificationSettings: s.notificationSettings || prev.notificationSettings,
            chatSettings:         s.chatSettings         || prev.chatSettings,
            profileSetup:         prev.profileSetup || s.profileSetup || false,
          };
        });

        applyAppearance(s.theme, s.accentColor, s.uiDensity, s.animationsEnabled);
        if (s.chatSettings?.fontSize) applyFontSize(s.chatSettings.fontSize);
      } catch (_) {
        // silently fail — settings will use cached store values
      }
    };
    load();
  }, []); // Run once per mount of SettingsLayout

  const filtered = SECTIONS.filter((s) =>
    s.label.toLowerCase().includes(search.toLowerCase())
  );

  const ActiveComponent = activeSection ? SECTION_COMPONENTS[activeSection] : null;

  return (
    <div className="flex h-full app-bg overflow-hidden">
      {/* ── Sidebar ── */}
      <div className={[
        "flex flex-col border-r theme-border app-bg flex-shrink-0 overflow-hidden",
        activeSection ? "hidden md:flex" : "flex",
        "w-full md:w-64",
      ].join(" ")}>
        {/* Header */}
        <div className="p-3 border-b theme-border flex-shrink-0">
          <h2 className="text-base font-semibold theme-text mb-3">Settings</h2>
          <div className="relative">
            <IoSearchOutline size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search settings..."
              className="w-full theme-input rounded-xl pl-8 pr-3 py-2 text-sm focus:outline-none focus:border-accent transition-colors"
            />
          </div>
        </div>

        {/* Nav list */}
        <nav className="flex-1 overflow-y-auto p-2 pb-4">
          {filtered.map(({ id, label, icon: Icon, color }) => (
            <button
              key={id}
              type="button"
              onClick={() => selectSection(id)}
              aria-pressed={activeSection === id}
              className={[
                "w-full flex items-center gap-3 px-3 py-3 rounded-2xl transition-all duration-150 text-left",
                activeSection === id
                  ? "bg-accent-soft theme-text ring-1 ring-accent-soft shadow-lg shadow-black/5"
                  : "theme-text-secondary hover:bg-[var(--bg-card)]",
              ].join(" ")}
            >
              <div className={[
                "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                activeSection === id ? "bg-accent-soft" : "theme-card",
              ].join(" ")}>
                <Icon size={16} className={color} />
              </div>
              <span className={`text-sm font-medium truncate ${activeSection === id ? "theme-text" : "theme-text-secondary"}`}>
                {label}
              </span>
            </button>
          ))}
        </nav>
      </div>

      {/* ── Content area ── */}
      <div className={[
        "flex-1 flex flex-col min-w-0 overflow-hidden",
        activeSection ? "flex" : "hidden md:flex",
      ].join(" ")}>
        {ActiveComponent ? (
          <>
            {/* Mobile back header */}
            <div className="md:hidden flex items-center gap-2 px-3 py-3 border-b border-surface-800 bg-surface-900 flex-shrink-0">
              <button
                onClick={goBack}
                className="p-1.5 rounded-lg hover:bg-surface-800 text-surface-400 hover:text-white transition-colors flex-shrink-0"
              >
                <IoChevronBack size={20} />
              </button>
              <span className="font-semibold text-white text-sm truncate">
                {SECTIONS.find((s) => s.id === activeSection)?.label}
              </span>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden pb-6 min-w-0">
              <ActiveComponent />
            </div>
          </>
        ) : (
          <div className="hidden md:flex flex-col items-center justify-center h-full text-center px-8">
            <div className="w-16 h-16 bg-surface-800 rounded-2xl flex items-center justify-center mb-4">
              <IoShieldOutline size={32} className="text-surface-500" />
            </div>
            <p className="text-surface-400 text-sm">Select a settings category</p>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Accent color map ─────────────────────────────────────────────────────────
export const ACCENT_COLOR_MAP = {
  violet:  { h: "263", s: "70%", primary: "#7c3aed", light: "#8b5cf6", btn: "bg-violet-600 hover:bg-violet-500",  border: "border-violet-500",  ring: "ring-violet-500"  },
  blue:    { h: "217", s: "91%", primary: "#2563eb", light: "#3b82f6", btn: "bg-blue-600 hover:bg-blue-500",      border: "border-blue-500",    ring: "ring-blue-500"    },
  emerald: { h: "160", s: "84%", primary: "#059669", light: "#10b981", btn: "bg-emerald-600 hover:bg-emerald-500",border: "border-emerald-500", ring: "ring-emerald-500" },
  rose:    { h: "347", s: "77%", primary: "#e11d48", light: "#f43f5e", btn: "bg-rose-600 hover:bg-rose-500",      border: "border-rose-500",    ring: "ring-rose-500"    },
  amber:   { h: "38",  s: "92%", primary: "#d97706", light: "#f59e0b", btn: "bg-amber-600 hover:bg-amber-500",    border: "border-amber-500",   ring: "ring-amber-500"   },
  cyan:    { h: "192", s: "91%", primary: "#0891b2", light: "#06b6d4", btn: "bg-cyan-600 hover:bg-cyan-500",      border: "border-cyan-500",    ring: "ring-cyan-500"    },
  pink:    { h: "330", s: "81%", primary: "#db2777", light: "#ec4899", btn: "bg-pink-600 hover:bg-pink-500",      border: "border-pink-500",    ring: "ring-pink-500"    },
  indigo:  { h: "239", s: "84%", primary: "#4338ca", light: "#6366f1", btn: "bg-indigo-600 hover:bg-indigo-500",  border: "border-indigo-500",  ring: "ring-indigo-500"  },
};

// ─── Apply appearance to DOM ──────────────────────────────────────────────────
// Uses data-* attributes on <html> so CSS can target them without JS re-renders
export const applyAppearance = (theme, accentColor, uiDensity, animationsEnabled) => {
  applyThemeToDOM({ theme, accentColor, uiDensity, animationsEnabled });
  return;

  const root = document.documentElement;

  // ── Theme ──────────────────────────────────────────────────────────────────
  const resolvedTheme = theme === "system"
    ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : (theme || "dark");

  root.setAttribute("data-theme", resolvedTheme);
  // Keep Tailwind dark class in sync for any dark: variants
  root.classList.toggle("dark", resolvedTheme === "dark");
  root.classList.toggle("light-mode", resolvedTheme === "light");

  // ── Accent color ───────────────────────────────────────────────────────────
  const color = ACCENT_COLOR_MAP[accentColor] || ACCENT_COLOR_MAP.violet;
  root.setAttribute("data-accent", accentColor || "violet");
  root.style.setProperty("--accent-primary", color.primary);
  root.style.setProperty("--accent-light", color.light);
  root.style.setProperty("--accent-h", color.h);
  root.style.setProperty("--accent-s", color.s);

  // ── UI Density ─────────────────────────────────────────────────────────────
  root.setAttribute("data-density", uiDensity || "normal");

  // ── Animations ─────────────────────────────────────────────────────────────
  root.setAttribute("data-animations", animationsEnabled === false ? "off" : "on");
  if (animationsEnabled === false) {
    root.style.setProperty("--transition-duration", "0ms");
    root.style.setProperty("--animation-duration", "0ms");
  } else {
    root.style.setProperty("--transition-duration", "200ms");
    root.style.removeProperty("--animation-duration");
  }
};

export const applyFontSize = (fontSize) => {
  const sizes = { small: "13px", medium: "15px", large: "17px" };
  document.documentElement.style.setProperty(
    "--chat-font-size",
    sizes[fontSize] || sizes.medium
  );
};

export const applyWallpaper = (wallpaperId) => {
  applyChatWallpaper(wallpaperId);
};

export default SettingsLayout;
