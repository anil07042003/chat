import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/UserModel.js";
import { renameSync, unlinkSync, existsSync } from "fs";
import path from "path";

const MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

const createToken = (email, userId) => {
  const jwtKey = process.env.JWT_KEY || "baatchit";
  return jwt.sign({ email, userId }, jwtKey, {
    expiresIn: "7d",
  });
};

const setCookieOptions = () => ({
  maxAge: MAX_AGE,
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
});

export const signup = async (req, res) => {
  try {
    const { email, password, username } = req.body;

    // ── Validation ────────────────────────────────────────────────────────
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    if (typeof password !== "string" || password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    // ── Check MongoDB connection ──────────────────────────────────────────
    const mongoose = (await import("mongoose")).default;
    if (mongoose.connection.readyState !== 1) {
      console.error("Signup failed: MongoDB not connected (state:", mongoose.connection.readyState, ")");
      return res.status(503).json({ error: "Database not available. Please try again in a moment." });
    }

    // ── Duplicate checks ──────────────────────────────────────────────────
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ error: "Email already registered" });
    }

    if (username && username.trim()) {
      const existingUsername = await User.findOne({ username: username.trim() });
      if (existingUsername) {
        return res.status(409).json({ error: "Username already taken" });
      }
    }

    // ── Hash password ─────────────────────────────────────────────────────
    const salt = await bcrypt.genSalt(12);
    const pepper = process.env.PEPPER_STRING || "";
    const hashedPassword = await bcrypt.hash(salt + password + pepper, 12);

    // ── Create user ───────────────────────────────────────────────────────
    const user = await User.create({
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      salt,
      username: (username && username.trim()) ? username.trim() : undefined,
    });

    // ── Issue JWT ─────────────────────────────────────────────────────────
    const token = createToken(user.email, user._id);
    res.cookie("jwt", token, setCookieOptions());

    console.log(`✅ New user registered: ${user.email}`);

    return res.status(201).json({
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        profileSetup: user.profileSetup,
      },
    });
  } catch (error) {
    // Log the full error so it's visible in the server terminal
    console.error("Signup error:", error?.message || error);
    console.error("Signup error stack:", error?.stack);

    // In development, return the actual error message to help debugging
    const isDev = process.env.NODE_ENV !== "production";
    return res.status(500).json({
      error: isDev
        ? `Server error: ${error?.message || "Unknown error"}`
        : "Internal server error",
    });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // ── Check MongoDB connection ──────────────────────────────────────────
    const mongoose = (await import("mongoose")).default;
    if (mongoose.connection.readyState !== 1) {
      console.error("Login failed: MongoDB not connected (state:", mongoose.connection.readyState, ")");
      return res.status(503).json({ error: "Database not available. Please try again in a moment." });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const pepper = process.env.PEPPER_STRING || "";
    // Guard: salt may be null/undefined for legacy accounts
    const salt = user.salt || "";

    // Try current pepper first, then legacy peppers for backward compatibility
    const pepperCandidates = [
      pepper,
      "dev_pepper",
      "your_pepper_string_change_in_production",
      "",
    ];

    let isValid = false;
    for (const p of pepperCandidates) {
      try {
        const match = await bcrypt.compare(salt + password + p, user.password);
        if (match) { isValid = true; break; }
      } catch (_) {}
    }

    if (!isValid) {
      console.error(`Login failed for ${email}: password mismatch`);
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Update online status
    await User.findByIdAndUpdate(user._id, { isOnline: true, lastSeen: new Date() });

    // Track session
    const ua = req.headers["user-agent"] || "";
    const isMobile = /mobile|android|iphone|ipad/i.test(ua);
    const isTablet = /ipad|tablet/i.test(ua);
    const deviceType = isTablet ? "tablet" : isMobile ? "mobile" : "desktop";
    const browser = ua.match(/(chrome|firefox|safari|edge|opera)/i)?.[1] || "Unknown";
    const os = ua.match(/(windows|mac|linux|android|ios)/i)?.[1] || "Unknown";
    const ip = req.ip || req.connection?.remoteAddress || "";

    const session = {
      deviceName: `${browser} on ${os}`,
      deviceType,
      browser,
      os,
      ip,
      lastActive: new Date(),
      createdAt: new Date(),
    };

    await User.findByIdAndUpdate(user._id, {
      $push: { sessions: { $each: [session], $slice: -10 } },
    });

    const token = createToken(user.email, user._id);
    res.cookie("jwt", token, setCookieOptions());

    console.log(`✅ User logged in: ${user.email}`);

    return res.status(200).json({
      user: {
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
        loginAlerts: user.loginAlerts,
        privacySettings: user.privacySettings,
        notificationSettings: user.notificationSettings,
        chatSettings: user.chatSettings,
      },
    });
  } catch (error) {
    console.error("Login error:", error?.message || error);
    console.error("Login error stack:", error?.stack);
    const isDev = process.env.NODE_ENV !== "production";
    return res.status(500).json({
      error: isDev
        ? `Server error: ${error?.message || "Unknown error"}`
        : "Internal server error",
    });
  }
};

export const getUserInfo = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-password -salt");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.status(200).json({
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
      isOnline: user.isOnline,
      lastSeen: user.lastSeen,
      privacySettings: user.privacySettings,
      notificationSettings: user.notificationSettings,
      chatSettings: user.chatSettings,
    });
  } catch (error) {
    console.error("Get user info error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { firstName, lastName, bio, color, username, theme, accentColor, privacySettings, notificationSettings } = req.body;

    if (!firstName || !lastName) {
      return res.status(400).json({ error: "First name and last name are required" });
    }

    if (username) {
      const existingUsername = await User.findOne({ username, _id: { $ne: req.userId } });
      if (existingUsername) {
        return res.status(409).json({ error: "Username already taken" });
      }
    }

    const updateData = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      bio: bio || "",
      color,
      profileSetup: true,
    };

    if (username) updateData.username = username.trim();
    if (theme) updateData.theme = theme;
    if (accentColor) updateData.accentColor = accentColor;
    if (privacySettings) updateData.privacySettings = privacySettings;
    if (notificationSettings) updateData.notificationSettings = notificationSettings;

    const user = await User.findByIdAndUpdate(req.userId, updateData, {
      new: true,
      runValidators: true,
    }).select("-password -salt");

    return res.status(200).json({
      id: user._id,
      email: user.email,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      bio: user.bio,
      image: user.image,
      color: user.color,
      profileSetup: user.profileSetup,
      theme: user.theme,
      accentColor: user.accentColor,
      privacySettings: user.privacySettings,
      notificationSettings: user.notificationSettings,
    });
  } catch (error) {
    console.error("Update profile error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const addProfileImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Image file is required" });
    }

    const date = Date.now();
    const ext = path.extname(req.file.originalname);
    const fileName = `uploads/profiles/${date}${ext}`;
    renameSync(req.file.path, fileName);

    // Remove old image if exists
    const user = await User.findById(req.userId);
    if (user.image && existsSync(user.image)) {
      try { unlinkSync(user.image); } catch (e) { /* ignore */ }
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.userId,
      { image: fileName },
      { new: true }
    );

    return res.status(200).json({ image: updatedUser.image });
  } catch (error) {
    console.error("Add profile image error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const removeProfileImage = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    if (user.image && existsSync(user.image)) {
      try { unlinkSync(user.image); } catch (e) { /* ignore */ }
    }

    await User.findByIdAndUpdate(req.userId, { image: null });
    return res.status(200).json({ message: "Profile image removed" });
  } catch (error) {
    console.error("Remove profile image error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const logout = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.userId, {
      isOnline: false,
      lastSeen: new Date(),
    });

    res.cookie("jwt", "", {
      maxAge: 1,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
    });

    return res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Both passwords are required" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters" });
    }

    const user = await User.findById(req.userId);
    const pepper = process.env.PEPPER_STRING || "";
    const salt = user.salt || "";
    const isValid = await bcrypt.compare(salt + currentPassword + pepper, user.password);

    if (!isValid) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    const newSalt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(newSalt + newPassword + pepper, 12);

    await User.findByIdAndUpdate(req.userId, {
      password: hashedPassword,
      salt: newSalt,
    });

    return res.status(200).json({ message: "Password changed successfully" });
  } catch (error) {
    console.error("Change password error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};
