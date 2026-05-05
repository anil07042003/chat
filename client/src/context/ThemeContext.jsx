import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export const ACCENT_COLOR_MAP = {
  violet: { h: "263", s: "70%", primary: "#7c3aed", light: "#8b5cf6", rgb: "124, 58, 237", lightRgb: "139, 92, 246" },
  blue: { h: "217", s: "91%", primary: "#2563eb", light: "#3b82f6", rgb: "37, 99, 235", lightRgb: "59, 130, 246" },
  emerald: { h: "160", s: "84%", primary: "#059669", light: "#10b981", rgb: "5, 150, 105", lightRgb: "16, 185, 129" },
  rose: { h: "347", s: "77%", primary: "#e11d48", light: "#f43f5e", rgb: "225, 29, 72", lightRgb: "244, 63, 94" },
  amber: { h: "38", s: "92%", primary: "#d97706", light: "#f59e0b", rgb: "217, 119, 6", lightRgb: "245, 158, 11" },
  cyan: { h: "192", s: "91%", primary: "#0891b2", light: "#06b6d4", rgb: "8, 145, 178", lightRgb: "6, 182, 212" },
  pink: { h: "330", s: "81%", primary: "#db2777", light: "#ec4899", rgb: "219, 39, 119", lightRgb: "236, 72, 153" },
  indigo: { h: "239", s: "84%", primary: "#4338ca", light: "#6366f1", rgb: "67, 56, 202", lightRgb: "99, 102, 241" },
};

const STORAGE_KEY = "baatchit-theme-settings";

const ThemeContext = createContext(null);

const getSystemTheme = () => {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

const getStoredTheme = () => {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
};

export const applyThemeToDOM = ({
  theme = "dark",
  accentColor = "violet",
  uiDensity = "normal",
  animationsEnabled = true,
} = {}) => {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  const resolvedTheme = theme === "system" ? getSystemTheme() : theme;
  const accent = ACCENT_COLOR_MAP[accentColor] || ACCENT_COLOR_MAP.violet;

  root.setAttribute("data-theme-mode", theme);
  root.setAttribute("data-theme", resolvedTheme);
  root.setAttribute("data-accent", accentColor || "violet");
  root.setAttribute("data-density", uiDensity || "normal");
  root.setAttribute("data-animations", animationsEnabled === false ? "off" : "on");

  root.classList.toggle("dark", resolvedTheme === "dark");
  root.classList.toggle("light", resolvedTheme === "light");
  root.classList.toggle("light-mode", resolvedTheme === "light");

  root.style.setProperty("--accent-primary", accent.primary);
  root.style.setProperty("--accent-light", accent.light);
  root.style.setProperty("--accent-primary-rgb", accent.rgb);
  root.style.setProperty("--accent-light-rgb", accent.lightRgb);
  root.style.setProperty("--accent-h", accent.h);
  root.style.setProperty("--accent-s", accent.s);
  root.style.setProperty("--transition-duration", animationsEnabled === false ? "0ms" : "200ms");
  root.style.setProperty("--animation-duration", animationsEnabled === false ? "0ms" : "200ms");
};

export const ThemeProvider = ({ children }) => {
  const stored = getStoredTheme();
  const [theme, setTheme] = useState(stored.theme || "dark");
  const [accentColor, setAccentColor] = useState(stored.accentColor || "violet");
  const [uiDensity, setUiDensity] = useState(stored.uiDensity || "normal");
  const [animationsEnabled, setAnimationsEnabled] = useState(
    stored.animationsEnabled !== false
  );
  const [systemTheme, setSystemTheme] = useState(getSystemTheme);

  const resolvedTheme = theme === "system" ? systemTheme : theme;

  const settings = useMemo(
    () => ({ theme, accentColor, uiDensity, animationsEnabled }),
    [theme, accentColor, uiDensity, animationsEnabled]
  );

  useEffect(() => {
    applyThemeToDOM(settings);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const nextSystemTheme = getSystemTheme();
      setSystemTheme(nextSystemTheme);
      if (theme === "system") {
        applyThemeToDOM({ ...settings, theme: "system" });
      }
    };

    media.addEventListener?.("change", onChange);
    return () => media.removeEventListener?.("change", onChange);
  }, [settings, theme]);

  const updateThemeSettings = useCallback((updates = {}) => {
    if (updates.theme !== undefined) setTheme(updates.theme);
    if (updates.accentColor !== undefined) setAccentColor(updates.accentColor);
    if (updates.uiDensity !== undefined) setUiDensity(updates.uiDensity);
    if (updates.animationsEnabled !== undefined) {
      setAnimationsEnabled(updates.animationsEnabled);
    }
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        resolvedTheme,
        systemTheme,
        accentColor,
        uiDensity,
        animationsEnabled,
        updateThemeSettings,
        setTheme: (value) => updateThemeSettings({ theme: value }),
        setAccentColor: (value) => updateThemeSettings({ accentColor: value }),
        setUiDensity: (value) => updateThemeSettings({ uiDensity: value }),
        setAnimationsEnabled: (value) =>
          updateThemeSettings({ animationsEnabled: value }),
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used inside ThemeProvider");
  }
  return context;
};
