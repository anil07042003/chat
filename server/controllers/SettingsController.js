import bcrypt from "bcrypt";
import User from "../models/UserModel.js";
import { renameSync, unlinkSync, existsSync } from "fs";
import path from "path";

// ─── SECURITY PREFERENCES ────────────────────────────────────────────────────
export const updateSecurityPrefs = async (req, res) => {
  try {
    const { loginAlerts } = req.body;
    const update = {};
    if (loginAlerts !== undefined) update.loginAlerts = loginAlerts;

    const user = await User.findByIdAndUpdate(req.userId, update, { new: true })
      .select("loginAlerts");

    return res.status(200).json({ loginAlerts: user.loginAlerts });
  } catch (err) {
    console.error("updateSecurityPrefs error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// ─── GET ALL SETTINGS ─────────────────────────────────────────────────────────
export const getSettings = async (req, res) => {
  try {
    const user = await User.findById(req.userId)
      .select("-password -salt -twoFactorSecret")
      .populate("blockedUsers", "firstName lastName email image color username");

    if (!user) return res.status(404).json({ error: "User not found" });

    return res.status(200).json({ settings: user });
  } catch (err) {
    console.error("getSettings error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// ─── UPDATE PROFILE ───────────────────────────────────────────────────────────
export const updateProfile = async (req, res) => {
  try {
    const { firstName, lastName, bio, username, phone, color } = req.body;

    if (!firstName?.trim() || !lastName?.trim()) {
      return res.status(400).json({ error: "First and last name are required" });
    }

    if (username) {
      const taken = await User.findOne({ username: username.trim(), _id: { $ne: req.userId } });
      if (taken) return res.status(409).json({ error: "Username already taken" });
    }

    const update = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      bio: bio?.trim() || "",
      phone: phone?.trim() || "",
      color: color ?? 0,
      profileSetup: true,
    };
    if (username !== undefined) update.username = username.trim() || undefined;

    const user = await User.findByIdAndUpdate(req.userId, update, { new: true, runValidators: true })
      .select("-password -salt -twoFactorSecret");

    return res.status(200).json({ user: _formatUser(user) });
  } catch (err) {
    console.error("updateProfile error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// ─── UPDATE EMAIL ─────────────────────────────────────────────────────────────
export const updateEmail = async (req, res) => {
  try {
    const { newEmail, currentPassword } = req.body;

    if (!newEmail || !currentPassword) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    const user = await User.findById(req.userId);
    const pepper = process.env.PEPPER_STRING || "";
    const valid = await bcrypt.compare((user.salt || "") + currentPassword + pepper, user.password);
    if (!valid) return res.status(401).json({ error: "Incorrect password" });

    const exists = await User.findOne({ email: newEmail.toLowerCase(), _id: { $ne: req.userId } });
    if (exists) return res.status(409).json({ error: "Email already in use" });

    await User.findByIdAndUpdate(req.userId, { email: newEmail.toLowerCase() });
    return res.status(200).json({ email: newEmail.toLowerCase() });
  } catch (err) {
    console.error("updateEmail error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// ─── CHANGE PASSWORD ──────────────────────────────────────────────────────────
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Both passwords are required" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const user = await User.findById(req.userId);
    const pepper = process.env.PEPPER_STRING || "";
    const valid = await bcrypt.compare((user.salt || "") + currentPassword + pepper, user.password);
    if (!valid) return res.status(401).json({ error: "Current password is incorrect" });

    const newSalt = await bcrypt.genSalt(12);
    const hashed = await bcrypt.hash(newSalt + newPassword + pepper, 12);

    await User.findByIdAndUpdate(req.userId, { password: hashed, salt: newSalt });
    return res.status(200).json({ message: "Password changed successfully" });
  } catch (err) {
    console.error("changePassword error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// ─── PROFILE IMAGE ────────────────────────────────────────────────────────────
export const uploadProfileImage = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Image required" });

    const ext = path.extname(req.file.originalname);
    const fileName = `uploads/profiles/${Date.now()}-${Math.random().toString(36).substr(2, 6)}${ext}`;
    renameSync(req.file.path, fileName);

    const user = await User.findById(req.userId);
    if (user.image && existsSync(user.image)) {
      try { unlinkSync(user.image); } catch (_) {}
    }

    const updated = await User.findByIdAndUpdate(req.userId, { image: fileName }, { new: true });
    return res.status(200).json({ image: updated.image });
  } catch (err) {
    console.error("uploadProfileImage error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const removeProfileImage = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (user?.image && existsSync(user.image)) {
      try { unlinkSync(user.image); } catch (_) {}
    }
    await User.findByIdAndUpdate(req.userId, { image: null });
    return res.status(200).json({ message: "Image removed" });
  } catch (err) {
    console.error("removeProfileImage error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// ─── PRIVACY SETTINGS ─────────────────────────────────────────────────────────
export const updatePrivacySettings = async (req, res) => {
  try {
    const allowed = [
      "lastSeenVisible", "onlineStatusVisible", "readReceiptsEnabled",
      "typingIndicatorEnabled", "profilePhotoVisible", "bioVisible",
      "allowCallsFrom", "allowGroupInvitesFrom",
    ];

    const update = {};
    allowed.forEach((key) => {
      if (req.body[key] !== undefined) update[`privacySettings.${key}`] = req.body[key];
    });

    const user = await User.findByIdAndUpdate(req.userId, { $set: update }, { new: true })
      .select("privacySettings isOnline friends");

    // If onlineStatusVisible or lastSeenVisible changed, re-broadcast the
    // user's online status immediately so friends see the change in real-time
    // without waiting for the next connect/disconnect cycle.
    const onlineStatusChanged = req.body.onlineStatusVisible !== undefined;
    const lastSeenChanged      = req.body.lastSeenVisible     !== undefined;

    if (onlineStatusChanged || lastSeenChanged) {
      // Import the socket broadcast helper via the app's io instance
      // We use a module-level reference set in socket.js
      try {
        const { broadcastOnlineStatusById } = await import("../socket.js");
        if (typeof broadcastOnlineStatusById === "function") {
          await broadcastOnlineStatusById(req.userId, user.isOnline ?? true);
        }
      } catch (_) {
        // Non-critical — status will sync on next connect/disconnect
      }
    }

    return res.status(200).json({ privacySettings: user.privacySettings });
  } catch (err) {
    console.error("updatePrivacySettings error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// ─── NOTIFICATION SETTINGS ────────────────────────────────────────────────────
export const updateNotificationSettings = async (req, res) => {
  try {
    const allowed = [
      "messageNotifications", "groupNotifications", "callNotifications",
      "soundEnabled", "vibrationEnabled", "desktopNotifications", "previewMessages",
    ];

    const update = {};
    allowed.forEach((key) => {
      if (req.body[key] !== undefined) update[`notificationSettings.${key}`] = req.body[key];
    });

    const user = await User.findByIdAndUpdate(req.userId, { $set: update }, { new: true })
      .select("notificationSettings");

    return res.status(200).json({ notificationSettings: user.notificationSettings });
  } catch (err) {
    console.error("updateNotificationSettings error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// ─── CHAT SETTINGS ────────────────────────────────────────────────────────────
export const updateChatSettings = async (req, res) => {
  try {
    const allowed = ["enterToSend", "mediaAutoDownload", "messagePreview", "fontSize", "wallpaper"];

    const update = {};
    allowed.forEach((key) => {
      if (req.body[key] !== undefined) update[`chatSettings.${key}`] = req.body[key];
    });

    const user = await User.findByIdAndUpdate(req.userId, { $set: update }, { new: true })
      .select("chatSettings");

    return res.status(200).json({ chatSettings: user.chatSettings });
  } catch (err) {
    console.error("updateChatSettings error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// ─── APPEARANCE SETTINGS ──────────────────────────────────────────────────────
export const updateAppearance = async (req, res) => {
  try {
    const { theme, accentColor, uiDensity, animationsEnabled } = req.body;
    const update = {};
    if (theme !== undefined) update.theme = theme;
    if (accentColor !== undefined) update.accentColor = accentColor;
    if (uiDensity !== undefined) update.uiDensity = uiDensity;
    if (animationsEnabled !== undefined) update.animationsEnabled = animationsEnabled;

    const user = await User.findByIdAndUpdate(req.userId, update, { new: true })
      .select("theme accentColor uiDensity animationsEnabled");

    return res.status(200).json({
      theme: user.theme,
      accentColor: user.accentColor,
      uiDensity: user.uiDensity,
      animationsEnabled: user.animationsEnabled,
    });
  } catch (err) {
    console.error("updateAppearance error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// ─── BLOCKED USERS ────────────────────────────────────────────────────────────
export const getBlockedUsers = async (req, res) => {
  try {
    const user = await User.findById(req.userId)
      .populate("blockedUsers", "firstName lastName email image color username");
    return res.status(200).json({ blockedUsers: user.blockedUsers || [] });
  } catch (err) {
    console.error("getBlockedUsers error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const blockUser = async (req, res) => {
  try {
    const { userId: targetId } = req.body;
    await User.findByIdAndUpdate(req.userId, { $addToSet: { blockedUsers: targetId } });
    return res.status(200).json({ message: "User blocked" });
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const unblockUser = async (req, res) => {
  try {
    const { userId: targetId } = req.body;
    await User.findByIdAndUpdate(req.userId, { $pull: { blockedUsers: targetId } });
    return res.status(200).json({ message: "User unblocked" });
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
};

// ─── SESSIONS ─────────────────────────────────────────────────────────────────
export const getSessions = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("sessions");
    return res.status(200).json({ sessions: user.sessions || [] });
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const revokeSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    await User.findByIdAndUpdate(req.userId, { $pull: { sessions: { _id: sessionId } } });
    return res.status(200).json({ message: "Session revoked" });
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const revokeAllSessions = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.userId, { $set: { sessions: [] } });
    return res.status(200).json({ message: "All sessions revoked" });
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
};

// ─── DELETE ACCOUNT ───────────────────────────────────────────────────────────
export const deleteAccount = async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: "Password required" });

    const user = await User.findById(req.userId);
    const pepper = process.env.PEPPER_STRING || "";
    const valid = await bcrypt.compare((user.salt || "") + password + pepper, user.password);
    if (!valid) return res.status(401).json({ error: "Incorrect password" });

    // Remove profile image
    if (user.image && existsSync(user.image)) {
      try { unlinkSync(user.image); } catch (_) {}
    }

    await User.findByIdAndDelete(req.userId);

    res.cookie("jwt", "", { maxAge: 1, httpOnly: true });
    return res.status(200).json({ message: "Account deleted" });
  } catch (err) {
    console.error("deleteAccount error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// ─── STORAGE INFO ─────────────────────────────────────────────────────────────
export const getStorageInfo = async (req, res) => {
  try {
    const Message = (await import("../models/MessageModel.js")).default;

    const messages = await Message.find({ sender: req.userId, fileUrl: { $exists: true, $ne: null } })
      .select("fileSize messageType createdAt fileUrl fileName");

    const totalBytes = messages.reduce((sum, m) => sum + (m.fileSize || 0), 0);
    const byType = messages.reduce((acc, m) => {
      acc[m.messageType] = (acc[m.messageType] || 0) + (m.fileSize || 0);
      return acc;
    }, {});

    return res.status(200).json({
      totalBytes,
      byType,
      fileCount: messages.length,
    });
  } catch (err) {
    console.error("getStorageInfo error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// ─── DELETE ALL MEDIA ─────────────────────────────────────────────────────────
export const deleteAllMedia = async (req, res) => {
  try {
    const Message = (await import("../models/MessageModel.js")).default;
    const { unlinkSync, existsSync } = await import("fs");

    const messages = await Message.find({
      sender: req.userId,
      fileUrl: { $exists: true, $ne: null },
    }).select("fileUrl");

    let deleted = 0;
    for (const msg of messages) {
      if (msg.fileUrl && existsSync(msg.fileUrl)) {
        try { unlinkSync(msg.fileUrl); deleted++; } catch (_) {}
      }
    }

    await Message.updateMany(
      { sender: req.userId, fileUrl: { $exists: true, $ne: null } },
      { $unset: { fileUrl: 1, fileName: 1, fileSize: 1, fileMimeType: 1 } }
    );

    return res.status(200).json({ message: `Deleted ${deleted} media files` });
  } catch (err) {
    console.error("deleteAllMedia error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// ─── HELPER ───────────────────────────────────────────────────────────────────
const _formatUser = (user) => ({
  id: user._id,
  email: user.email,
  username: user.username,
  firstName: user.firstName,
  lastName: user.lastName,
  bio: user.bio,
  phone: user.phone,
  image: user.image,
  color: user.color,
  profileSetup: user.profileSetup,
  theme: user.theme,
  accentColor: user.accentColor,
  uiDensity: user.uiDensity,
  animationsEnabled: user.animationsEnabled,
  privacySettings: user.privacySettings,
  notificationSettings: user.notificationSettings,
  chatSettings: user.chatSettings,
});
