// Backend URL for API requests, uploads, and Socket.IO.
// Vercel serves the frontend over HTTPS, so the browser must connect directly
// to the HTTPS Render backend to avoid mixed-content and websocket issues.
export const PRODUCTION_SERVER_URL = "https://baatchit-backend-3716.onrender.com";

const getBackendUrl = () => {
  const explicit = import.meta.env.VITE_SERVER_URL;

  // If explicitly set to a non-empty value, use it directly.
  if (explicit && explicit.trim() !== "") {
    return explicit.trim().replace(/\/+$/, "");
  }

  return PRODUCTION_SERVER_URL;
};

export const HOST = getBackendUrl();

// Auth
export const AUTH_ROUTES = "api/auth";
export const SIGNUP_ROUTE = `${AUTH_ROUTES}/signup`;
export const LOGIN_ROUTE = `${AUTH_ROUTES}/login`;
export const GET_USER_INFO_ROUTE = `${AUTH_ROUTES}/user-info`;
export const UPDATE_PROFILE_ROUTE = `${AUTH_ROUTES}/update-profile`;
export const ADD_PROFILE_IMAGE_ROUTE = `${AUTH_ROUTES}/add-profile-image`;
export const REMOVE_PROFILE_IMAGE_ROUTE = `${AUTH_ROUTES}/remove-profile-image`;
export const LOGOUT_ROUTE = `${AUTH_ROUTES}/logout`;
export const CHANGE_PASSWORD_ROUTE = `${AUTH_ROUTES}/change-password`;

// Contacts
export const CONTACTS_ROUTES = "api/contacts";
export const SEARCH_CONTACTS_ROUTE = `${CONTACTS_ROUTES}/search`;
export const GET_DM_CONTACTS_ROUTE = `${CONTACTS_ROUTES}/get-contacts-for-dm`;
export const GET_ALL_CONTACTS_ROUTE = `${CONTACTS_ROUTES}/get-all-contacts`;
export const GET_CONTACT_FILES_ROUTE = `${CONTACTS_ROUTES}/get-contact-files`;
export const GET_USER_PROFILE_ROUTE = `${CONTACTS_ROUTES}/profile`;
export const BLOCK_USER_ROUTE = `${CONTACTS_ROUTES}/block`;
export const UNBLOCK_USER_ROUTE = `${CONTACTS_ROUTES}/unblock`;

// Messages
export const MESSAGES_ROUTES = "api/messages";
export const GET_ALL_MESSAGES_ROUTE = `${MESSAGES_ROUTES}/get-messages`;
export const CREATE_MESSAGE_ROUTE = `${MESSAGES_ROUTES}/create`;
export const MARK_MESSAGE_DELIVERED_ROUTE = `${MESSAGES_ROUTES}/delivered`;
export const MARK_MESSAGES_SEEN_ROUTE = `${MESSAGES_ROUTES}/seen`;
export const EDIT_MESSAGE_ROUTE = `${MESSAGES_ROUTES}/edit`;
export const DELETE_MESSAGE_ROUTE = `${MESSAGES_ROUTES}/delete`;
export const REACT_MESSAGE_ROUTE = `${MESSAGES_ROUTES}/react`;
export const PIN_MESSAGE_ROUTE = `${MESSAGES_ROUTES}/pin`;
export const STAR_MESSAGE_ROUTE = `${MESSAGES_ROUTES}/star`;
export const SEARCH_MESSAGES_ROUTE = `${MESSAGES_ROUTES}/search`;
export const UPLOAD_FILE_ROUTE = `${MESSAGES_ROUTES}/upload-file`;

// Chats
export const CHATS_ROUTES = "api/chats";
export const CLEAR_CHAT_ROUTE = (chatId) => `${CHATS_ROUTES}/${chatId}/clear`;
export const MUTE_CHAT_ROUTE = (chatId) => `${CHATS_ROUTES}/${chatId}/mute`;
export const BLOCK_CHAT_ROUTE = (chatId) => `${CHATS_ROUTES}/${chatId}/block`;
export const DELETE_CHAT_ROUTE = (chatId) => `${CHATS_ROUTES}/${chatId}`;

// Friend Requests
export const FRIEND_REQUEST_ROUTES = "api/friend-requests";
export const GET_FRIEND_REQUESTS_ROUTE = `${FRIEND_REQUEST_ROUTES}/get-friend-requests`;
export const CREATE_FRIEND_REQUEST_ROUTE = `${FRIEND_REQUEST_ROUTES}/create-friend-request`;
export const ACCEPT_FRIEND_REQUEST_ROUTE = `${FRIEND_REQUEST_ROUTES}/accept-friend-request`;
export const REJECT_FRIEND_REQUEST_ROUTE = `${FRIEND_REQUEST_ROUTES}/reject-friend-request`;
export const SEARCH_FRIEND_REQUESTS_ROUTE = `${FRIEND_REQUEST_ROUTES}/search-friend-requests`;
export const REMOVE_FRIEND_ROUTE = `${FRIEND_REQUEST_ROUTES}/remove-friend`;

