import { useState, useEffect } from "react";
import { useAppStore } from "../../store";
import { apiClient } from "../../lib/api-client";
import { UPDATE_NOTIFICATIONS_ROUTE } from "../../utils/constants";
import { toast } from "react-toastify";
import {
  IoChatbubbleOutline, IoPeopleOutline, IoCallOutline,
  IoVolumeHighOutline, IoPhonePortraitOutline, IoDesktopOutline,
  IoEyeOutline,
} from "react-icons/io5";
import { SectionTitle, SettingsCard, SettingsRow, Toggle } from "./SettingsUI";
import Spinner from "../ui/Spinner";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const playTestSound = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
    // Close context after sound finishes to free resources
    setTimeout(() => { try { ctx.close(); } catch (_) {} }, 500);
  } catch (_) {}
};

const testVibration = () => {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate([100, 50, 100]);
  }
};

// Default notification settings — all enabled
const DEFAULTS = {
  messageNotifications: true,
  groupNotifications:   true,
  callNotifications:    true,
  soundEnabled:         true,
  vibrationEnabled:     true,
  desktopNotifications: true,
  previewMessages:      true,
};

// ─── Component ────────────────────────────────────────────────────────────────

const NotificationSettings = () => {
  const { userInfo, setUserInfo } = useAppStore();

  // Always derive initial state from the store — merge defaults so no key is ever undefined
  const getInitialState = () => ({
    ...DEFAULTS,
    ...(userInfo?.notificationSettings || {}),
  });

  const [notifs, setNotifs]   = useState(getInitialState);
  const [saving, setSaving]   = useState(false);
  const [desktopPermission, setDesktopPermission] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "default"
  );

  // Re-sync local state when the store changes (e.g. after SettingsLayout loads settings)
  useEffect(() => {
    setNotifs({ ...DEFAULTS, ...(userInfo?.notificationSettings || {}) });
  }, [userInfo?.notificationSettings]);

  // Keep browser permission state in sync
  useEffect(() => {
    if (typeof Notification !== "undefined") {
      setDesktopPermission(Notification.permission);
    }
  }, []);

  // ── Save a single key change ───────────────────────────────────────────────
  const update = async (key, value) => {
    // Capture current state before optimistic update for potential revert
    const prevNotifs = { ...notifs };
    const updated    = { ...notifs, [key]: value };

    // Optimistic update — UI responds instantly
    setNotifs(updated);

    // Immediate side-effects for instant feedback
    if (key === "soundEnabled"    && value) playTestSound();
    if (key === "vibrationEnabled" && value) testVibration();

    setSaving(true);
    try {
      const res  = await apiClient.put(UPDATE_NOTIFICATIONS_ROUTE, updated);
      const saved = res.data.notificationSettings;

      // Merge into store with functional updater — never overwrites unrelated fields
      setUserInfo((prev) => ({
        ...prev,
        notificationSettings: { ...DEFAULTS, ...saved },
      }));

      // Sync local state with exactly what the server saved
      setNotifs({ ...DEFAULTS, ...saved });
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to save notification settings");
      // Revert to the state before this update
      setNotifs(prevNotifs);
    } finally {
      setSaving(false);
    }
  };

  // ── Desktop notification permission request ────────────────────────────────
  const requestDesktopPermission = async () => {
    if (!("Notification" in window)) {
      toast.error("Desktop notifications are not supported in this browser");
      return;
    }

    try {
      const perm = await Notification.requestPermission();
      setDesktopPermission(perm);

      if (perm === "granted") {
        // Save enabled=true to DB and show a test notification
        await update("desktopNotifications", true);
        new Notification("BaatChit", {
          body: "Desktop notifications are now enabled! 🎉",
          icon: "/baatchit-icon.svg",
        });
        toast.success("Desktop notifications enabled!");
      } else if (perm === "denied") {
        // Save disabled=false to DB
        await update("desktopNotifications", false);
        toast.error("Permission denied. Enable notifications in your browser settings.");
      } else {
        toast.info("Notification permission dismissed");
      }
    } catch (err) {
      toast.error("Failed to request notification permission");
    }
  };

  // ── Desktop notifications right-side element ──────────────────────────────
  const renderDesktopRight = () => {
    if (desktopPermission === "granted") {
      return (
        <Toggle
          checked={notifs.desktopNotifications}
          onChange={(v) => update("desktopNotifications", v)}
        />
      );
    }
    if (desktopPermission === "denied") {
      return (
        <span className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-1 rounded-lg whitespace-nowrap">
          Blocked
        </span>
      );
    }
    // "default" — not yet asked
    return (
      <button
        onClick={requestDesktopPermission}
        className="text-xs bg-nexchat-600/20 text-nexchat-400 border border-nexchat-600/30 px-3 py-1 rounded-lg hover:bg-nexchat-600/30 transition-colors whitespace-nowrap"
      >
        Enable
      </button>
    );
  };

  const vibrationSupported =
    typeof navigator !== "undefined" && "vibrate" in navigator;

  return (
    <div>
      {/* Saving indicator */}
      {saving && (
        <div className="flex items-center gap-2 mx-2 sm:mx-3 mt-3 px-3 py-2 bg-nexchat-600/10 border border-nexchat-600/20 rounded-xl">
          <Spinner size="sm" />
          <span className="text-xs text-nexchat-400">Saving...</span>
        </div>
      )}

      {/* ── Message Notifications ── */}
      <SectionTitle>Message Notifications</SectionTitle>
      <SettingsCard>
        <SettingsRow
          icon={IoChatbubbleOutline}
          iconColor="text-violet-400"
          label="Direct Messages"
          sublabel="Show notifications for new direct messages"
          right={
            <Toggle
              checked={notifs.messageNotifications}
              onChange={(v) => update("messageNotifications", v)}
            />
          }
        />
        <SettingsRow
          icon={IoPeopleOutline}
          iconColor="text-blue-400"
          label="Group Messages"
          sublabel="Show notifications for new group messages"
          right={
            <Toggle
              checked={notifs.groupNotifications}
              onChange={(v) => update("groupNotifications", v)}
            />
          }
        />
        <SettingsRow
          icon={IoCallOutline}
          iconColor="text-emerald-400"
          label="Calls"
          sublabel="Show notifications for incoming calls"
          right={
            <Toggle
              checked={notifs.callNotifications}
              onChange={(v) => update("callNotifications", v)}
            />
          }
        />
      </SettingsCard>

      {/* ── Sound & Vibration ── */}
      <SectionTitle>Sound & Vibration</SectionTitle>
      <SettingsCard>
        <SettingsRow
          icon={IoVolumeHighOutline}
          iconColor="text-amber-400"
          label="Sound"
          sublabel={notifs.soundEnabled ? "Sound is on — plays a tone on new messages" : "Sound is off"}
          right={
            <Toggle
              checked={notifs.soundEnabled}
              onChange={(v) => update("soundEnabled", v)}
            />
          }
        />
        <SettingsRow
          icon={IoPhonePortraitOutline}
          iconColor="text-pink-400"
          label="Vibration"
          sublabel={
            !vibrationSupported
              ? "Not supported on this device"
              : notifs.vibrationEnabled
              ? "Vibration is on"
              : "Vibration is off"
          }
          right={
            <Toggle
              checked={notifs.vibrationEnabled}
              onChange={(v) => update("vibrationEnabled", v)}
              disabled={!vibrationSupported}
            />
          }
        />
      </SettingsCard>

      {/* ── Display ── */}
      <SectionTitle>Display</SectionTitle>
      <SettingsCard>
        <SettingsRow
          icon={IoDesktopOutline}
          iconColor="text-cyan-400"
          label="Desktop Notifications"
          sublabel={
            desktopPermission === "denied"
              ? "Blocked by browser — open browser settings to allow"
              : desktopPermission === "granted"
              ? notifs.desktopNotifications
                ? "Browser notifications are enabled"
                : "Browser notifications are disabled"
              : "Click Enable to allow browser notifications"
          }
          right={renderDesktopRight()}
        />
        <SettingsRow
          icon={IoEyeOutline}
          iconColor="text-teal-400"
          label="Message Preview"
          sublabel={
            notifs.previewMessages
              ? "Message content shown in notifications"
              : "Notifications show sender name only"
          }
          right={
            <Toggle
              checked={notifs.previewMessages}
              onChange={(v) => update("previewMessages", v)}
            />
          }
        />
      </SettingsCard>
    </div>
  );
};

export default NotificationSettings;
