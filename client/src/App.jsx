import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAppStore } from "./store";
import { apiClient } from "./lib/api-client";
import { GET_USER_INFO_ROUTE } from "./utils/constants";
import AuthPage from "./pages/AuthPage";
import ProfilePage from "./pages/ProfilePage";
import ChatPage from "./pages/ChatPage";
import { LoadingScreen } from "./components/ui/Spinner";
import { applyFontSize } from "./components/settings/SettingsLayout";
import { useSettings } from "./context/SettingsContext";
import { useTheme } from "./context/ThemeContext";

// Route guards
const AuthRoute = ({ children }) => {
  const { userInfo } = useAppStore();
  if (!userInfo) return children;
  // Already logged in — send to chat if profile done, else profile setup
  return userInfo.profileSetup ? <Navigate to="/chat" replace /> : <Navigate to="/profile" replace />;
};

const ProtectedRoute = ({ children }) => {
  const { userInfo } = useAppStore();
  if (!userInfo) return <Navigate to="/auth" replace />;
  // Profile not set up yet — send to profile setup
  if (!userInfo.profileSetup) return <Navigate to="/profile" replace />;
  return children;
};

const ProfileRoute = ({ children }) => {
  const { userInfo } = useAppStore();
  if (!userInfo) return <Navigate to="/auth" replace />;
  // Profile already done — go straight to chat
  if (userInfo.profileSetup) return <Navigate to="/chat" replace />;
  return children;
};

function App() {
  const { userInfo, setUserInfo } = useAppStore();
  const { updateThemeSettings } = useTheme();
  const { setSelectedWallpaper } = useSettings();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await apiClient.get(GET_USER_INFO_ROUTE);
        if (res.status === 200 && res.data.id) {
          setUserInfo(res.data);
          updateThemeSettings({
            theme: res.data.theme || "dark",
            accentColor: res.data.accentColor || "violet",
            uiDensity: res.data.uiDensity || "normal",
            animationsEnabled: res.data.animationsEnabled !== false,
          });
          if (res.data.chatSettings?.fontSize) {
            applyFontSize(res.data.chatSettings.fontSize);
          }
          if (res.data.chatSettings?.wallpaper) {
            setSelectedWallpaper(res.data.chatSettings.wallpaper);
          }
        } else {
          setUserInfo(undefined);
        }
      } catch {
        setUserInfo(undefined);
      } finally {
        setLoading(false);
      }
    };

    if (!userInfo) {
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [setSelectedWallpaper, setUserInfo, updateThemeSettings, userInfo]);

  if (loading) {
    return (
      <div className="h-screen w-screen app-bg flex items-center justify-center">
        <LoadingScreen message="Loading BaatChit..." />
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/auth"
          element={
            <AuthRoute>
              <AuthPage />
            </AuthRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProfileRoute>
              <ProfilePage />
            </ProfileRoute>
          }
        />
        <Route
          path="/chat"
          element={
            <ProtectedRoute>
              <ChatPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/groups"
          element={
            <ProtectedRoute>
              <ChatPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/auth" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
