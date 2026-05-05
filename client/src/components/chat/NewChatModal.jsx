import { useState, useEffect } from "react";
import { apiClient } from "../../lib/api-client";
import { SEARCH_CONTACTS_ROUTE, CREATE_FRIEND_REQUEST_ROUTE } from "../../utils/constants";
import { useSocket } from "../../context/SocketContext";
import { useAppStore } from "../../store";
import Modal from "../ui/Modal";
import Avatar from "../ui/Avatar";
import Spinner from "../ui/Spinner";
import { getFullName } from "../../utils/helpers";
import { IoSearch, IoPersonAdd, IoCheckmark } from "react-icons/io5";
import { toast } from "react-toastify";

const NewChatModal = ({ onClose, onSelect }) => {
  const { userInfo } = useAppStore();
  const { getSocket } = useSocket();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sentRequests, setSentRequests] = useState(new Set());

  useEffect(() => {
    if (query.trim().length < 1) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await apiClient.post(SEARCH_CONTACTS_ROUTE, { searchTerm: query });
        setResults(res.data.contacts || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = (contact) => {
    onSelect(contact);
    onClose();
  };

  const handleSendRequest = async (email) => {
    try {
      const res = await apiClient.post(CREATE_FRIEND_REQUEST_ROUTE, { friendRequest: email });
      const socket = getSocket();
      if (socket && res.data.target && res.data.requester) {
        socket.emit("sendFriendRequest", {
          target: res.data.target,
          friendRequest: res.data.requester,
        });
      }
      setSentRequests((prev) => new Set([...prev, email]));
      toast.success("Friend request sent!");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to send request");
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="New Chat">
      <div className="p-5">
        <div className="relative mb-4">
          <IoSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or email..."
            className="input-field pl-9"
            autoFocus
          />
        </div>

        <div className="space-y-1 max-h-80 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : results.length > 0 ? (
            results.map((contact) => (
              <div
                key={contact._id}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-surface-800 transition-colors"
              >
                <Avatar user={contact} size="md" showOnline />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white text-sm">{getFullName(contact)}</p>
                  <p className="text-xs text-surface-500 truncate">{contact.email}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSelect(contact)}
                    className="btn-primary text-xs px-3 py-1.5"
                  >
                    Chat
                  </button>
                  {!sentRequests.has(contact.email) ? (
                    <button
                      onClick={() => handleSendRequest(contact.email)}
                      className="btn-secondary text-xs px-3 py-1.5"
                      title="Send friend request"
                    >
                      <IoPersonAdd size={14} />
                    </button>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-emerald-400 px-2">
                      <IoCheckmark size={14} /> Sent
                    </span>
                  )}
                </div>
              </div>
            ))
          ) : query.trim() ? (
            <div className="text-center py-8 text-surface-500">
              <p className="text-sm">No users found</p>
              <p className="text-xs mt-1">Try a different search term</p>
            </div>
          ) : (
            <div className="text-center py-8 text-surface-500">
              <p className="text-sm">Search for users to start chatting</p>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default NewChatModal;
