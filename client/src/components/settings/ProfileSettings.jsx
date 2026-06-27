import { useState, useEffect, useRef } from "react";
import { useAppStore } from "../../store";
import { apiClient } from "../../lib/api-client";
import {
  UPDATE_PROFILE_SETTINGS_ROUTE,
  UPLOAD_PROFILE_IMAGE_ROUTE,
  REMOVE_PROFILE_IMAGE_SETTINGS_ROUTE,
  AVATAR_COLORS,
} from "../../utils/constants";
import { getImageUrl } from "../../utils/helpers";
import { toast } from "react-toastify";
import { IoCameraOutline, IoTrashOutline, IoPersonOutline, IoAtOutline, IoCallOutline, IoInformationCircleOutline } from "react-icons/io5";
import { SectionTitle, SettingsCard, InputField, TextareaField, SaveButton } from "./SettingsUI";
import Spinner from "../ui/Spinner";

const ProfileSettings = () => {
  const { userInfo, setUserInfo } = useAppStore();
  const fileRef = useRef(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    firstName: userInfo?.firstName || "",
    lastName: userInfo?.lastName || "",
    username: userInfo?.username || "",
    bio: userInfo?.bio || "",
    phone: userInfo?.phone || "",
    color: userInfo?.color ?? 0,
  });

  useEffect(() => {
    setForm({
      firstName: userInfo?.firstName || "",
      lastName: userInfo?.lastName || "",
      username: userInfo?.username || "",
      bio: userInfo?.bio || "",
      phone: userInfo?.phone || "",
      color: userInfo?.color ?? 0,
    });
  }, [userInfo?.firstName, userInfo?.lastName, userInfo?.username, userInfo?.bio, userInfo?.phone, userInfo?.color]);

  const imageUrl = getImageUrl(userInfo?.image);
  const initials = `${form.firstName?.[0] || ""}${form.lastName?.[0] || ""}`.toUpperCase() || "?";

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("profile-image", file);
    setImageLoading(true);
    try {
      const res = await apiClient.post(UPLOAD_PROFILE_IMAGE_ROUTE, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setUserInfo((prev) => ({ ...prev, image: res.data.image }));
      toast.success("Photo updated!");
    } catch {
      toast.error("Failed to upload photo");
    } finally {
      setImageLoading(false);
      e.target.value = "";
    }
  };

  const handleRemoveImage = async () => {
    setImageLoading(true);
    try {
      await apiClient.delete(REMOVE_PROFILE_IMAGE_SETTINGS_ROUTE);
      setUserInfo((prev) => ({ ...prev, image: null }));
      toast.success("Photo removed");
    } catch {
      toast.error("Failed to remove photo");
    } finally {
      setImageLoading(false);
    }
  };

  const handleSave = async () => {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast.error("First and last name are required");
      return;
    }
    setSaving(true);
    try {
      const res = await apiClient.put(UPDATE_PROFILE_SETTINGS_ROUTE, form);
      setUserInfo((prev) => ({ ...prev, ...res.data.user }));
      toast.success("Profile saved!");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {/* Avatar */}
      <SectionTitle>Profile Photo</SectionTitle>
      <SettingsCard>
        {/* Stack vertically on very small screens, horizontal on sm+ */}
        <div className="flex flex-col xs:flex-row items-center gap-3 p-3">
          <div className="relative flex-shrink-0">
            <div className={`w-16 h-16 rounded-full overflow-hidden flex items-center justify-center text-xl font-bold text-white ${!imageUrl ? AVATAR_COLORS[form.color] : ""}`}>
              {imageUrl
                ? <img src={imageUrl} alt="avatar" className="w-full h-full object-cover" />
                : initials
              }
              {imageLoading && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-full">
                  <Spinner size="sm" />
                </div>
              )}
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              className="absolute bottom-0 right-0 w-6 h-6 bg-nexchat-600 hover:bg-nexchat-500 rounded-full flex items-center justify-center transition-colors shadow-lg"
            >
              <IoCameraOutline size={12} className="text-white" />
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
          </div>
          <div className="flex-1 min-w-0 text-center xs:text-left w-full">
            <p className="font-semibold text-white truncate">{form.firstName} {form.lastName}</p>
            <p className="text-xs text-surface-400 truncate">{userInfo?.email}</p>
            <div className="flex flex-wrap justify-center xs:justify-start gap-2 mt-2">
              <button
                onClick={() => fileRef.current?.click()}
                className="text-xs bg-nexchat-600/20 text-nexchat-400 border border-nexchat-600/30 px-2.5 py-1 rounded-lg hover:bg-nexchat-600/30 transition-colors whitespace-nowrap"
              >
                Change Photo
              </button>
              {imageUrl && (
                <button
                  onClick={handleRemoveImage}
                  className="text-xs bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2.5 py-1 rounded-lg hover:bg-rose-500/20 transition-colors flex items-center gap-1 whitespace-nowrap"
                >
                  <IoTrashOutline size={11} /> Remove
                </button>
              )}
            </div>
          </div>
        </div>
      </SettingsCard>

      {/* Avatar color */}
      <SectionTitle>Avatar Color</SectionTitle>
      <SettingsCard>
        <div className="p-3">
          {/* Medium-sized color swatches */}
          <div className="flex gap-3 flex-wrap">
            {AVATAR_COLORS.map((color, i) => (
              <button
                key={i}
                onClick={() => setForm((p) => ({ ...p, color: i }))}
                className={`w-12 h-12 rounded-full ${color} transition-all duration-200 flex-shrink-0 ${
                  form.color === i ? "ring-2 ring-white ring-offset-2 ring-offset-surface-800 scale-110" : "hover:scale-105"
                }`}
              />
            ))}
          </div>
        </div>
      </SettingsCard>

      {/* Name & info */}
      <SectionTitle>Personal Info</SectionTitle>
      <SettingsCard>
        {/* Stack on mobile, side-by-side on sm+ */}
        <div className="grid grid-cols-1 sm:grid-cols-2">
          <InputField label="First Name" value={form.firstName} onChange={(v) => setForm((p) => ({ ...p, firstName: v }))} placeholder="John" required />
          <InputField label="Last Name" value={form.lastName} onChange={(v) => setForm((p) => ({ ...p, lastName: v }))} placeholder="Doe" required />
        </div>
        <InputField
          label="Username"
          value={form.username}
          onChange={(v) => setForm((p) => ({ ...p, username: v }))}
          placeholder="@johndoe"
          hint="Others can find you by username"
        />
        <InputField
          label="Phone Number"
          value={form.phone}
          onChange={(v) => setForm((p) => ({ ...p, phone: v }))}
          placeholder="+1 234 567 8900"
          type="tel"
        />
        <TextareaField
          label="Bio / About"
          value={form.bio}
          onChange={(v) => setForm((p) => ({ ...p, bio: v }))}
          placeholder="Tell others about yourself..."
          maxLength={200}
          rows={3}
        />
        <SaveButton onClick={handleSave} loading={saving} />
      </SettingsCard>
    </div>
  );
};

export default ProfileSettings;
