import { useState, useEffect } from "react";
import { apiClient } from "../../lib/api-client";
import { GET_STORAGE_ROUTE, DELETE_MEDIA_ROUTE } from "../../utils/constants";
import { formatFileSize } from "../../utils/helpers";
import {
  IoImageOutline, IoVideocamOutline, IoMusicalNoteOutline,
  IoDocumentOutline, IoTrashOutline, IoRefreshOutline, IoAlertCircleOutline,
} from "react-icons/io5";
import { SectionTitle, SettingsCard, SettingsRow, ConfirmModal } from "./SettingsUI";
import Spinner from "../ui/Spinner";
import { toast } from "react-toastify";

const TYPE_META = {
  image: { icon: IoImageOutline,      color: "text-violet-400",  label: "Images", bar: "bg-violet-500"  },
  video: { icon: IoVideocamOutline,   color: "text-blue-400",    label: "Videos", bar: "bg-blue-500"    },
  audio: { icon: IoMusicalNoteOutline, color: "text-emerald-400", label: "Audio",  bar: "bg-emerald-500" },
  voice: { icon: IoMusicalNoteOutline, color: "text-cyan-400",    label: "Voice",  bar: "bg-cyan-500"    },
  file:  { icon: IoDocumentOutline,   color: "text-amber-400",   label: "Files",  bar: "bg-amber-500"   },
};

const StorageSettings = () => {
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showDeleteMediaConfirm, setShowDeleteMediaConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [deletingMedia, setDeletingMedia] = useState(false);

  const loadStorage = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(GET_STORAGE_ROUTE);
      setInfo(res.data);
    } catch {
      toast.error("Failed to load storage info");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStorage();
  }, []);

  const handleClearCache = async () => {
    setClearing(true);
    try {
      if ("caches" in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((name) => caches.delete(name)));
      }
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith("nexchat_")) localStorage.removeItem(key);
      });
      sessionStorage.clear();
      setShowClearConfirm(false);
      toast.success("Cache cleared successfully!");
    } catch {
      toast.error("Failed to clear cache");
    } finally {
      setClearing(false);
    }
  };

  const handleDeleteAllMedia = async () => {
    setDeletingMedia(true);
    try {
      await apiClient.delete(DELETE_MEDIA_ROUTE);
      setShowDeleteMediaConfirm(false);
      toast.success("All sent media deleted");
      loadStorage(); // refresh stats
    } catch {
      toast.error("Failed to delete media");
    } finally {
      setDeletingMedia(false);
    }
  };

  const totalBytes = info?.totalBytes || 0;
  const byType = info?.byType || {};

  return (
    <div>
      <SectionTitle>Storage Usage</SectionTitle>
      <SettingsCard>
        {loading ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : (
          <div className="p-3">
            <div className="flex items-end justify-between mb-3">
              <div>
                <p className="text-xl font-bold text-white">{formatFileSize(totalBytes)}</p>
                <p className="text-xs text-surface-500 mt-0.5">{info?.fileCount || 0} files sent</p>
              </div>
              <button
                onClick={loadStorage}
                className="p-2 rounded-lg hover:bg-surface-700 text-surface-400 hover:text-white transition-colors flex-shrink-0"
                title="Refresh"
              >
                <IoRefreshOutline size={15} />
              </button>
            </div>

            {/* Stacked bar */}
            {totalBytes > 0 && (
              <div className="h-3 bg-surface-700 rounded-full overflow-hidden flex mb-4">
                {Object.entries(byType).map(([type, bytes]) => {
                  const meta = TYPE_META[type];
                  if (!meta || !bytes) return null;
                  const pct = Math.max(2, (bytes / totalBytes) * 100);
                  return (
                    <div
                      key={type}
                      className={`h-full ${meta.bar} transition-all`}
                      style={{ width: `${pct}%` }}
                      title={`${meta.label}: ${formatFileSize(bytes)}`}
                    />
                  );
                })}
              </div>
            )}

            {/* Breakdown */}
            <div className="space-y-2">
              {Object.entries(TYPE_META).map(([type, meta]) => {
                const bytes = byType[type] || 0;
                if (!bytes) return null;
                const pct = totalBytes > 0 ? ((bytes / totalBytes) * 100).toFixed(1) : 0;
                return (
                  <div key={type} className="flex items-center gap-2 sm:gap-3">
                    <div className={`w-2 h-2 rounded-full ${meta.bar} flex-shrink-0`} />
                    <meta.icon size={14} className={`${meta.color} flex-shrink-0`} />
                    <span className="text-sm text-surface-300 flex-1 min-w-0 truncate">{meta.label}</span>
                    <span className="text-xs text-surface-500 flex-shrink-0">{pct}%</span>
                    <span className="text-xs text-white font-medium flex-shrink-0 min-w-[52px] text-right">
                      {formatFileSize(bytes)}
                    </span>
                  </div>
                );
              })}
              {totalBytes === 0 && (
                <p className="text-sm text-surface-500 text-center py-4">
                  No media files sent yet
                </p>
              )}
            </div>
          </div>
        )}
      </SettingsCard>

      <SectionTitle>Manage Storage</SectionTitle>
      <SettingsCard>
        <SettingsRow
          icon={IoTrashOutline}
          iconColor="text-rose-400"
          label="Clear Cache"
          sublabel="Remove temporary browser data and cached files"
          onClick={() => setShowClearConfirm(true)}
        />
        <SettingsRow
          icon={IoRefreshOutline}
          iconColor="text-blue-400"
          label="Refresh Storage Info"
          sublabel="Recalculate your storage usage"
          onClick={loadStorage}
        />
        {info?.totalBytes > 0 && (
          <SettingsRow
            icon={IoAlertCircleOutline}
            iconColor="text-amber-400"
            label="Delete All Sent Media"
            sublabel="Permanently remove all media files you have sent"
            danger
            onClick={() => setShowDeleteMediaConfirm(true)}
          />
        )}
      </SettingsCard>

      <ConfirmModal
        isOpen={showClearConfirm}
        title="Clear Cache"
        message="This will clear temporary browser files and cached data. Your messages and media files will not be deleted."
        confirmLabel="Clear Cache"
        loading={clearing}
        onConfirm={handleClearCache}
        onCancel={() => setShowClearConfirm(false)}
      />

      <ConfirmModal
        isOpen={showDeleteMediaConfirm}
        title="Delete All Sent Media"
        message="This will permanently delete all media files you have sent (images, videos, audio, documents). This cannot be undone."
        confirmLabel="Delete All Media"
        confirmDanger
        loading={deletingMedia}
        onConfirm={handleDeleteAllMedia}
        onCancel={() => setShowDeleteMediaConfirm(false)}
      />
    </div>
  );
};

export default StorageSettings;
