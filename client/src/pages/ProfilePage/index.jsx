import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { apiClient } from "../../lib/api-client";
import {
  UPDATE_PROFILE_ROUTE,
  ADD_PROFILE_IMAGE_ROUTE,
  REMOVE_PROFILE_IMAGE_ROUTE,
  AVATAR_COLORS,
} from "../../utils/constants";
import { useAppStore } from "../../store";
import { getImageUrl } from "../../utils/helpers";
import { IoCameraOutline, IoTrashOutline, IoCheckmark, IoChatbubbles } from "react-icons/io5";
import Spinner from "../../components/ui/Spinner";

const ProfilePage = () => {
  const { userInfo, setUserInfo } = useAppStore();
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [form, setForm] = useState({
    firstName: userInfo?.firstName || "",
    lastName: userInfo?.lastName || "",
    bio: userInfo?.bio || "",
    username: userInfo?.username || "",
    color: userInfo?.color ?? 0,
  });

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("profile-image", file);

    setImageLoading(true);
    try {
      const res = await apiClient.post(ADD_PROFILE_IMAGE_ROUTE, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setUserInfo({ ...userInfo, image: res.data.image });
      toast.success("Profile photo updated");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to upload image");
    } finally {
      setImageLoading(false);
    }
  };

  const handleRemoveImage = async () => {
    setImageLoading(true);
    try {
      await apiClient.delete(REMOVE_PROFILE_IMAGE_ROUTE);
      setUserInfo({ ...userInfo, image: null });
      toast.success("Profile photo removed");
    } catch (err) {
      toast.error("Failed to remove image");
    } finally {
      setImageLoading(false);
    }
  };

  const handleSave = async () => {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast.error("First name and last name are required");
      return;
    }

    setLoading(true);
    try {
      const res = await apiClient.post(UPDATE_PROFILE_ROUTE, form);
      // res.data is flat: { id, email, firstName, lastName, profileSetup: true, ... }
      // Explicitly ensure profileSetup is true in the store
      setUserInfo({
        ...userInfo,
        ...res.data,
        profileSetup: true, // guarantee it's set even if API response is unexpected
      });
      toast.success("Profile saved!");
      navigate("/chat");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to save profile");
    } finally {
      setLoading(false);
    }
  };

  const imageUrl = getImageUrl(userInfo?.image);
  const initials = `${form.firstName?.[0] || ""}${form.lastName?.[0] || ""}`.toUpperCase() || "?";

  return (
    <div className="h-screen w-screen bg-surface-950 overflow-y-auto">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-nexchat-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative flex justify-center px-4 py-8 min-h-full">
        <div className="w-full max-w-lg">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-3 overflow-hidden bg-black shadow-lg">
              <img src="/baatchit-icon.svg" alt="BaatChit" className="w-full h-full object-cover" />
            </div>
            <h1 className="text-2xl font-bold text-white">Set Up Your Profile</h1>
            <p className="text-surface-400 mt-1 text-sm">Tell others who you are</p>
          </div>

          {/* Card */}
          <div className="bg-surface-900 border border-surface-800 rounded-2xl p-5 sm:p-8 shadow-2xl">
            {/* Avatar */}
            <div className="flex flex-col items-center mb-8">
              <div className="relative">
                <div
                  className={`w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold text-white overflow-hidden ${
                    !imageUrl ? AVATAR_COLORS[form.color] : ""
                  }`}
                >
                  {imageUrl ? (
                    <img src={imageUrl} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    initials
                  )}
                  {imageLoading && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-full">
                      <Spinner size="sm" />
                    </div>
                  )}
                </div>

                <button
                  onClick={() => fileRef.current?.click()}
                  className="absolute bottom-0 right-0 w-8 h-8 bg-nexchat-600 rounded-full flex items-center justify-center hover:bg-nexchat-500 transition-colors shadow-lg"
                >
                  <IoCameraOutline size={16} className="text-white" />
                </button>
              </div>

              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
              />

              {imageUrl && (
                <button
                  onClick={handleRemoveImage}
                  className="mt-2 text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 transition-colors"
                >
                  <IoTrashOutline size={12} />
                  Remove photo
                </button>
              )}
            </div>

            {/* Form */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 profile-form-grid">
                <div>
                  <label className="block text-sm font-medium text-surface-300 mb-1.5">
                    First Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    name="firstName"
                    value={form.firstName}
                    onChange={handleChange}
                    placeholder="John"
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-300 mb-1.5">
                    Last Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    name="lastName"
                    value={form.lastName}
                    onChange={handleChange}
                    placeholder="Doe"
                    className="input-field"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-300 mb-1.5">
                  Username
                </label>
                <input
                  type="text"
                  name="username"
                  value={form.username}
                  onChange={handleChange}
                  placeholder="@johndoe"
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-300 mb-1.5">
                  Bio
                </label>
                <textarea
                  name="bio"
                  value={form.bio}
                  onChange={handleChange}
                  placeholder="Tell others about yourself..."
                  rows={3}
                  maxLength={200}
                  className="input-field resize-none"
                />
                <p className="text-xs text-surface-500 mt-1 text-right">{form.bio.length}/200</p>
              </div>

              {/* Avatar color */}
              <div>
                <label className="block text-sm font-medium text-surface-300 mb-2">
                  Avatar Color
                </label>
                <div className="flex gap-2 flex-wrap">
                  {AVATAR_COLORS.map((color, i) => (
                    <button
                      key={i}
                      onClick={() => setForm((prev) => ({ ...prev, color: i }))}
                      className={`w-8 h-8 rounded-full ${color} transition-all duration-200 ${
                        form.color === i
                          ? "ring-2 ring-white ring-offset-2 ring-offset-surface-900 scale-110"
                          : "hover:scale-105"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={handleSave}
              disabled={loading}
              className="btn-primary w-full py-3 flex items-center justify-center gap-2 mt-6"
            >
              {loading ? (
                <>
                  <Spinner size="sm" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <IoCheckmark size={20} />
                  <span>Save Profile</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
