import { useEffect, useState } from "react";
import { apiClient } from "../../lib/api-client";
import {
  GET_FRIEND_REQUESTS_ROUTE,
  ACCEPT_FRIEND_REQUEST_ROUTE,
  REJECT_FRIEND_REQUEST_ROUTE,
  CREATE_FRIEND_REQUEST_ROUTE,
} from "../../utils/constants";
import { useSocket } from "../../context/SocketContext";
import { useAppStore } from "../../store";
import Avatar from "../ui/Avatar";
import Spinner from "../ui/Spinner";
import { getFullName } from "../../utils/helpers";
import { IoCheckmark, IoClose, IoSearch, IoPersonAdd } from "react-icons/io5";
import { toast } from "react-toastify";

const FriendRequestsPanel = () => {
  const { friendRequests, setFriendRequests, setFriendRequestsCount } = useAppStore();
  const { getSocket } = useSocket();
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sendEmail, setSendEmail] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await apiClient.get(GET_FRIEND_REQUESTS_ROUTE);
        const requests = res.data.friendRequests || [];
        setFriendRequests(requests);
        setFriendRequestsCount(requests.length);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleAccept = async (email) => {
    try {
      await apiClient.put(ACCEPT_FRIEND_REQUEST_ROUTE, { friendEmail: email });
      const updated = friendRequests.filter((r) => r.email !== email);
      setFriendRequests(updated);
      setFriendRequestsCount(updated.length);
      toast.success("Friend request accepted!");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to accept request");
    }
  };

  const handleReject = async (email) => {
    try {
      await apiClient.put(REJECT_FRIEND_REQUEST_ROUTE, { friendRequest: email });
      const updated = friendRequests.filter((r) => r.email !== email);
      setFriendRequests(updated);
      setFriendRequestsCount(updated.length);
      toast.success("Request rejected");
    } catch (err) {
      toast.error("Failed to reject request");
    }
  };

  const handleSendRequest = async () => {
    if (!sendEmail.trim()) return;
    setSending(true);
    try {
      const res = await apiClient.post(CREATE_FRIEND_REQUEST_ROUTE, { friendRequest: sendEmail.trim() });
      const socket = getSocket();
      if (socket && res.data.target && res.data.requester) {
        socket.emit("sendFriendRequest", {
          target: res.data.target,
          friendRequest: res.data.requester,
        });
      }
      setSendEmail("");
      toast.success("Friend request sent!");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to send request");
    } finally {
      setSending(false);
    }
  };

  const filtered = friendRequests.filter((r) => {
    if (!searchQuery) return true;
    const name = getFullName(r).toLowerCase();
    return name.includes(searchQuery.toLowerCase()) || r.email?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="flex flex-col h-full bg-surface-900">
      <div className="p-4 border-b border-surface-800">
        <h2 className="text-lg font-semibold text-white mb-3">Friend Requests</h2>

        {/* Send request */}
        <div className="flex gap-2 mb-3">
          <input
            type="email"
            value={sendEmail}
            onChange={(e) => setSendEmail(e.target.value)}
            placeholder="Send request by email..."
            className="input-field text-sm py-2 flex-1"
            onKeyDown={(e) => e.key === "Enter" && handleSendRequest()}
          />
          <button
            onClick={handleSendRequest}
            disabled={sending || !sendEmail.trim()}
            className="btn-primary px-3 py-2 flex-shrink-0"
          >
            {sending ? <Spinner size="sm" /> : <IoPersonAdd size={18} />}
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <IoSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search requests..."
            className="w-full bg-surface-800 border border-surface-700 text-white placeholder-surface-500 rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-nexchat-500"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-20 md:pb-4">
        {loading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">👤</div>
            <p className="text-surface-400 text-sm">
              {searchQuery ? "No requests found" : "No pending friend requests"}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((req) => (
              <div
                key={req.email}
                className="flex items-center gap-3 p-3 bg-surface-800 rounded-xl"
              >
                <Avatar user={req} size="md" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white text-sm">{getFullName(req)}</p>
                  <p className="text-xs text-surface-500 truncate">{req.email}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAccept(req.email)}
                    className="w-8 h-8 bg-emerald-600 hover:bg-emerald-500 rounded-full flex items-center justify-center transition-colors"
                    title="Accept"
                  >
                    <IoCheckmark size={16} className="text-white" />
                  </button>
                  <button
                    onClick={() => handleReject(req.email)}
                    className="w-8 h-8 bg-surface-700 hover:bg-rose-600 rounded-full flex items-center justify-center transition-colors"
                    title="Reject"
                  >
                    <IoClose size={16} className="text-white" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FriendRequestsPanel;
