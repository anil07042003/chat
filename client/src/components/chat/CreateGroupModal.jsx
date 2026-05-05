import { useState, useEffect } from "react";
import { apiClient } from "../../lib/api-client";
import { GET_ALL_CONTACTS_ROUTE, CREATE_GROUP_ROUTE } from "../../utils/constants";
import { useSocket } from "../../context/SocketContext";
import { useAppStore } from "../../store";
import Modal from "../ui/Modal";
import Avatar from "../ui/Avatar";
import Spinner from "../ui/Spinner";
import { getFullName } from "../../utils/helpers";
import { IoClose, IoCheckmark } from "react-icons/io5";
import { toast } from "react-toastify";

const CreateGroupModal = ({ onClose, onCreated }) => {
  const { userInfo, addGroup } = useAppStore();
  const { getSocket } = useSocket();
  const [contacts, setContacts] = useState([]);
  const [selected, setSelected] = useState([]);
  const [groupName, setGroupName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

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

  const toggleSelect = (contact) => {
    setSelected((prev) =>
      prev.some((c) => c._id === contact._id)
        ? prev.filter((c) => c._id !== contact._id)
        : [...prev, contact]
    );
  };

  const handleCreate = async () => {
    if (!groupName.trim()) {
      toast.error("Group name is required");
      return;
    }
    if (selected.length === 0) {
      toast.error("Select at least one member");
      return;
    }

    setCreating(true);
    try {
      const res = await apiClient.post(CREATE_GROUP_ROUTE, {
        name: groupName.trim(),
        description,
        members: selected.map((c) => c._id),
      });

      const group = res.data.group;
      addGroup(group);

      const socket = getSocket();
      if (socket) {
        socket.emit("createGroup", group);
      }

      toast.success(`Group "${group.name}" created!`);
      onCreated?.(group);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to create group");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="Create Group" size="lg">
      <div className="p-5 space-y-4">
        <div>
          <label className="block text-sm font-medium text-surface-300 mb-1.5">
            Group Name <span className="text-rose-400">*</span>
          </label>
          <input
            type="text"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Enter group name..."
            className="input-field"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-surface-300 mb-1.5">
            Description
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional group description..."
            className="input-field"
          />
        </div>

        {/* Selected members */}
        {selected.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selected.map((c) => (
              <div
                key={c._id}
                className="flex items-center gap-1.5 bg-nexchat-600/20 border border-nexchat-600/30 rounded-full px-3 py-1"
              >
                <span className="text-xs text-nexchat-300">{c.firstName}</span>
                <button
                  onClick={() => toggleSelect(c)}
                  className="text-nexchat-400 hover:text-white"
                >
                  <IoClose size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Contact list */}
        <div>
          <label className="block text-sm font-medium text-surface-300 mb-2">
            Add Members ({selected.length} selected)
          </label>
          <div className="max-h-56 overflow-y-auto space-y-1 border border-surface-800 rounded-xl p-2">
            {loading ? (
              <div className="flex justify-center py-6">
                <Spinner />
              </div>
            ) : contacts.length === 0 ? (
              <p className="text-center text-surface-500 text-sm py-6">No contacts found</p>
            ) : (
              contacts.map((contact) => {
                const isSelected = selected.some((c) => c._id === contact._id);
                return (
                  <button
                    key={contact._id}
                    onClick={() => toggleSelect(contact)}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-colors ${
                      isSelected ? "bg-nexchat-600/20" : "hover:bg-surface-800"
                    }`}
                  >
                    <Avatar user={contact} size="sm" />
                    <div className="flex-1 text-left">
                      <p className="text-sm font-medium text-white">{getFullName(contact)}</p>
                      <p className="text-xs text-surface-500">{contact.email}</p>
                    </div>
                    {isSelected && (
                      <div className="w-5 h-5 bg-nexchat-600 rounded-full flex items-center justify-center flex-shrink-0">
                        <IoCheckmark size={12} className="text-white" />
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        <button
          onClick={handleCreate}
          disabled={creating || !groupName.trim() || selected.length === 0}
          className="btn-primary w-full py-3 flex items-center justify-center gap-2"
        >
          {creating ? (
            <>
              <Spinner size="sm" />
              Creating...
            </>
          ) : (
            `Create Group (${selected.length + 1} members)`
          )}
        </button>
      </div>
    </Modal>
  );
};

export default CreateGroupModal;
