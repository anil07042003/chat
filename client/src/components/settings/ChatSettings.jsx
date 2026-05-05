import { useState, useEffect } from "react";
import { useAppStore } from "../../store";
import { apiClient } from "../../lib/api-client";
import { UPDATE_CHAT_SETTINGS_ROUTE, UPDATE_NOTIFICATIONS_ROUTE } from "../../utils/constants";
import { toast } from "react-toastify";
import {
  IoReturnDownForwardOutline, IoImagesOutline, IoEyeOutline, IoTextOutline,
} from "react-icons/io5";
import { SectionTitle, SettingsCard, SettingsRow, Toggle, SelectRow } from "./SettingsUI";
import { applyFontSize } from "./SettingsLayout";
import { applyChatWallpaper, normalizeWallpaper, useSettings } from "../../context/SettingsContext";
import Spinner from "../ui/Spinner";

const FONT_OPTIONS = [
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
];

const WALLPAPERS = [
  { id: "default", label: "Default", preview: "bg-surface-950", pattern: "" },
  { id: "dots", label: "Dots", preview: "bg-surface-900", pattern: "dots" },
  { id: "grid", label: "Grid", preview: "bg-surface-900", pattern: "grid" },
  { id: "waves", label: "Waves", preview: "bg-gradient-to-br from-nexchat-900 to-surface-950", pattern: "waves" },
  { id: "gradient1", label: "Sunset", preview: "bg-gradient-to-br from-rose-900 to-amber-900", pattern: "" },
  { id: "gradient2", label: "Ocean", preview: "bg-gradient-to-br from-blue-900 to-cyan-900", pattern: "" },
  { id: "gradient3", label: "Forest", preview: "bg-gradient-to-br from-emerald-900 to-teal-900", pattern: "" },
];

const CHAT_SETTINGS_KEY = "chatSettings";

const DEFAULT_CHAT_SETTINGS = {
  enterToSend: true,
  mediaAutoDownload: true,
  messagePreview: true,
  fontSize: "medium",
  wallpaper: "default",
};

const getSavedChatSettings = () => {
  if (typeof window === "undefined") return {};

  try {
    return JSON.parse(localStorage.getItem(CHAT_SETTINGS_KEY)) || {};
  } catch {
    return {};
  }
};

