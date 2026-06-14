import { getAvatarColor, getInitials, getImageUrl } from "../../utils/helpers";

const Avatar = ({
  user,
  size = "md",
  showOnline = false,
  className = "",
  onClick,
}) => {
  const sizeClasses = {
    xs: "w-7 h-7 text-xs",
    sm: "w-9 h-9 text-sm",
    md: "w-11 h-11 text-base",
    lg: "w-14 h-14 text-lg",
    xl: "w-20 h-20 text-2xl",
    "2xl": "w-28 h-28 text-3xl",
  };

  const onlineSizeClasses = {
    xs: "w-2 h-2 border",
    sm: "w-2.5 h-2.5 border",
    md: "w-3 h-3 border-2",
    lg: "w-3.5 h-3.5 border-2",
    xl: "w-4 h-4 border-2",
    "2xl": "w-5 h-5 border-2",
  };

  const imageUrl = getImageUrl(user?.image);
  const initials = getInitials(user?.firstName, user?.lastName);
  const colorClass = getAvatarColor(user?.color || 0);

  return (
    <div
      className={`relative flex-shrink-0 ${onClick ? "cursor-pointer" : ""} ${className}`}
      onClick={onClick}
    >
      <div
        className={`avatar ${sizeClasses[size]} ${!imageUrl ? colorClass : ""}`}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={initials}
            className="w-full h-full object-cover rounded-full"
            onError={(e) => {
              e.target.style.display = "none";
              e.target.nextSibling.style.display = "flex";
            }}
          />
        ) : null}
        <span
          className={`w-full h-full flex items-center justify-center rounded-full ${colorClass} ${imageUrl ? "hidden" : ""}`}
        >
          {initials}
        </span>
      </div>

      {showOnline && (
        <span
          className={`absolute bottom-0 right-0 ${onlineSizeClasses[size]} rounded-full border-surface-900 ${
            user?.isOnline ? "bg-emerald-500" : "bg-surface-600"
          }`}
        />
      )}
    </div>
  );
};

export default Avatar;
