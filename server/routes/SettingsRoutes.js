import { Router } from "express";
import multer from "multer";
import path from "path";
import { mkdirSync, existsSync } from "fs";
import { verifyToken } from "../middlewares/AuthMiddleware.js";
import {
  getSettings,
  updateProfile,
  updateEmail,
  changePassword,
  uploadProfileImage,
  removeProfileImage,
  updatePrivacySettings,
  updateNotificationSettings,
  updateChatSettings,
  updateAppearance,
  updateSecurityPrefs,
  getBlockedUsers,
  blockUser,
  unblockUser,
  getSessions,
  revokeSession,
  revokeAllSessions,
  deleteAccount,
  getStorageInfo,
  deleteAllMedia,
} from "../controllers/SettingsController.js";

if (!existsSync("uploads/profiles")) mkdirSync("uploads/profiles", { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/profiles/"),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).substr(2, 8)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/jpeg|jpg|png|gif|webp/.test(path.extname(file.originalname).toLowerCase())) cb(null, true);
    else cb(new Error("Only image files allowed"));
  },
});

const settingsRoutes = Router();

// All routes require auth
settingsRoutes.use(verifyToken);

settingsRoutes.get("/", getSettings);
settingsRoutes.put("/profile", updateProfile);
settingsRoutes.put("/email", updateEmail);
settingsRoutes.put("/password", changePassword);
settingsRoutes.post("/profile-image", upload.single("profile-image"), uploadProfileImage);
settingsRoutes.delete("/profile-image", removeProfileImage);
settingsRoutes.put("/privacy", updatePrivacySettings);
settingsRoutes.put("/notifications", updateNotificationSettings);
settingsRoutes.put("/chat", updateChatSettings);
settingsRoutes.put("/appearance", updateAppearance);
settingsRoutes.put("/security-prefs", updateSecurityPrefs);
settingsRoutes.get("/blocked", getBlockedUsers);
settingsRoutes.post("/block", blockUser);
settingsRoutes.post("/unblock", unblockUser);
settingsRoutes.get("/sessions", getSessions);
settingsRoutes.delete("/sessions/:sessionId", revokeSession);
settingsRoutes.delete("/sessions", revokeAllSessions);
settingsRoutes.delete("/account", deleteAccount);
settingsRoutes.get("/storage", getStorageInfo);
settingsRoutes.delete("/storage/media", deleteAllMedia);

export default settingsRoutes;