const ChatSettings = () => {
  const { userInfo, setUserInfo } = useAppStore();
  const { selectedWallpaper, setSelectedWallpaper } = useSettings();
  const [saving, setSaving] = useState(false);

  const getInitialChatSettings = () => {
    const saved = getSavedChatSettings();
    return {
      ...DEFAULT_CHAT_SETTINGS,
      ...(userInfo?.chatSettings || {}),
      ...saved,
      wallpaper: selectedWallpaper,
      messagePreview:
        saved.messagePreview ??
        userInfo?.notificationSettings?.previewMessages ??
        userInfo?.chatSettings?.messagePreview ??
        DEFAULT_CHAT_SETTINGS.messagePreview,
    };
  };

  const initialChatSettings = getInitialChatSettings();
  const [enterToSend, setEnterToSend] = useState(initialChatSettings.enterToSend);
  const [messagePreview, setMessagePreview] = useState(initialChatSettings.messagePreview);
  const [mediaAutoDownload, setMediaAutoDownload] = useState(initialChatSettings.mediaAutoDownload);
  const [fontSize, setFontSize] = useState(initialChatSettings.fontSize);
  const [selectedWallpaperState, setSelectedWallpaperState] = useState(normalizeWallpaper(initialChatSettings.wallpaper));

  const chat = {
    enterToSend,
    mediaAutoDownload,
    messagePreview,
    fontSize,
    wallpaper: selectedWallpaperState,
  };

  const setChatState = (settings) => {
    setEnterToSend(settings.enterToSend);
    setMessagePreview(settings.messagePreview);
    setMediaAutoDownload(settings.mediaAutoDownload);
    setFontSize(settings.fontSize);
    setSelectedWallpaperState(normalizeWallpaper(settings.wallpaper));
  };

  useEffect(() => {
    applyFontSize(fontSize);
    applyChatWallpaper(selectedWallpaperState);
  }, [fontSize, selectedWallpaperState]);

  useEffect(() => {
    const saved = getSavedChatSettings();
    setChatState({
      ...DEFAULT_CHAT_SETTINGS,
      ...(userInfo?.chatSettings || {}),
      ...saved,
      wallpaper: selectedWallpaper,
      messagePreview:
        saved.messagePreview ??
        userInfo?.notificationSettings?.previewMessages ??
        userInfo?.chatSettings?.messagePreview ??
        DEFAULT_CHAT_SETTINGS.messagePreview,
    });
  }, [selectedWallpaper, userInfo?.chatSettings, userInfo?.notificationSettings?.previewMessages]);

  useEffect(() => {
    localStorage.setItem(CHAT_SETTINGS_KEY, JSON.stringify(chat));
  }, [enterToSend, mediaAutoDownload, messagePreview, fontSize, selectedWallpaperState]);

  const saveChatSettings = (settings) => {
    localStorage.setItem(CHAT_SETTINGS_KEY, JSON.stringify(settings));
  };

  const updateStore = (settings, previewValue = settings.messagePreview) => {
    setUserInfo((prev) => ({
      ...prev,
      chatSettings: {
        ...(prev?.chatSettings || {}),
        ...settings,
      },
      notificationSettings: {
        ...(prev?.notificationSettings || {}),
        previewMessages: previewValue,
      },
    }));
  };

  const update = async (key, value) => {
    const previous = { ...chat };
    const updated = { ...chat, [key]: value };

    if (key === "enterToSend") setEnterToSend(value);
    if (key === "messagePreview") setMessagePreview(value);
    if (key === "mediaAutoDownload") setMediaAutoDownload(value);
    if (key === "fontSize") setFontSize(value);
    if (key === "wallpaper") {
      const nextWallpaper = normalizeWallpaper(value);
      setSelectedWallpaperState(nextWallpaper);
      setSelectedWallpaper(nextWallpaper);
      updated.wallpaper = nextWallpaper;
    }

    saveChatSettings(updated);
    updateStore(updated);

    if (key === "fontSize") applyFontSize(value);
    if (key === "wallpaper") applyChatWallpaper(updated.wallpaper);

    setSaving(true);
    try {
      if (key === "messagePreview") {
        const [chatRes, notifRes] = await Promise.all([
          apiClient.put(UPDATE_CHAT_SETTINGS_ROUTE, updated),
          apiClient.put(UPDATE_NOTIFICATIONS_ROUTE, {
            ...(userInfo?.notificationSettings || {}),
            previewMessages: value,
          }),
        ]);
        const savedChat = { ...DEFAULT_CHAT_SETTINGS, ...chatRes.data.chatSettings };
        setChatState(savedChat);
        saveChatSettings(savedChat);
        setUserInfo((prev) => ({
          ...prev,
          chatSettings: savedChat,
          notificationSettings: {
            ...(prev?.notificationSettings || {}),
            ...(notifRes.data.notificationSettings || {}),
            previewMessages: value,
          },
        }));
      } else {
        const res = await apiClient.put(UPDATE_CHAT_SETTINGS_ROUTE, updated);
        const savedChat = { ...DEFAULT_CHAT_SETTINGS, ...res.data.chatSettings };
        setChatState(savedChat);
        saveChatSettings(savedChat);
        setUserInfo((prev) => ({ ...prev, chatSettings: savedChat }));
      }
    } catch {
      toast.error("Failed to save");
      setChatState(previous);
      saveChatSettings(previous);
      updateStore(previous);
      if (key === "fontSize") applyFontSize(previous.fontSize);
      if (key === "wallpaper") {
        setSelectedWallpaper(previous.wallpaper);
        applyChatWallpaper(previous.wallpaper);
      }
    } finally {
      setSaving(false);
    }
  };

  const previewFontClass = {
    small: "text-xs",
    medium: "text-sm",
    large: "text-base",
  }[fontSize] || "text-sm";

  return (
    <div>
      {saving && (
        <div className="flex items-center gap-2 mx-2 sm:mx-3 mt-3 px-3 py-2 bg-nexchat-600/10 border border-nexchat-600/20 rounded-xl">
          <Spinner size="sm" />
          <span className="text-xs text-nexchat-400">Saving...</span>
        </div>
      )}

      <SectionTitle>Messaging</SectionTitle>
      <SettingsCard>
        <SettingsRow
          icon={IoReturnDownForwardOutline}
          iconColor="text-violet-400"
          label="Enter to Send"
          sublabel="Press Enter to send, Shift+Enter for new line"
          right={<Toggle checked={enterToSend} onChange={(v) => update("enterToSend", v)} />}
        />
        <SettingsRow
          icon={IoEyeOutline}
          iconColor="text-cyan-400"
          label="Message Preview"
          sublabel="Show message content in notifications"
          right={<Toggle checked={messagePreview} onChange={(v) => update("messagePreview", v)} />}
        />
        <SettingsRow
          icon={IoImagesOutline}
          iconColor="text-emerald-400"
          label="Auto-Download Media"
          sublabel="Automatically download images and videos"
          right={<Toggle checked={mediaAutoDownload} onChange={(v) => update("mediaAutoDownload", v)} />}
        />
      </SettingsCard>

      <SectionTitle>Font Size</SectionTitle>
      <SettingsCard>
        <SelectRow
          icon={IoTextOutline}
          iconColor="text-amber-400"
          label="Message Font Size"
          value={fontSize}
          options={FONT_OPTIONS}
          onChange={(v) => update("fontSize", v)}
        />
      </SettingsCard>

      <div className="mx-2 sm:mx-3 mb-3 p-3 bg-surface-800 rounded-2xl">
        <p className="text-xs text-surface-500 mb-2">Font size preview</p>
        <div className="flex justify-end mb-2">
          <div className={`bg-nexchat-600 text-white rounded-2xl rounded-br-sm px-3 py-2 max-w-[80%] ${previewFontClass}`}>
            Hey! How are you?
          </div>
        </div>
        <div className="flex justify-start">
          <div className={`bg-surface-700 text-white rounded-2xl rounded-bl-sm px-3 py-2 max-w-[80%] ${previewFontClass}`}>
            I'm doing great, thanks!
          </div>
        </div>
      </div>

      <SectionTitle>Chat Wallpaper</SectionTitle>
      <SettingsCard>
        <div className="p-2.5 sm:p-3">
          <div className="grid grid-cols-4 gap-2">
            {WALLPAPERS.map(({ id, label, preview }) => (
              <button
                key={id}
                onClick={() => update("wallpaper", id)}
                type="button"
                className="flex flex-col items-center gap-1 cursor-pointer"
              >
                <div className={`w-full aspect-square rounded-xl ${preview} border-2 transition-all ${
                  selectedWallpaperState === id
                    ? "border-nexchat-500 scale-105"
                    : "border-surface-700 hover:border-surface-500"
                }`} />
                <span className="text-[9px] sm:text-[10px] text-surface-400 leading-none">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </SettingsCard>
    </div>
  );
};

export default ChatSettings;
