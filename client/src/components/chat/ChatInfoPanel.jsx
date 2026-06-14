import { useState, useEffect } from "react";
import { apiClient } from "../../lib/api-client";
import {
  GET_CONTACT_FILES_ROUTE,
  GET_GROUP_FILES_ROUTE,
  GET_GROUPS_IN_COMMON_ROUTE,
  GET_GROUP_MEMBERS_ROUTE,
  HOST,
} from "../../utils/constants";
import { useAppStore } from "../../store";
import Avatar from "../ui/Avatar";
import Spinner from "../ui/Spinner";
import { getFullName, formatLastSeen, getImageUrl, formatFileSize } from "../../utils/helpers";
import {
  IoClose,
  IoImage,
  IoDocument,
  IoCall,
  IoVideocam,
  IoPeople,
  IoShield,
  IoPersonRemove,
} from "react-icons/io5";
import { toast } from "react-toastify";

const ChatInfoPanel = ({ onClose }) => {
  const { selectedChatData, selectedChatType, userInfo } = useAppStore();
  const isGroup = selectedChatType === "group";
  const [files, setFiles] = useState([]);
  const [members, setMembers] = useState([]);
  const [commonGroups, setCommonGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("info");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        if (isGroup) {
          const [filesRes, membersRes] = await Promise.all([
            apiClient.get(`${GET_GROUP_FILES_ROUTE}/${selectedChatData._id}`),
            apiClient.get(`${GET_GROUP_MEMBERS_ROUTE}/${selectedChatData._id}`),
          ]);
          setFiles(filesRes.data.files || []);
          setMembers(membersRes.data.members || []);
        } else {
          const [filesRes, groupsRes] = await Promise.all([
            apiClient.get(`${GET_CONTACT_FILES_ROUTE}/${selectedChatData._id}`),
            apiClient.get(`${GET_GROUPS_IN_COMMON_ROUTE}/${selectedChatData._id}`),
          ]);
          setFiles(filesRes.data.files || []);
          setCommonGroups(groupsRes.data.groups || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [selectedChatData?._id]);

  const imageFiles = files.filter((f) => f.messageType === "image");
  const otherFiles = files.filter((f) => f.messageType !== "image");

  return (
    <div className="absolute inset-0 bg-surface-950 z-30 flex flex-col animate-slide-in-right">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-surface-900 border-b border-surface-800">
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-800 text-surface-400 hover:text-white">
          <IoClose size={20} />
        </button>
        <h3 className="font-semibold text-white">{isGroup ? "Group Info" : "Contact Info"}</h3>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Profile section */}
        <div className="flex flex-col items-center py-8 px-4 bg-surface-900 border-b border-surface-800">
          {isGroup ? (
            <div className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold text-white mb-3 ${
              ["bg-violet-500", "bg-blue-500", "bg-emerald-500", "bg-rose-500"][
                selectedChatData?.name?.charCodeAt(0) % 4 || 0
              ]
            }`}>
              {selectedChatData?.image ? (
                <img src={`${HOST}/${selectedChatData.image}`} alt={selectedChatData.name} className="w-full h-full object-cover rounded-full" />
              ) : (
                selectedChatData?.name?.[0]?.toUpperCase()
              )}
            </div>
          ) : (
            <Avatar user={selectedChatData} size="xl" showOnline />
          )}

          <h2 className="text-xl font-bold text-white mt-2">
            {isGroup ? selectedChatData?.name : getFullName(selectedChatData)}
          </h2>

          {!isGroup && (
            <>
              <p className="text-sm text-surface-400 mt-1">{selectedChatData?.email}</p>
              {selectedChatData?.bio && (
                <p className="text-sm text-surface-300 mt-2 text-center max-w-xs">{selectedChatData.bio}</p>
              )}
              <p className="text-xs text-surface-500 mt-2">
                {selectedChatData?.isOnline ? (
                  <span className="text-emerald-400">● Online</span>
                ) : selectedChatData?.lastSeen ? (
                  `Last seen ${formatLastSeen(selectedChatData.lastSeen)}`
                ) : ""}
              </p>
            </>
          )}

          {isGroup && (
            <p className="text-sm text-surface-400 mt-1">
              {selectedChatData?.members?.length || 0} members
            </p>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-surface-800">
          {["info", "media", isGroup ? "members" : "groups"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 text-sm font-medium capitalize transition-colors ${
                activeTab === tab
                  ? "text-nexchat-400 border-b-2 border-nexchat-500"
                  : "text-surface-500 hover:text-surface-300"
              }`}
            >
              {tab === "groups" ? "Common Groups" : tab}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : (
          <div className="p-4">
            {activeTab === "info" && (
              <div className="space-y-3">
                {isGroup && selectedChatData?.description && (
                  <div className="bg-surface-800 rounded-xl p-4">
                    <p className="text-xs text-surface-500 mb-1">Description</p>
                    <p className="text-sm text-white">{selectedChatData.description}</p>
                  </div>
                )}
                {!isGroup && selectedChatData?.username && (
                  <div className="bg-surface-800 rounded-xl p-4">
                    <p className="text-xs text-surface-500 mb-1">Username</p>
                    <p className="text-sm text-white">@{selectedChatData.username}</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === "media" && (
              <div>
                {imageFiles.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs text-surface-500 mb-2 uppercase tracking-wider">Photos</p>
                    <div className="grid grid-cols-3 gap-1">
                      {imageFiles.map((f) => (
                        <div
                          key={f._id}
                          className="aspect-square rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => window.open(`${HOST}/${f.fileUrl}`, "_blank")}
                        >
                          <img
                            src={`${HOST}/${f.fileUrl}`}
                            alt="Media"
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {otherFiles.length > 0 && (
                  <div>
                    <p className="text-xs text-surface-500 mb-2 uppercase tracking-wider">Files</p>
                    <div className="space-y-2">
                      {otherFiles.map((f) => (
                        <a
                          key={f._id}
                          href={`${HOST}/${f.fileUrl}`}
                          download={f.fileName}
                          className="flex items-center gap-3 p-3 bg-surface-800 rounded-xl hover:bg-surface-700 transition-colors"
                        >
                          <div className="w-10 h-10 bg-surface-700 rounded-xl flex items-center justify-center text-xl">
                            📎
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white truncate">{f.fileName || "File"}</p>
                            {f.fileSize && <p className="text-xs text-surface-500">{formatFileSize(f.fileSize)}</p>}
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {files.length === 0 && (
                  <div className="text-center py-8 text-surface-500">
                    <IoImage size={32} className="mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No media shared yet</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === "members" && isGroup && (
              <div className="space-y-2">
                {members.map((member) => {
                  const user = member.user || member;
                  const role = member.role;
                  return (
                    <div key={user._id || user.id} className="flex items-center gap-3 p-3 bg-surface-800 rounded-xl">
                      <Avatar user={user} size="sm" showOnline />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white">
                          {getFullName(user)}
                          {(user._id || user.id) === userInfo?.id && " (You)"}
                        </p>
                        <p className="text-xs text-surface-500">{user.email}</p>
                      </div>
                      {role === "admin" && (
                        <span className="text-xs bg-nexchat-600/20 text-nexchat-400 border border-nexchat-600/30 px-2 py-0.5 rounded-full">
                          Admin
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {activeTab === "groups" && !isGroup && (
              <div className="space-y-2">
                {commonGroups.length === 0 ? (
                  <div className="text-center py-8 text-surface-500">
                    <IoPeople size={32} className="mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No groups in common</p>
                  </div>
                ) : (
                  commonGroups.map((group) => (
                    <div key={group._id} className="flex items-center gap-3 p-3 bg-surface-800 rounded-xl">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm ${
                        ["bg-violet-500", "bg-blue-500", "bg-emerald-500"][group.name?.charCodeAt(0) % 3 || 0]
                      }`}>
                        {group.name?.[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white">{group.name}</p>
                        <p className="text-xs text-surface-500">{group.members?.length || 0} members</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatInfoPanel;