// Groups
export const GROUP_ROUTES = "api/groups";
export const CREATE_GROUP_ROUTE = `${GROUP_ROUTES}/create-group`;
export const GET_USER_GROUPS_ROUTE = `${GROUP_ROUTES}/get-user-groups`;
export const GET_GROUP_MESSAGES_ROUTE = `${GROUP_ROUTES}/get-group-messages`;
export const GET_GROUP_MEMBERS_ROUTE = `${GROUP_ROUTES}/get-group-members`;
export const ADD_GROUP_MEMBERS_ROUTE = `${GROUP_ROUTES}/add-members`;
export const REMOVE_GROUP_MEMBER_ROUTE = `${GROUP_ROUTES}/remove-member`;
export const UPDATE_GROUP_INFO_ROUTE = `${GROUP_ROUTES}/update-info`;
export const UPDATE_GROUP_IMAGE_ROUTE = `${GROUP_ROUTES}/update-image`;
export const PROMOTE_ADMIN_ROUTE = `${GROUP_ROUTES}/promote`;
export const DEMOTE_ADMIN_ROUTE = `${GROUP_ROUTES}/demote`;
export const GET_GROUP_FILES_ROUTE = `${GROUP_ROUTES}/get-group-files`;
export const GET_GROUPS_IN_COMMON_ROUTE = `${GROUP_ROUTES}/get-groups-in-common`;
export const SEARCH_GROUPS_ROUTE = `${GROUP_ROUTES}/search-groups`;

// Calls
export const CALL_ROUTES = "api/calls";
export const INITIATE_CALL_ROUTE = `${CALL_ROUTES}/initiate`;
export const UPDATE_CALL_STATUS_ROUTE = `${CALL_ROUTES}/status`;
export const GET_CALL_HISTORY_ROUTE = `${CALL_ROUTES}/history`;

// Settings
export const SETTINGS_ROUTES = "api/settings";
export const GET_SETTINGS_ROUTE = SETTINGS_ROUTES;
export const UPDATE_PROFILE_SETTINGS_ROUTE = `${SETTINGS_ROUTES}/profile`;
export const UPDATE_EMAIL_ROUTE = `${SETTINGS_ROUTES}/email`;
export const CHANGE_PASSWORD_SETTINGS_ROUTE = `${SETTINGS_ROUTES}/password`;
export const UPLOAD_PROFILE_IMAGE_ROUTE = `${SETTINGS_ROUTES}/profile-image`;
export const REMOVE_PROFILE_IMAGE_SETTINGS_ROUTE = `${SETTINGS_ROUTES}/profile-image`;
export const UPDATE_PRIVACY_ROUTE = `${SETTINGS_ROUTES}/privacy`;
export const UPDATE_NOTIFICATIONS_ROUTE = `${SETTINGS_ROUTES}/notifications`;
export const UPDATE_CHAT_SETTINGS_ROUTE = `${SETTINGS_ROUTES}/chat`;
export const UPDATE_APPEARANCE_ROUTE = `${SETTINGS_ROUTES}/appearance`;
export const GET_BLOCKED_USERS_ROUTE = `${SETTINGS_ROUTES}/blocked`;
export const BLOCK_USER_SETTINGS_ROUTE = `${SETTINGS_ROUTES}/block`;
export const UNBLOCK_USER_SETTINGS_ROUTE = `${SETTINGS_ROUTES}/unblock`;
export const GET_SESSIONS_ROUTE = `${SETTINGS_ROUTES}/sessions`;
export const REVOKE_SESSION_ROUTE = `${SETTINGS_ROUTES}/sessions`;
export const DELETE_ACCOUNT_ROUTE = `${SETTINGS_ROUTES}/account`;
export const GET_STORAGE_ROUTE = `${SETTINGS_ROUTES}/storage`;
export const DELETE_MEDIA_ROUTE = `${SETTINGS_ROUTES}/storage/media`;

// Avatar colors
export const AVATAR_COLORS = [
  "bg-violet-500",
  "bg-blue-500",
  "bg-emerald-500",
  "bg-rose-500",
  "bg-amber-500",
  "bg-cyan-500",
  "bg-pink-500",
  "bg-indigo-500",
  "bg-teal-500",
  "bg-orange-500",
];

export const getAvatarColor = (index) => AVATAR_COLORS[index % AVATAR_COLORS.length];
