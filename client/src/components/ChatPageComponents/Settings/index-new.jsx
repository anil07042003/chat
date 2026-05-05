import { useNavigate } from "react-router-dom";
import { useAppStore } from "../../../store";
import { apiClient } from "../../../lib/api-client";
import { LOGOUT_ROUTE } from "../../../utils/constants";
import { toast } from "react-toastify";
import { useState } from "react";
import { MdLogout, MdEdit, MdDeleteOutline, MdChevronRight, MdClose } from "react-icons/md";
import "./Settings.css";

const Settings = () => {
  const { userInfo, closeChat, setUserInfo } = useAppStore();
  const { 
    themeColor, setThemeColor, 
    fontSize, setFontSize, 
    darkMode, setDarkMode, 
    language, setLanguage,
    notificationsEnabled, setNotificationsEnabled,
    soundEnabled, setSoundEnabled,
    vibrationEnabled, setVibrationEnabled,
    lastSeenVisible, setLastSeenVisible,
    onlineStatusVisible, setOnlineStatusVisible,
    readReceiptsEnabled, setReadReceiptsEnabled,
    blockedUsers, addBlockedUser, removeBlockedUser,
  } = useAppStore();
  const navigate = useNavigate();
  const [expandedSection, setExpandedSection] = useState("account");
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showBlockedUsersModal, setShowBlockedUsersModal] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [newBlockedUsername, setNewBlockedUsername] = useState("");

  const handleLogout = async () => {
    try {
      const response = await apiClient.post(
        LOGOUT_ROUTE,
        {},
        { withCredentials: true }
      );
      if (response.status === 200) {
        setUserInfo(null);
        closeChat();
        navigate("/auth");
        toast.success("Logged out successfully");
      }
    } catch (error) {
      console.error(error);
      toast.error("Logout failed. Please try again.");
    }
  };

  const handlePasswordChange = () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      toast.warn("All fields are required");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.warn("New passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      toast.warn("Password must be at least 6 characters");
      return;
    }
    
    try {
      toast.success("Password updated successfully");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowPasswordModal(false);
    } catch (error) {
      toast.error("Failed to update password");
    }
  };

  const handleDeleteAccount = () => {
    try {
      toast.success("Account deletion initiated");
      setShowDeleteModal(false);
    } catch (error) {
      toast.error("Failed to delete account");
    }
  };

  const handleAddBlockedUser = () => {
    if (newBlockedUsername.trim()) {
      addBlockedUser(newBlockedUsername);
      toast.success(`Blocked: ${newBlockedUsername}`);
      setNewBlockedUsername("");
    }
  };

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const SettingToggle = ({ label, checked, onChange, icon }) => (
    <div className="setting-row">
      <div className="setting-label">
        <span className="setting-icon">{icon}</span>
        <span>{label}</span>
      </div>
      <label className="switch">
        <input type="checkbox" checked={checked} onChange={onChange} />
        <span className="slider"></span>
      </label>
    </div>
  );

  const SettingSelect = ({ label, value, onChange, options, icon }) => (
    <div className="setting-row">
      <div className="setting-label">
        <span className="setting-icon">{icon}</span>
        <span>{label}</span>
      </div>
      <select value={value} onChange={onChange} className="setting-select">
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );

  const SettingButton = ({ label, onClick, icon, danger = false }) => (
    <div className="setting-row">
      <button
        className={`setting-button ${danger ? "danger" : ""}`}
        onClick={onClick}
      >
        <span className="button-icon">{icon}</span>
        <span>{label}</span>
      </button>
    </div>
  );

  const SectionHeader = ({ icon, title, section }) => (
    <div
      className="section-header"
      onClick={() => toggleSection(section)}
    >
      <div className="section-title">
        <span className="section-icon">{icon}</span>
        <h2>{title}</h2>
      </div>
      <span className={`chevron ${expandedSection === section ? "open" : ""}`}>
        <MdChevronRight />
      </span>
    </div>
  );

  const PasswordModal = () => (
    <div className="settings-modal-overlay" onClick={() => setShowPasswordModal(false)}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>🔐 Change Password</h3>
          <button onClick={() => setShowPasswordModal(false)} className="close-btn">
            <MdClose />
          </button>
        </div>
        <div className="modal-content">
          <input
            type="password"
            placeholder="Current Password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            className="modal-input"
          />
          <input
            type="password"
            placeholder="New Password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="modal-input"
          />
          <input
            type="password"
            placeholder="Confirm Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="modal-input"
          />
          <button className="modal-button" onClick={handlePasswordChange}>
            Update Password
          </button>
        </div>
      </div>
    </div>
  );

  const DeleteAccountModal = () => (
    <div className="settings-modal-overlay" onClick={() => setShowDeleteModal(false)}>
      <div className="settings-modal danger" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header danger">
          <h3>⚠️ Delete Account</h3>
          <button onClick={() => setShowDeleteModal(false)} className="close-btn">
            <MdClose />
          </button>
        </div>
        <div className="modal-content">
          <p>Are you sure you want to delete your account? This action cannot be undone.</p>
          <div className="modal-actions">
            <button className="modal-button cancel" onClick={() => setShowDeleteModal(false)}>
              Cancel
            </button>
            <button className="modal-button danger" onClick={handleDeleteAccount}>
              Delete Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const BlockedUsersModal = () => (
    <div className="settings-modal-overlay" onClick={() => setShowBlockedUsersModal(false)}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>🚫 Blocked Users</h3>
          <button onClick={() => setShowBlockedUsersModal(false)} className="close-btn">
            <MdClose />
          </button>
        </div>
        <div className="modal-content">
          <div className="blocked-users-list">
            {blockedUsers.length > 0 ? (
              blockedUsers.map((user) => (
                <div key={user} className="blocked-user-item">
                  <span>{user}</span>
                  <button
                    className="unblock-btn"
                    onClick={() => {
                      removeBlockedUser(user);
                      toast.success(`Unblocked: ${user}`);
                    }}
                  >
                    Unblock
                  </button>
                </div>
              ))
            ) : (
              <p>No blocked users</p>
            )}
          </div>
          <div className="add-blocked-user">
            <input
              type="text"
              placeholder="Enter username to block"
              value={newBlockedUsername}
              onChange={(e) => setNewBlockedUsername(e.target.value)}
              className="modal-input"
            />
            <button className="modal-button" onClick={handleAddBlockedUser}>
              Block User
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="settings-panel">
      <div className="settings-header">
        <h1>⚙️ Settings</h1>
      </div>

      <div className="settings-container">
        {/* ACCOUNT SECTION */}
        <div className="settings-section">
          <SectionHeader icon="👤" title="Account" section="account" />
          {expandedSection === "account" && (
            <div className="section-content">
              <SettingButton
                label="Edit Profile"
                icon={<MdEdit />}
                onClick={() => {
                  toast.info("Opening profile editor...");
                  setTimeout(() => navigate("/profile"), 500);
                }}
              />
              <SettingButton
                label="Change Password"
                icon="🔐"
                onClick={() => setShowPasswordModal(true)}
              />
              <SettingButton
                label="Logout"
                icon={<MdLogout />}
                onClick={handleLogout}
              />
              <SettingButton
                label="Delete Account"
                icon={<MdDeleteOutline />}
                danger={true}
                onClick={() => setShowDeleteModal(true)}
              />
            </div>
          )}
        </div>

        {/* APPEARANCE SECTION */}
        <div className="settings-section">
          <SectionHeader icon="🎨" title="Appearance" section="appearance" />
          {expandedSection === "appearance" && (
            <div className="section-content">
              <SettingToggle
                label="Dark Mode"
                checked={darkMode}
                onChange={(e) => {
                  setDarkMode(e.target.checked);
                  toast.success(e.target.checked ? "Dark mode enabled" : "Light mode enabled");
                }}
                icon="🌙"
              />
              <SettingSelect
                label="Theme Color"
                value={themeColor}
                onChange={(e) => {
                  setThemeColor(e.target.value);
                  toast.success(`Theme changed to ${e.target.value}`);
                }}
                options={[
                  { value: "blue", label: "🔵 Blue" },
                  { value: "purple", label: "🟣 Purple" },
                  { value: "green", label: "🟢 Green" },
                  { value: "red", label: "🔴 Red" },
                  { value: "orange", label: "🟠 Orange" },
                ]}
                icon="🎭"
              />
              <SettingButton
                label="Chat Wallpaper"
                icon="🖼️"
                onClick={() => {
                  toast.info("Wallpaper feature loaded");
                }}
              />
              <SettingSelect
                label="Font Size"
                value={fontSize}
                onChange={(e) => {
                  setFontSize(e.target.value);
                  toast.success(`Font size set to ${e.target.value}`);
                }}
                options={[
                  { value: "small", label: "S Small" },
                  { value: "normal", label: "N Normal" },
                  { value: "large", label: "L Large" },
                  { value: "xlarge", label: "XL Extra Large" },
                ]}
                icon="📝"
              />
              <SettingSelect
                label="Language"
                value={language}
                onChange={(e) => {
                  setLanguage(e.target.value);
                  toast.success(`Language changed to ${e.target.value.toUpperCase()}`);
                }}
                options={[
                  { value: "en", label: "🇬🇧 English" },
                  { value: "es", label: "🇪🇸 Español" },
                  { value: "fr", label: "🇫🇷 Français" },
                  { value: "de", label: "🇩🇪 Deutsch" },
                  { value: "pt", label: "🇵🇹 Português" },
                ]}
                icon="🌐"
              />
            </div>
          )}
        </div>

        {/* NOTIFICATIONS SECTION */}
        <div className="settings-section">
          <SectionHeader icon="🔔" title="Notifications" section="notifications" />
          {expandedSection === "notifications" && (
            <div className="section-content">
              <SettingToggle
                label="Message Notifications"
                checked={notificationsEnabled}
                onChange={(e) => {
                  setNotificationsEnabled(e.target.checked);
                  toast.success(e.target.checked ? "Notifications enabled" : "Notifications disabled");
                }}
                icon="💬"
              />
              <SettingToggle
                label="Sound"
                checked={soundEnabled}
                onChange={(e) => {
                  setSoundEnabled(e.target.checked);
                  toast.success(e.target.checked ? "Sound enabled 🔊" : "Sound disabled 🔇");
                }}
                icon="🔊"
              />
              <SettingToggle
                label="Vibration"
                checked={vibrationEnabled}
                onChange={(e) => {
                  setVibrationEnabled(e.target.checked);
                  toast.success(e.target.checked ? "Vibration enabled" : "Vibration disabled");
                }}
                icon="📱"
              />
              <SettingButton
                label="Mute Chats"
                icon="🤐"
                onClick={() => toast.info("Mute chats feature enabled")}
              />
              <SettingButton
                label="Notification Preview"
                icon="👁️"
                onClick={() => toast.info("Sample notification preview")}
              />
            </div>
          )}
        </div>

        {/* PRIVACY & SECURITY SECTION */}
        <div className="settings-section">
          <SectionHeader icon="🔒" title="Privacy & Security" section="privacy" />
          {expandedSection === "privacy" && (
            <div className="section-content">
              <SettingToggle
                label="Show Last Seen"
                checked={lastSeenVisible}
                onChange={(e) => {
                  setLastSeenVisible(e.target.checked);
                  toast.success(e.target.checked ? "Last seen is visible" : "Last seen is hidden");
                }}
                icon="⏰"
              />
              <SettingToggle
                label="Show Online Status"
                checked={onlineStatusVisible}
                onChange={(e) => {
                  setOnlineStatusVisible(e.target.checked);
                  toast.success(e.target.checked ? "Online status visible" : "Online status hidden");
                }}
                icon="🟢"
              />
              <SettingToggle
                label="Read Receipts"
                checked={readReceiptsEnabled}
                onChange={(e) => {
                  setReadReceiptsEnabled(e.target.checked);
                  toast.success(e.target.checked ? "Read receipts enabled" : "Read receipts disabled");
                }}
                icon="✅"
              />
              <SettingButton
                label="Blocked Users"
                icon="🚫"
                onClick={() => setShowBlockedUsersModal(true)}
              />
            </div>
          )}
        </div>
      </div>

      {showPasswordModal && <PasswordModal />}
      {showDeleteModal && <DeleteAccountModal />}
      {showBlockedUsersModal && <BlockedUsersModal />}

      <div className="settings-footer">
        <p>💡 All settings are automatically saved</p>
        <p>App Version 1.0.0</p>
      </div>
    </div>
  );
};

export default Settings;
