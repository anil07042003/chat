import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema({
  deviceName: { type: String },
  deviceType: { type: String, enum: ["mobile", "desktop", "tablet", "unknown"], default: "unknown" },
  browser: { type: String },
  os: { type: String },
  ip: { type: String },
  location: { type: String },
  lastActive: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
}, { _id: true });

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    salt: { type: String },
    username: { type: String, unique: true, sparse: true, trim: true },
    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    bio: { type: String, maxlength: 200, default: "" },
    phone: { type: String, default: "" },
    image: { type: String },
    color: { type: Number, default: 0 },
    profileSetup: { type: Boolean, default: false },

    // Online presence
    isOnline: { type: Boolean, default: false },
    lastSeen: { type: Date, default: Date.now },

    // Social
    friendRequests: [{ type: String }],
    friends: [{ type: String }],
    blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "Users" }],

    // Privacy settings
    privacySettings: {
      lastSeenVisible: { type: String, enum: ["everyone", "contacts", "nobody"], default: "everyone" },
      onlineStatusVisible: { type: Boolean, default: true },
      readReceiptsEnabled: { type: Boolean, default: true },
      typingIndicatorEnabled: { type: Boolean, default: true },
      profilePhotoVisible: { type: String, enum: ["everyone", "contacts", "nobody"], default: "everyone" },
      bioVisible: { type: String, enum: ["everyone", "contacts", "nobody"], default: "everyone" },
      allowCallsFrom: { type: String, enum: ["everyone", "contacts"], default: "everyone" },
      allowGroupInvitesFrom: { type: String, enum: ["everyone", "contacts"], default: "everyone" },
    },

    // Notification settings
    notificationSettings: {
      messageNotifications: { type: Boolean, default: true },
      groupNotifications: { type: Boolean, default: true },
      callNotifications: { type: Boolean, default: true },
      soundEnabled: { type: Boolean, default: true },
      vibrationEnabled: { type: Boolean, default: true },
      desktopNotifications: { type: Boolean, default: true },
      previewMessages: { type: Boolean, default: true },
      mutedChats: [{ type: String }],
    },

    // Chat settings
    chatSettings: {
      enterToSend: { type: Boolean, default: true },
      mediaAutoDownload: { type: Boolean, default: true },
      messagePreview: { type: Boolean, default: true },
      fontSize: { type: String, enum: ["small", "medium", "large"], default: "medium" },
      wallpaper: { type: String, default: "" },
    },

    // Appearance
    theme: { type: String, enum: ["dark", "light", "system"], default: "dark" },
    accentColor: { type: String, default: "violet" },
    uiDensity: { type: String, enum: ["compact", "normal", "comfortable"], default: "normal" },
    animationsEnabled: { type: Boolean, default: true },

    // Security
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: { type: String },
    sessions: [sessionSchema],
    loginAlerts: { type: Boolean, default: true },

    // Storage
    storageUsed: { type: Number, default: 0 },
  },
  { timestamps: true }
);

userSchema.index({ email: 1 });
userSchema.index({ username: 1 });

const User = mongoose.model("Users", userSchema);
export default User;
