import { useEffect, useState } from "react";
import { apiClient } from "../../lib/api-client";
import { GET_ALL_CONTACTS_ROUTE } from "../../utils/constants";
import Avatar from "../ui/Avatar";
import Spinner from "../ui/Spinner";
import { getFullName, formatLastSeen } from "../../utils/helpers";
import { IoSearch, IoChatbubble } from "react-icons/io5";

const ContactsPanel = ({ onSelectContact }) => {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await apiClient.get(GET_ALL_CONTACTS_ROUTE);
        setContacts(res.data.contacts || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = contacts.filter((c) => {
    if (!searchQuery) return true;
    const name = getFullName(c).toLowerCase();
    return name.includes(searchQuery.toLowerCase()) || c.email?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Group by first letter
  const grouped = filtered.reduce((acc, contact) => {
    const letter = contact.firstName?.[0]?.toUpperCase() || "#";
    if (!acc[letter]) acc[letter] = [];
    acc[letter].push(contact);
    return acc;
  }, {});

  const sortedLetters = Object.keys(grouped).sort();

  return (
    <div className="flex flex-col h-full bg-surface-900">
      <div className="p-4 border-b border-surface-800">
        <h2 className="text-lg font-semibold text-white mb-3">Contacts</h2>
        <div className="relative">
          <IoSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search contacts..."
            className="w-full bg-surface-800 border border-surface-700 text-white placeholder-surface-500 rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-nexchat-500"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-16 md:pb-0">
        {loading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">👥</div>
            <p className="text-surface-400 text-sm">
              {searchQuery ? "No contacts found" : "No contacts yet"}
            </p>
          </div>
        ) : (
          sortedLetters.map((letter) => (
            <div key={letter}>
              <div className="px-4 py-2 sticky top-0 bg-surface-900/90 backdrop-blur-sm">
                <span className="text-xs font-bold text-nexchat-400">{letter}</span>
              </div>
              {grouped[letter].map((contact) => (
                <button
                  key={contact._id}
                  onClick={() => onSelectContact(contact)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-800 transition-colors"
                >
                  <Avatar user={contact} size="md" showOnline />
                  <div className="flex-1 text-left min-w-0">
                    <p className="font-medium text-white text-sm">{getFullName(contact)}</p>
                    <p className="text-xs text-surface-500 truncate">
                      {contact.isOnline ? (
                        <span className="text-emerald-400">Online</span>
                      ) : contact.lastSeen ? (
                        `Last seen ${formatLastSeen(contact.lastSeen)}`
                      ) : (
                        contact.email
                      )}
                    </p>
                  </div>
                  <IoChatbubble size={16} className="text-surface-600 flex-shrink-0" />
                </button>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ContactsPanel;
