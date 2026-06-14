import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import {
  IoCallOutline,
  IoCheckmarkDoneOutline,
  IoCreateOutline,
  IoEyeOutline,
  IoImageOutline,
  IoInformationCircleOutline,
  IoPeopleOutline,
  IoPersonRemoveOutline,
  IoSaveOutline,
  IoTimeOutline,
} from "react-icons/io5";
import { useAppStore } from "../../store";
import { apiClient } from "../../lib/api-client";
import {
  GET_BLOCKED_USERS_ROUTE,
  UNBLOCK_USER_SETTINGS_ROUTE,
  UPDATE_PRIVACY_ROUTE,
} from "../../utils/constants";
import { getFullName } from "../../utils/helpers";
import Avatar from "../ui/Avatar";
import Spinner from "../ui/Spinner";

const visibilityOptions = [
  { value: "everyone", label: "Everyone" },
  { value: "contacts", label: "Contacts only" },
  { value: "nobody", label: "Nobody" },
];

const privacyDefaults = {
  lastSeen: "everyone",
  onlineStatus: true,
  profilePhoto: "everyone",
  bioAbout: "everyone",
  readReceipts: true,
  typingIndicator: true,
  allowCalls: "everyone",
  groupInvites: "everyone",
};

const PRIVACY_STORAGE_KEY = "baatchitPrivacySettings";

const getStoredPrivacy = () => {
  if (typeof window === "undefined") return {};

  try {
    return JSON.parse(localStorage.getItem(PRIVACY_STORAGE_KEY)) || {};
  } catch {
    return {};
  }
};

const saveStoredPrivacy = (privacy) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(PRIVACY_STORAGE_KEY, JSON.stringify(privacy));
};

const getPrivacyFromUser = (privacySettings = {}) => ({
  lastSeen: privacySettings.lastSeenVisible ?? privacyDefaults.lastSeen,
  onlineStatus:
    privacySettings.onlineStatusVisible ?? privacyDefaults.onlineStatus,
  profilePhoto:
    privacySettings.profilePhotoVisible ?? privacyDefaults.profilePhoto,
  bioAbout: privacySettings.bioVisible ?? privacyDefaults.bioAbout,
  readReceipts:
    privacySettings.readReceiptsEnabled ?? privacyDefaults.readReceipts,
  typingIndicator:
    privacySettings.typingIndicatorEnabled ?? privacyDefaults.typingIndicator,
  allowCalls: privacySettings.allowCallsFrom ?? privacyDefaults.allowCalls,
  groupInvites:
    privacySettings.allowGroupInvitesFrom ?? privacyDefaults.groupInvites,
});

const getApiPayload = (privacy) => ({
  lastSeenVisible: privacy.lastSeen,
  onlineStatusVisible: privacy.onlineStatus,
  profilePhotoVisible: privacy.profilePhoto,
  bioVisible: privacy.bioAbout,
  readReceiptsEnabled: privacy.readReceipts,
  typingIndicatorEnabled: privacy.typingIndicator,
  allowCallsFrom: privacy.allowCalls,
  allowGroupInvitesFrom: privacy.groupInvites,
});

const isSamePrivacy = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const selectClassName =
  "w-full min-w-[150px] cursor-pointer rounded-[14px] border border-[#2a2a35] bg-[#101014] bg-[linear-gradient(135deg,rgba(255,255,255,0.045),rgba(255,255,255,0.015))] px-3 py-2.5 text-sm font-medium text-white shadow-inner shadow-black/20 outline-none transition-all duration-300 hover:-translate-y-0.5 hover:border-[#8b5cf6]/65 hover:bg-[#14141a] focus:border-[#8b5cf6] focus:ring-2 focus:ring-[#8b5cf6]/25 sm:w-44";

