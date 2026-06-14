import { useState, useEffect } from "react";
import { useAppStore } from "../../store";
import { apiClient } from "../../lib/api-client";
import { UPDATE_APPEARANCE_ROUTE } from "../../utils/constants";
import { toast } from "react-toastify";
import { IoMoonOutline, IoSunnyOutline, IoPhonePortraitOutline, IoSparklesOutline } from "react-icons/io5";
import { SectionTitle, SettingsCard, SettingsRow, Toggle } from "./SettingsUI";
import { useTheme } from "../../context/ThemeContext";
import Spinner from "../ui/Spinner";

const ACCENT_COLORS = [
  { id: "violet",  label: "Violet",  bg: "bg-violet-500",  ring: "ring-violet-400"  },
  { id: "blue",    label: "Blue",    bg: "bg-blue-500",    ring: "ring-blue-400"    },
  { id: "emerald", label: "Green",   bg: "bg-emerald-500", ring: "ring-emerald-400" },
  { id: "rose",    label: "Rose",    bg: "bg-rose-500",    ring: "ring-rose-400"    },
  { id: "amber",   label: "Amber",   bg: "bg-amber-500",   ring: "ring-amber-400"   },
  { id: "cyan",    label: "Cyan",    bg: "bg-cyan-500",    ring: "ring-cyan-400"    },
  { id: "pink",    label: "Pink",    bg: "bg-pink-500",    ring: "ring-pink-400"    },
  { id: "indigo",  label: "Indigo",  bg: "bg-indigo-500",  ring: "ring-indigo-400"  },
];

const DENSITY_OPTIONS = [
  { id: "compact",     label: "Compact",     desc: "More content, less spacing" },
  { id: "normal",      label: "Normal",      desc: "Balanced layout"            },
  { id: "comfortable", label: "Comfortable", desc: "More spacing, easier to read" },
];

