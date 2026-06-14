import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "../../store";
import { apiClient } from "../../lib/api-client";
import {
  LOGOUT_ROUTE,
  UPDATE_EMAIL_ROUTE,
  CHANGE_PASSWORD_SETTINGS_ROUTE,
  DELETE_ACCOUNT_ROUTE,
} from "../../utils/constants";
import { toast } from "react-toastify";
import {
  IoMailOutline, IoLockClosedOutline, IoLogOutOutline,
  IoTrashOutline, IoEyeOutline, IoEyeOffOutline, IoCheckmarkCircle,
  IoShieldCheckmarkOutline,
} from "react-icons/io5";
import { SectionTitle, SettingsCard, SettingsRow, ConfirmModal, SaveButton } from "./SettingsUI";
import Spinner from "../ui/Spinner";

const AccountSettings = () => {
  const { userInfo, setUserInfo } = useAppStore();
  const navigate = useNavigate();

  const [section, setSection] = useState(null); // "email" | "password" | "delete"
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState({});

  const [emailForm, setEmailForm] = useState({ newEmail: "", currentPassword: "" });
  const [pwForm, setPwForm] = useState({ current: "", new: "", confirm: "" });
  const [deletePassword, setDeletePassword] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const togglePw = (k) => setShowPw((p) => ({ ...p, [k]: !p[k] }));

  // ── Change email ──────────────────────────────────────────────────────────
  const handleEmailChange = async () => {
    if (!emailForm.newEmail || !emailForm.currentPassword) {
      toast.error("All fields required"); return;
    }
    setLoading(true);
    try {
      const res = await apiClient.put(UPDATE_EMAIL_ROUTE, emailForm);
      setUserInfo((prev) => ({ ...prev, email: res.data.email }));
      setEmailForm({ newEmail: "", currentPassword: "" });
      setSection(null);
      toast.success("Email updated!");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to update email");
    } finally { setLoading(false); }
  };

  // ── Change password ───────────────────────────────────────────────────────
  const handlePasswordChange = async () => {
    if (!pwForm.current || !pwForm.new || !pwForm.confirm) {
      toast.error("All fields required"); return;
    }
    if (pwForm.new !== pwForm.confirm) {
      toast.error("Passwords don't match"); return;
    }
    if (pwForm.new.length < 6) {
      toast.error("Min 6 characters"); return;
    }
    setLoading(true);
    try {
      await apiClient.put(CHANGE_PASSWORD_SETTINGS_ROUTE, {
        currentPassword: pwForm.current,
        newPassword: pwForm.new,
      });
      setPwForm({ current: "", new: "", confirm: "" });
      setSection(null);
      toast.success("Password changed!");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to change password");
    } finally { setLoading(false); }
  };

  // ── Logout ────────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    try {
      await apiClient.post(LOGOUT_ROUTE);
      setUserInfo(undefined);
      navigate("/auth");
    } catch { toast.error("Logout failed"); }
  };

  // ── Delete account ────────────────────────────────────────────────────────
  const handleDeleteAccount = async () => {
    if (!deletePassword) { toast.error("Password required"); return; }
    setLoading(true);
    try {
      await apiClient.delete(DELETE_ACCOUNT_ROUTE, { data: { password: deletePassword } });
      setUserInfo(undefined);
      navigate("/auth");
      toast.success("Account deleted");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to delete account");
    } finally { setLoading(false); }
  };

  const PwInput = ({ field, label, placeholder }) => (
    <div className="mb-3">
      <label className="text-xs text-surface-400 mb-1 block">{label}</label>
      <div className="relative">
        <input
          type={showPw[field] ? "text" : "password"}
          value={pwForm[field]}
          onChange={(e) => setPwForm((p) => ({ ...p, [field]: e.target.value }))}
          placeholder={placeholder}
          className="w-full bg-surface-700 border border-surface-600 text-white placeholder-surface-500 rounded-xl px-3 py-2.5 text-sm pr-10 focus:outline-none focus:border-nexchat-500"
        />
        <button type="button" onClick={() => togglePw(field)} className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 p-1">
          {showPw[field] ? <IoEyeOffOutline size={16} /> : <IoEyeOutline size={16} />}
        </button>
      </div>
    </div>
  );

  return (
    <div>
      {/* Account info */}
      <SectionTitle>Account Info</SectionTitle>
      <SettingsCard>
        <SettingsRow
          icon={IoMailOutline}
          label="Email Address"
          sublabel={userInfo?.email}
          onClick={() => setSection(section === "email" ? null : "email")}
        />
        {section === "email" && (
          <div className="px-3 pb-4 space-y-3">
            <div>
              <label className="text-xs text-surface-400 mb-1 block">New Email</label>
              <input
                type="email"
                value={emailForm.newEmail}
                onChange={(e) => setEmailForm((p) => ({ ...p, newEmail: e.target.value }))}
                placeholder="new@email.com"
                className="w-full bg-surface-700 border border-surface-600 text-white placeholder-surface-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-nexchat-500"
              />
            </div>
            <div>
              <label className="text-xs text-surface-400 mb-1 block">Current Password</label>
              <div className="relative">
                <input
                  type={showPw.emailPw ? "text" : "password"}
                  value={emailForm.currentPassword}
                  onChange={(e) => setEmailForm((p) => ({ ...p, currentPassword: e.target.value }))}
                  placeholder="Confirm with password"
                  className="w-full bg-surface-700 border border-surface-600 text-white placeholder-surface-500 rounded-xl px-3 py-2.5 text-sm pr-10 focus:outline-none focus:border-nexchat-500"
                />
                <button type="button" onClick={() => togglePw("emailPw")} className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 p-1">
                  {showPw.emailPw ? <IoEyeOffOutline size={16} /> : <IoEyeOutline size={16} />}
                </button>
              </div>
            </div>
            <button onClick={handleEmailChange} disabled={loading} className="btn-primary w-full py-2.5 text-sm flex items-center justify-center gap-2">
              {loading && <Spinner size="sm" />} Update Email
            </button>
          </div>
        )}

        <SettingsRow
          icon={IoLockClosedOutline}
          label="Change Password"
          sublabel="Update your account password"
          onClick={() => setSection(section === "password" ? null : "password")}
        />
        {section === "password" && (
          <div className="px-3 pb-4 space-y-0">
            <PwInput field="current" label="Current Password" placeholder="Current password" />
            <PwInput field="new" label="New Password" placeholder="Min 6 characters" />
            <PwInput field="confirm" label="Confirm New Password" placeholder="Repeat new password" />
            <button onClick={handlePasswordChange} disabled={loading} className="btn-primary w-full py-2.5 text-sm flex items-center justify-center gap-2 mt-1">
              {loading && <Spinner size="sm" />} Change Password
            </button>
          </div>
        )}

        <SettingsRow
          icon={IoShieldCheckmarkOutline}
          iconColor="text-emerald-400"
          label="Account Status"
          sublabel="Active & verified"
          right={<span className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">Active</span>}
        />
      </SettingsCard>

      {/* Session */}
      <SectionTitle>Session</SectionTitle>
      <SettingsCard>
        <SettingsRow
          icon={IoLogOutOutline}
          iconColor="text-amber-400"
          label="Sign Out"
          sublabel="Sign out of this device"
          onClick={handleLogout}
        />
      </SettingsCard>

      {/* Danger zone */}
      <SectionTitle>Danger Zone</SectionTitle>
      <SettingsCard>
        <SettingsRow
          icon={IoTrashOutline}
          iconColor="text-rose-400"
          label="Delete Account"
          sublabel="Permanently delete your account and all data"
          danger
          onClick={() => setShowDeleteConfirm(true)}
        />
      </SettingsCard>

      {/* Delete confirm modal */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="Delete Account"
        message="This action is permanent and cannot be undone. All your messages, contacts, and data will be deleted."
        confirmLabel="Delete Account"
        confirmDanger
        loading={loading}
        onConfirm={handleDeleteAccount}
        onCancel={() => { setShowDeleteConfirm(false); setDeletePassword(""); }}
      >
        <div className="mb-2">
          <label className="text-xs text-surface-400 mb-1 block">Enter your password to confirm</label>
          <input
            type="password"
            value={deletePassword}
            onChange={(e) => setDeletePassword(e.target.value)}
            placeholder="Your password"
            className="w-full bg-surface-800 border border-surface-700 text-white placeholder-surface-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-rose-500"
          />
        </div>
      </ConfirmModal>
    </div>
  );
};

export default AccountSettings;
