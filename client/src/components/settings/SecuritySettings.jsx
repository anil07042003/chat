import { useState, useEffect } from "react";
import { useAppStore } from "../../store";
import { apiClient } from "../../lib/api-client";
import { GET_SESSIONS_ROUTE, REVOKE_SESSION_ROUTE } from "../../utils/constants";
import { toast } from "react-toastify";
import moment from "moment";
import {
  IoPhonePortraitOutline, IoDesktopOutline, IoTabletPortraitOutline,
  IoTrashOutline, IoShieldCheckmarkOutline, IoAlertCircleOutline,
  IoTimeOutline, IoLocationOutline, IoRefreshOutline,
} from "react-icons/io5";
import { SectionTitle, SettingsCard, SettingsRow, Toggle, ConfirmModal } from "./SettingsUI";
import Spinner from "../ui/Spinner";

const DeviceIcon = ({ type }) => {
  if (type === "mobile")  return <IoPhonePortraitOutline  size={18} className="text-nexchat-400" />;
  if (type === "tablet")  return <IoTabletPortraitOutline size={18} className="text-blue-400"    />;
  return <IoDesktopOutline size={18} className="text-emerald-400" />;
};

const SecuritySettings = () => {
  const { userInfo, setUserInfo } = useAppStore();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState(null);
  const [showRevokeAll, setShowRevokeAll] = useState(false);
  const [revokingAll, setRevokingAll] = useState(false);
  const [savingAlerts, setSavingAlerts] = useState(false);

  // loginAlerts is stored on userInfo
  const loginAlerts = userInfo?.loginAlerts !== false; // default true

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(GET_SESSIONS_ROUTE);
      setSessions(res.data.sessions || []);
    } catch {
      toast.error("Failed to load sessions");
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (sessionId) => {
    setRevoking(sessionId);
    try {
      await apiClient.delete(`${REVOKE_SESSION_ROUTE}/${sessionId}`);
      setSessions((prev) => prev.filter((s) => s._id !== sessionId));
      toast.success("Session revoked");
    } catch {
      toast.error("Failed to revoke session");
    } finally {
      setRevoking(null);
    }
  };

  const handleRevokeAll = async () => {
    setRevokingAll(true);
    try {
      await apiClient.delete(REVOKE_SESSION_ROUTE);
      // Keep only the first session (current device)
      setSessions((prev) => prev.slice(0, 1));
      setShowRevokeAll(false);
      toast.success("All other sessions revoked");
    } catch {
      toast.error("Failed to revoke sessions");
    } finally {
      setRevokingAll(false);
    }
  };

  const handleToggleLoginAlerts = async (value) => {
    setSavingAlerts(true);
    try {
      await apiClient.put("api/settings/security-prefs", { loginAlerts: value });
      setUserInfo((prev) => ({ ...prev, loginAlerts: value }));
      toast.success(value ? "Login alerts enabled" : "Login alerts disabled");
    } catch {
      toast.error("Failed to update login alerts");
    } finally {
      setSavingAlerts(false);
    }
  };

  return (
    <div>
      <SectionTitle>Security Status</SectionTitle>
      <SettingsCard>
        <SettingsRow
          icon={IoShieldCheckmarkOutline}
          iconColor="text-emerald-400"
          label="Account Security"
          sublabel="Password protected with bcrypt hashing"
          right={
            <span className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">
              Secure
            </span>
          }
        />
        <SettingsRow
          icon={IoAlertCircleOutline}
          iconColor="text-amber-400"
          label="Login Alerts"
          sublabel="Get notified when a new device signs in"
          right={
            savingAlerts
              ? <Spinner size="sm" />
              : <Toggle checked={loginAlerts} onChange={handleToggleLoginAlerts} />
          }
        />
      </SettingsCard>

      <SectionTitle>Active Sessions ({sessions.length})</SectionTitle>

      {sessions.length > 1 && (
        <div className="mx-2 sm:mx-3 mb-3 flex gap-2">
          <button
            onClick={() => setShowRevokeAll(true)}
            className="flex-1 py-2.5 text-xs sm:text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl hover:bg-rose-500/20 transition-colors leading-tight px-2"
          >
            Revoke All Other Sessions
          </button>
          <button
            onClick={loadSessions}
            className="p-2.5 text-surface-400 bg-surface-800 border border-surface-700 rounded-xl hover:bg-surface-700 transition-colors flex-shrink-0"
            title="Refresh sessions"
          >
            <IoRefreshOutline size={16} />
          </button>
        </div>
      )}

      <SettingsCard>
        {loading ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-center">
            <IoDesktopOutline size={28} className="text-surface-600 mb-2" />
            <p className="text-sm text-surface-500">No sessions recorded</p>
            <p className="text-xs text-surface-600 mt-1">Sessions are logged on each login</p>
            <button
              onClick={loadSessions}
              className="mt-3 text-xs text-nexchat-400 hover:text-nexchat-300 transition-colors"
            >
              Refresh
            </button>
          </div>
        ) : (
          sessions.map((session, i) => (
            <div
              key={session._id}
              className="flex items-start gap-2.5 px-3 py-3 border-b border-surface-700/50 last:border-0"
            >
              {/* Device icon */}
              <div className="w-8 h-8 rounded-xl bg-surface-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                <DeviceIcon type={session.deviceType} />
              </div>

              {/* Session info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="text-sm font-medium text-white break-all leading-snug">
                    {session.deviceName || session.browser || "Unknown Device"}
                  </p>
                  {i === 0 && (
                    <span className="text-[10px] bg-nexchat-600/20 text-nexchat-400 border border-nexchat-600/30 px-1.5 py-0.5 rounded-full flex-shrink-0">
                      Current
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5">
                  {session.os && (
                    <span className="text-xs text-surface-500">{session.os}</span>
                  )}
                  {session.ip && (
                    <span className="text-xs text-surface-600 break-all">{session.ip}</span>
                  )}
                  {session.location && (
                    <span className="flex items-center gap-0.5 text-xs text-surface-500">
                      <IoLocationOutline size={10} /> {session.location}
                    </span>
                  )}
                  <span className="flex items-center gap-0.5 text-xs text-surface-500">
                    <IoTimeOutline size={10} />
                    {moment(session.lastActive).fromNow()}
                  </span>
                </div>
              </div>

              {/* Revoke button */}
              {i !== 0 && (
                <button
                  onClick={() => handleRevoke(session._id)}
                  disabled={revoking === session._id}
                  className="p-1.5 rounded-lg hover:bg-rose-500/20 text-surface-500 hover:text-rose-400 transition-colors flex-shrink-0"
                  title="Revoke this session"
                >
                  {revoking === session._id
                    ? <Spinner size="sm" />
                    : <IoTrashOutline size={15} />
                  }
                </button>
              )}
            </div>
          ))
        )}
      </SettingsCard>

      <ConfirmModal
        isOpen={showRevokeAll}
        title="Revoke All Other Sessions"
        message="This will sign you out from all other devices. You'll remain signed in on this device only."
        confirmLabel="Revoke All"
        confirmDanger
        loading={revokingAll}
        onConfirm={handleRevokeAll}
        onCancel={() => setShowRevokeAll(false)}
      />
    </div>
  );
};

export default SecuritySettings;