const AppearanceSettings = () => {
  const { userInfo, setUserInfo } = useAppStore();
  const { updateThemeSettings } = useTheme();
  const [saving, setSaving] = useState(false);
  const [appearance, setAppearance] = useState({
    theme: userInfo?.theme || "dark",
    accentColor: userInfo?.accentColor || "violet",
    uiDensity: userInfo?.uiDensity || "normal",
    animationsEnabled: userInfo?.animationsEnabled !== false,
  });

  useEffect(() => {
    const nextAppearance = {
      theme: userInfo?.theme || "dark",
      accentColor: userInfo?.accentColor || "violet",
      uiDensity: userInfo?.uiDensity || "normal",
      animationsEnabled: userInfo?.animationsEnabled !== false,
    };
    setAppearance(nextAppearance);
    updateThemeSettings(nextAppearance);
  }, [
    userInfo?.theme,
    userInfo?.accentColor,
    userInfo?.uiDensity,
    userInfo?.animationsEnabled,
    updateThemeSettings,
  ]);

  const update = async (key, value) => {
    const updated = { ...appearance, [key]: value };
    setAppearance(updated);
    updateThemeSettings(updated);

    setSaving(true);
    try {
      const res = await apiClient.put(UPDATE_APPEARANCE_ROUTE, updated);
      // Use functional updater — never overwrites unrelated fields
      setUserInfo((prev) => ({
        ...prev,
        theme:             res.data.theme,
        accentColor:       res.data.accentColor,
        uiDensity:         res.data.uiDensity,
        animationsEnabled: res.data.animationsEnabled,
      }));
    } catch {
      toast.error("Failed to save appearance");
      updateThemeSettings(appearance);
      setAppearance(appearance);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {saving && (
        <div className="flex items-center gap-2 mx-2 sm:mx-3 mt-3 px-3 py-2 bg-accent-soft border border-accent-soft rounded-xl">
          <Spinner size="sm" />
          <span className="text-xs text-nexchat-400">Saving...</span>
        </div>
      )}

      {/* Theme */}
      <SectionTitle>Theme</SectionTitle>
      <SettingsCard>
        <div className="p-2.5 sm:p-3 grid grid-cols-3 gap-2">
          {[
            { id: "dark",   icon: IoMoonOutline,          label: "Dark"   },
            { id: "light",  icon: IoSunnyOutline,         label: "Light"  },
            { id: "system", icon: IoPhonePortraitOutline, label: "System" },
          ].map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => update("theme", id)}
              className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border-2 transition-all ${
                appearance.theme === id
                  ? "border-accent bg-accent-soft"
                  : "theme-border hover:border-accent"
              }`}
            >
              <Icon size={18} className={appearance.theme === id ? "text-nexchat-400" : "text-surface-400"} />
              <span className={`text-xs font-medium ${appearance.theme === id ? "text-nexchat-300" : "text-surface-400"}`}>
                {label}
              </span>
            </button>
          ))}
        </div>
      </SettingsCard>

      {/* Accent color */}
      <SectionTitle>Accent Color</SectionTitle>
      <SettingsCard>
        <div className="p-2.5 sm:p-3">
          {/* 4 cols always — each swatch is ~60px on 320px, comfortable */}
          <div className="grid grid-cols-4 gap-2 sm:gap-3">
            {ACCENT_COLORS.map(({ id, label, bg, ring }) => (
              <button
                key={id}
                onClick={() => update("accentColor", id)}
                className="flex flex-col items-center gap-1"
              >
                <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full ${bg} transition-all ${
                  appearance.accentColor === id
                    ? `ring-2 ${ring} ring-offset-2 ring-offset-[var(--bg-card)] scale-110`
                    : "hover:scale-105"
                }`} />
                <span className="text-[9px] sm:text-[10px] text-surface-400 leading-none">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </SettingsCard>

      {/* UI Density */}
      <SectionTitle>UI Density</SectionTitle>
      <SettingsCard>
        <div className="p-2.5 sm:p-3 space-y-2">
          {DENSITY_OPTIONS.map(({ id, label, desc }) => (
            <button
              key={id}
              onClick={() => update("uiDensity", id)}
              className={`w-full flex items-center gap-2.5 p-2.5 rounded-xl border-2 transition-all text-left ${
                appearance.uiDensity === id
                  ? "border-accent bg-accent-soft"
                  : "theme-border hover:border-accent"
              }`}
            >
              <div className={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 ${
                appearance.uiDensity === id ? "border-accent bg-accent" : "border-surface-500"
              }`} />
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium leading-snug ${appearance.uiDensity === id ? "text-white" : "text-surface-300"}`}>
                  {label}
                </p>
                <p className="text-xs text-surface-500 leading-relaxed break-words">{desc}</p>
              </div>
            </button>
          ))}
        </div>
      </SettingsCard>

      {/* Animations */}
      <SectionTitle>Animations</SectionTitle>
      <SettingsCard>
        <SettingsRow
          icon={IoSparklesOutline}
          iconColor="text-amber-400"
          label="Enable Animations"
          sublabel="Smooth transitions and effects"
          right={
            <Toggle
              checked={appearance.animationsEnabled}
              onChange={(v) => update("animationsEnabled", v)}
            />
          }
        />
      </SettingsCard>

      {/* Live preview */}
      <SectionTitle>Preview</SectionTitle>
      <div className="mx-2 sm:mx-3 mb-4 p-3 theme-card rounded-2xl space-y-2">
        <p className="text-xs text-surface-500 mb-2">How your chat will look</p>
        <div className="flex justify-end">
          <div className="bg-accent text-white rounded-2xl rounded-br-sm px-3 py-2 text-sm max-w-[80%]">
            Hey! How are you? 👋
          </div>
        </div>
        <div className="flex justify-start">
          <div className="theme-elevated theme-text rounded-2xl rounded-bl-sm px-3 py-2 text-sm max-w-[80%]">
            I'm doing great, thanks! 😊
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppearanceSettings;
