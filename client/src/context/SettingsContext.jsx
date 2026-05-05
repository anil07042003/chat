import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export const CHAT_WALLPAPER_KEY = "chatWallpaper";

export const CHAT_WALLPAPERS = {
  default: {
    image: "none",
    bg: "#0b0b0f",
    size: "auto",
  },
  dots: {
    image: "radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)",
    bg: "#101014",
    size: "20px 20px",
  },
  grid: {
    image: "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
    bg: "#101014",
    size: "30px 30px",
  },
  waves: {
    image: "linear-gradient(135deg, #1e1b4b 0%, #09090b 100%)",
    bg: "#09090b",
    size: "auto",
  },
  gradient1: {
    image: "linear-gradient(135deg, #4c0519 0%, #78350f 100%)",
    bg: "#4c0519",
    size: "auto",
  },
  gradient2: {
    image: "linear-gradient(135deg, #1e3a5f 0%, #164e63 100%)",
    bg: "#1e3a5f",
    size: "auto",
  },
  gradient3: {
    image: "linear-gradient(135deg, #064e3b 0%, #134e4a 100%)",
    bg: "#064e3b",
    size: "auto",
  },
};

const SettingsContext = createContext(null);

export const normalizeWallpaper = (wallpaper) => {
  if (!wallpaper || wallpaper === "none") return "default";
  return CHAT_WALLPAPERS[wallpaper] ? wallpaper : "default";
};

export const applyChatWallpaper = (wallpaperId) => {
  if (typeof document === "undefined") return;

  const wallpaper = CHAT_WALLPAPERS[normalizeWallpaper(wallpaperId)];
  const root = document.documentElement;
  root.style.setProperty("--chat-wallpaper-image", wallpaper.image);
  root.style.setProperty("--chat-wallpaper-bg", wallpaper.bg);
  root.style.setProperty("--chat-wallpaper-size", wallpaper.size);
};

const getInitialWallpaper = () => {
  if (typeof window === "undefined") return "default";
  return normalizeWallpaper(localStorage.getItem(CHAT_WALLPAPER_KEY));
};

export const SettingsProvider = ({ children }) => {
  const [selectedWallpaper, setSelectedWallpaperState] = useState(getInitialWallpaper);

  const setSelectedWallpaper = useCallback((wallpaper) => {
    const nextWallpaper = normalizeWallpaper(wallpaper);
    setSelectedWallpaperState(nextWallpaper);
    localStorage.setItem(CHAT_WALLPAPER_KEY, nextWallpaper);
    applyChatWallpaper(nextWallpaper);
  }, []);

  useEffect(() => {
    applyChatWallpaper(selectedWallpaper);
  }, [selectedWallpaper]);

  const value = useMemo(
    () => ({
      selectedWallpaper,
      setSelectedWallpaper,
    }),
    [selectedWallpaper, setSelectedWallpaper]
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within SettingsProvider");
  }
  return context;
};
