import { useEffect, useState } from "react";
import { apiClient } from "../../lib/api-client";
import { GET_CALL_HISTORY_ROUTE } from "../../utils/constants";
import Avatar from "../ui/Avatar";
import Spinner from "../ui/Spinner";
import { getFullName, formatMessageTime, formatDuration } from "../../utils/helpers";
import { IoCall, IoVideocam, IoCallOutline, IoArrowDown, IoArrowUp } from "react-icons/io5";
import { useAppStore } from "../../store";

const CallHistoryPanel = () => {
  const { userInfo } = useAppStore();
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await apiClient.get(GET_CALL_HISTORY_ROUTE);
        setCalls(res.data.calls || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="flex flex-col h-full bg-surface-900">
      <div className="p-4 border-b border-surface-800">
        <h2 className="text-lg font-semibold text-white">Call History</h2>
      </div>

      <div className="flex-1 overflow-y-auto pb-16 md:pb-0">
        {loading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : calls.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">📞</div>
            <p className="text-surface-400 text-sm">No call history</p>
          </div>
        ) : (
          <div className="divide-y divide-surface-800">
            {calls.map((call) => {
              const isInitiator = call.initiator?._id === userInfo?.id;
              const otherParticipant = call.participants?.find(
                (p) => p.user?._id !== userInfo?.id
              );
              const otherUser = otherParticipant?.user || call.initiator;
              const isMissed = call.status === "missed" || otherParticipant?.status === "missed";
              const isRejected = call.status === "rejected";

              return (
                <div key={call._id} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-800 transition-colors">
                  <Avatar user={otherUser} size="md" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white text-sm">{getFullName(otherUser)}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      {isInitiator ? (
                        <IoArrowUp size={12} className="text-nexchat-400" />
                      ) : (
                        <IoArrowDown size={12} className={isMissed ? "text-rose-400" : "text-emerald-400"} />
                      )}
                      <span className={`text-xs ${isMissed || isRejected ? "text-rose-400" : "text-surface-500"}`}>
                        {isMissed ? "Missed" : isRejected ? "Rejected" : isInitiator ? "Outgoing" : "Incoming"}
                        {call.duration > 0 && ` · ${formatDuration(call.duration)}`}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-surface-500">
                      {formatMessageTime(call.createdAt)}
                    </span>
                    {call.callType === "video" ? (
                      <IoVideocam size={16} className="text-surface-500" />
                    ) : (
                      <IoCall size={16} className="text-surface-500" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default CallHistoryPanel;
