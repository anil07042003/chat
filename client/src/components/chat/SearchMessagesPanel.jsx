import { useState } from "react";
import { apiClient } from "../../lib/api-client";
import { SEARCH_MESSAGES_ROUTE } from "../../utils/constants";
import { useAppStore } from "../../store";
import Spinner from "../ui/Spinner";
import { IoSearch, IoClose } from "react-icons/io5";
import { formatMessageTime } from "../../utils/helpers";

const SearchMessagesPanel = ({ onClose }) => {
  const { selectedChatData, selectedChatType } = useAppStore();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await apiClient.post(SEARCH_MESSAGES_ROUTE, {
        query: query.trim(),
        contactId: selectedChatType === "contact" ? selectedChatData._id : undefined,
        groupId: selectedChatType === "group" ? selectedChatData._id : undefined,
      });
      setResults(res.data.messages || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-surface-900 border-b border-surface-800 px-4 py-3">
      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <IoSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Search in conversation..."
            className="w-full bg-surface-800 border border-surface-700 text-white placeholder-surface-500 rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-nexchat-500"
            autoFocus
          />
        </div>
        <button
          onClick={handleSearch}
          disabled={loading}
          className="btn-primary px-3 py-2 text-sm"
        >
          {loading ? <Spinner size="sm" /> : "Search"}
        </button>
        <button onClick={onClose} className="p-2 rounded-xl hover:bg-surface-800 text-surface-400 hover:text-white">
          <IoClose size={18} />
        </button>
      </div>

      {results.length > 0 && (
        <div className="mt-3 max-h-48 overflow-y-auto space-y-1">
          {results.map((msg) => (
            <div key={msg._id} className="p-2 bg-surface-800 rounded-xl">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-nexchat-400 font-medium">
                  {msg.sender?.firstName} {msg.sender?.lastName}
                </span>
                <span className="text-xs text-surface-500">
                  {formatMessageTime(msg.createdAt)}
                </span>
              </div>
              <p className="text-sm text-white">
                {msg.content?.replace(
                  new RegExp(query, "gi"),
                  (match) => `<mark class="bg-nexchat-600/40 text-nexchat-300 rounded px-0.5">${match}</mark>`
                )}
              </p>
            </div>
          ))}
        </div>
      )}

      {!loading && query && results.length === 0 && (
        <p className="text-xs text-surface-500 mt-2 text-center">No messages found</p>
      )}
    </div>
  );
};

export default SearchMessagesPanel;