const PrivacySettings = () => {
  const { userInfo, setUserInfo } = useAppStore();
  const initialPrivacy = useMemo(
    () => ({
      ...getPrivacyFromUser(userInfo?.privacySettings),
      ...getStoredPrivacy(),
    }),
    [userInfo?.privacySettings]
  );

  const [privacy, setPrivacy] = useState(initialPrivacy);
  const [savedPrivacy, setSavedPrivacy] = useState(initialPrivacy);
  const [saving, setSaving] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [loadingBlocked, setLoadingBlocked] = useState(false);
  const [unblockingId, setUnblockingId] = useState(null);

  const hasChanges = !isSamePrivacy(privacy, savedPrivacy);

  useEffect(() => {
    setPrivacy(initialPrivacy);
    setSavedPrivacy(initialPrivacy);
  }, [initialPrivacy]);

  useEffect(() => {
    saveStoredPrivacy(privacy);
  }, [privacy]);

  useEffect(() => {
    loadBlockedUsers();
  }, []);

  const loadBlockedUsers = async () => {
    setLoadingBlocked(true);
    try {
      const res = await apiClient.get(GET_BLOCKED_USERS_ROUTE);
      setBlockedUsers(res.data.blockedUsers || []);
    } catch (err) {
      console.warn("Failed to load blocked users", err);
    } finally {
      setLoadingBlocked(false);
    }
  };

  const updateSetting = (key, value) => {
    console.log("Privacy setting changed:", key, value);
    setPrivacy((current) => ({ ...current, [key]: value }));
  };

  const toggleSetting = (key) => {
    setPrivacy((current) => {
      const nextValue = !current[key];
      console.log("Privacy toggle clicked:", key, nextValue);
      return { ...current, [key]: nextValue };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = getApiPayload(privacy);
      const res = await apiClient.put(UPDATE_PRIVACY_ROUTE, payload);
      const savedApiPrivacy = res.data.privacySettings || payload;
      const nextPrivacy = getPrivacyFromUser(savedApiPrivacy);

      setPrivacy(nextPrivacy);
      setSavedPrivacy(nextPrivacy);
      saveStoredPrivacy(nextPrivacy);
      setUserInfo((prev) => {
        if (!prev) return prev;

        return {
          ...prev,
          isOnline: nextPrivacy.onlineStatus ? prev.isOnline : false,
          privacySettings: {
            ...(prev.privacySettings || {}),
            ...savedApiPrivacy,
          },
        };
      });

      toast.success("Privacy settings saved");
    } catch (err) {
      toast.error(
        err.response?.data?.error || "Failed to save privacy settings"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleUnblock = async (userId) => {
    setUnblockingId(userId);
    try {
      await apiClient.post(UNBLOCK_USER_SETTINGS_ROUTE, { userId });
      setBlockedUsers((prev) => prev.filter((user) => user._id !== userId));
      toast.success("User unblocked");
    } catch {
      toast.error("Failed to unblock user");
    } finally {
      setUnblockingId(null);
    }
  };

  return (
    <div className="relative isolate min-h-full overflow-y-auto bg-[#050507] px-3 py-4 text-white sm:px-5 sm:py-6 lg:px-8">
      <div className="pointer-events-none absolute left-1/2 top-4 -z-10 h-48 w-[min(760px,92vw)] -translate-x-1/2 rounded-full bg-[#8b5cf6]/16 blur-3xl" />
      <div className="mx-auto flex w-full max-w-[900px] animate-[privacyFadeIn_0.35s_ease-out] flex-col gap-6 pb-24 sm:gap-8">
        <header className="group relative isolate overflow-hidden rounded-[20px] border border-[#2a2a35]/90 bg-[#18181d]/72 p-5 shadow-2xl shadow-black/35 backdrop-blur-2xl transition-all duration-300 hover:-translate-y-0.5 hover:border-[#8b5cf6]/35 hover:shadow-[#8b5cf6]/10 sm:p-7">
          <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-[#8b5cf6]/20 blur-3xl transition-opacity duration-300 group-hover:opacity-90" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.16),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.07),rgba(255,255,255,0.015))]" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8b5cf6]">
              BaatChit Privacy
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Privacy Settings
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[#a1a1aa]">
              Control who can see your activity, contact you, and invite you.
            </p>
          </div>

          {hasChanges ? (
            <span className="w-fit rounded-full border border-[#8b5cf6]/40 bg-[#8b5cf6]/10 px-3 py-1 text-xs font-medium text-[#c4b5fd]">
              Unsaved changes
            </span>
          ) : null}
          </div>
        </header>

        <SettingsSection title="Visibility">
          <SettingRow
            icon={IoTimeOutline}
            iconColor="text-sky-300"
            iconBg="from-sky-500/22 to-sky-400/5"
            title="Last Seen"
            description="Choose who can see when you were last active."
            control={
              <select
                value={privacy.lastSeen}
                onChange={(event) =>
                  updateSetting("lastSeen", event.target.value)
                }
                className={selectClassName}
              >
                {visibilityOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            }
          />
          <SettingRow
            icon={IoEyeOutline}
            iconColor="text-emerald-300"
            iconBg="from-emerald-500/22 to-emerald-400/5"
            title="Online Status"
            description={
              privacy.onlineStatus
                ? "People can see when you are online."
                : "Your online status is hidden."
            }
            control={
              <ToggleSwitch
                checked={privacy.onlineStatus}
                onChange={() => toggleSetting("onlineStatus")}
                label="Online Status"
              />
            }
          />
          <SettingRow
            icon={IoImageOutline}
            iconColor="text-violet-300"
            iconBg="from-violet-500/24 to-fuchsia-400/5"
            title="Profile Photo"
            description="Control who can view your display picture."
            control={
              <select
                value={privacy.profilePhoto}
                onChange={(event) =>
                  updateSetting("profilePhoto", event.target.value)
                }
                className={selectClassName}
              >
                {visibilityOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            }
          />
          <SettingRow
            icon={IoInformationCircleOutline}
            iconColor="text-amber-300"
            iconBg="from-amber-500/22 to-orange-400/5"
            title="Bio / About"
            description="Control who can read your profile about text."
            control={
              <select
                value={privacy.bioAbout}
                onChange={(event) =>
                  updateSetting("bioAbout", event.target.value)
                }
                className={selectClassName}
              >
                {visibilityOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            }
          />
        </SettingsSection>

        <SettingsSection title="Messaging">
          <SettingRow
            icon={IoCheckmarkDoneOutline}
            iconColor="text-cyan-300"
            iconBg="from-cyan-500/22 to-blue-400/5"
            title="Read Receipts"
            description={
              privacy.readReceipts
                ? "Others can see when you have read their messages."
                : "Read receipts are hidden for both sides."
            }
            control={
              <ToggleSwitch
                checked={privacy.readReceipts}
                onChange={() => toggleSetting("readReceipts")}
                label="Read Receipts"
              />
            }
          />
          <SettingRow
            icon={IoCreateOutline}
            iconColor="text-pink-300"
            iconBg="from-pink-500/22 to-rose-400/5"
            title="Typing Indicator"
            description={
              privacy.typingIndicator
                ? "Others can see when you are typing."
                : "Your typing indicator is hidden."
            }
            control={
              <ToggleSwitch
                checked={privacy.typingIndicator}
                onChange={() => toggleSetting("typingIndicator")}
                label="Typing Indicator"
              />
            }
          />
        </SettingsSection>

        <SettingsSection title="Calls & Groups">
          <SettingRow
            icon={IoCallOutline}
            iconColor="text-rose-300"
            iconBg="from-rose-500/22 to-red-400/5"
            title="Allow Calls"
            description="Choose who can start voice or video calls with you."
            control={
              <select
                value={privacy.allowCalls}
                onChange={(event) =>
                  updateSetting("allowCalls", event.target.value)
                }
                className={selectClassName}
              >
                {visibilityOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            }
          />
          <SettingRow
            icon={IoPeopleOutline}
            iconColor="text-teal-300"
            iconBg="from-teal-500/22 to-emerald-400/5"
            title="Group Invites"
            description="Choose who can add you to group chats."
            control={
              <select
                value={privacy.groupInvites}
                onChange={(event) =>
                  updateSetting("groupInvites", event.target.value)
                }
                className={selectClassName}
              >
                {visibilityOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            }
          />
        </SettingsSection>

        <div className="sticky bottom-0 z-20 -mx-3 border-t border-[#2a2a35]/80 bg-[#050507]/88 px-3 py-3 shadow-[0_-18px_40px_rgba(5,5,7,0.72)] backdrop-blur-2xl sm:-mx-5 sm:px-5 lg:-mx-8 lg:px-8">
          <div className="mx-auto max-w-[900px]">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className="flex w-full items-center justify-center gap-2 rounded-[14px] border border-[#a78bfa]/40 bg-[linear-gradient(135deg,#8b5cf6,#6d28d9)] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-[#8b5cf6]/25 transition-all duration-300 hover:-translate-y-0.5 hover:scale-[1.005] hover:shadow-[#8b5cf6]/35 active:translate-y-0 active:scale-[0.99] disabled:translate-y-0 disabled:scale-100 disabled:cursor-not-allowed disabled:border-[#2a2a35] disabled:bg-none disabled:bg-[#18181d] disabled:text-[#71717a] disabled:shadow-none"
            >
              {saving ? <Spinner size="sm" /> : <IoSaveOutline size={18} />}
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>

        <SettingsSection title={`Blocked Users (${blockedUsers.length})`}>
          {loadingBlocked ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : blockedUsers.length === 0 ? (
            <div className="flex flex-col items-center px-4 py-10 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-[18px] border border-[#2a2a35] bg-[#8b5cf6]/10">
                <IoPersonRemoveOutline size={24} className="text-[#a78bfa]" />
              </div>
              <p className="text-sm font-medium text-white">No blocked users</p>
              <p className="mt-1 text-xs text-[#8b8b98]">
                People you block will appear here.
              </p>
            </div>
          ) : (
            blockedUsers.map((user) => (
              <div
                key={user._id}
                className="flex items-center gap-3 border-b border-[#2a2a35]/80 px-4 py-3 transition-colors duration-200 hover:bg-white/[0.03] last:border-0 sm:px-5"
              >
                <Avatar user={user} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">
                    {getFullName(user)}
                  </p>
                  <p className="truncate text-xs text-[#8b8b98]">
                    {user.email}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleUnblock(user._id)}
                  disabled={unblockingId === user._id}
                  className="relative z-10 rounded-[14px] border border-[#2a2a35] bg-[#101014] px-3 py-2 text-xs font-medium text-white transition hover:border-[#8b5cf6] hover:text-[#c4b5fd] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {unblockingId === user._id ? "..." : "Unblock"}
                </button>
              </div>
            ))
          )}
        </SettingsSection>
      </div>
    </div>
  );
};

const SettingsSection = ({ title, children }) => (
  <section className="group/section scroll-mt-4 transition-all duration-300 hover:-translate-y-1">
    <h3 className="mb-3 px-1 text-xs font-bold uppercase tracking-[0.22em] text-[#c4b5fd] sm:text-sm">
      {title}
    </h3>
    <div className="overflow-hidden rounded-[20px] border border-[#2a2a35] bg-[#18181d]/86 shadow-xl shadow-black/25 backdrop-blur-xl transition-all duration-300 group-hover/section:border-[#8b5cf6]/30 group-hover/section:shadow-2xl group-hover/section:shadow-black/35">
      {children}
    </div>
  </section>
);

export const SettingRow = ({
  icon: Icon,
  iconColor = "text-violet-300",
  iconBg = "from-violet-500/24 to-fuchsia-400/5",
  title,
  description,
  control,
}) => (
  <div className="group flex min-w-0 cursor-default flex-col gap-3 border-b border-[#2a2a35]/80 px-4 py-4 transition-all duration-300 hover:bg-white/[0.045] last:border-0 sm:flex-row sm:items-center sm:px-5 sm:py-4">
    <div className="flex min-w-0 flex-1 items-start gap-3">
      <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[16px] border border-white/5 bg-gradient-to-br ${iconBg} shadow-inner shadow-white/[0.02] ring-1 ring-black/10 transition-all duration-300 group-hover:scale-[1.06] group-hover:shadow-lg`}>
        <Icon size={18} className={iconColor} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="mt-1 text-sm leading-5 text-[#a1a1aa]">{description}</p>
      </div>
    </div>
    <div className="relative z-10 flex w-full flex-shrink-0 items-center justify-end pointer-events-auto sm:w-auto sm:min-w-[176px]">
      {control}
    </div>
  </div>
);

export const ToggleSwitch = ({ checked, onChange, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    onClick={onChange}
    className={[
      "relative z-10 h-7 w-12 flex-shrink-0 rounded-full border p-1 transition-all duration-300 ease-out",
      "cursor-pointer pointer-events-auto focus:outline-none focus:ring-2 focus:ring-[#8b5cf6]/45 focus:ring-offset-2 focus:ring-offset-[#18181d]",
      checked
        ? "border-[#a78bfa]/60 bg-[linear-gradient(135deg,#a78bfa,#7c3aed)] shadow-lg shadow-[#8b5cf6]/35"
        : "border-[#2a2a35] bg-[#101014] hover:border-[#8b5cf6]/60",
    ].join(" ")}
  >
    <span
      className={[
        "block h-5 w-5 rounded-full bg-white shadow-md ring-1 ring-black/10 transition-transform duration-300 ease-out",
        checked ? "translate-x-5" : "translate-x-0",
      ].join(" ")}
    />
  </button>
);

export default PrivacySettings;
