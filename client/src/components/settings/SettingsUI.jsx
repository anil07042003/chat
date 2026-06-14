// Shared UI primitives for settings sections
// Fully responsive down to 320px viewport width.
import { IoChevronForward } from "react-icons/io5";
import Spinner from "../ui/Spinner";

// ─── SectionTitle ─────────────────────────────────────────────────────────────
export const SectionTitle = ({ children }) => (
  <h3 className="text-xs font-semibold text-surface-500 uppercase tracking-wider px-3 pt-4 pb-2">
    {children}
  </h3>
);

// ─── SettingsCard ─────────────────────────────────────────────────────────────
export const SettingsCard = ({ children, className = "" }) => (
  <div className={`mx-2 sm:mx-3 md:mx-4 mb-3 bg-surface-800 rounded-2xl overflow-hidden ${className}`}>
    {children}
  </div>
);

// ─── SettingsRow ──────────────────────────────────────────────────────────────
// Layout at 320px:
//   [icon 32px] [label flex-1 min-w-0] [right flex-shrink-0]
// The label block gets all remaining space and wraps its sublabel.
// The right element (toggle/badge/chevron) never shrinks or overflows.
export const SettingsRow = ({
  icon: Icon,
  iconColor = "text-nexchat-400",
  label,
  sublabel,
  right,
  onClick,
  danger = false,
  border = true,
}) => {
  const RowTag = onClick ? "button" : "div";

  return (
  <RowTag
    onClick={onClick}
    type={onClick ? "button" : undefined}
    className={[
      "w-full flex items-center gap-2.5 px-3 py-3 transition-colors text-left",
      "min-w-0",                                          // prevent row itself from overflowing
      onClick ? "hover:bg-surface-700 active:bg-surface-700" : "",
      border ? "border-b border-surface-700/50 last:border-0" : "",
    ].join(" ")}
  >
    {/* Icon — fixed 32×32, never shrinks */}
    {Icon && (
      <div className="w-8 h-8 rounded-lg bg-surface-700 flex items-center justify-center flex-shrink-0">
        <Icon size={15} className={iconColor} />
      </div>
    )}

    {/* Label block — takes all remaining space, text wraps naturally */}
    <div className="flex-1 min-w-0">
      <p className={`text-sm font-medium leading-snug ${danger ? "text-rose-400" : "text-white"}`}>
        {label}
      </p>
      {sublabel && (
        <p className="text-xs text-surface-500 mt-0.5 leading-relaxed break-words whitespace-normal">
          {sublabel}
        </p>
      )}
    </div>

    {/* Right element — fixed width, never pushed off screen */}
    {right !== undefined ? (
      <div className="flex-shrink-0 ml-1">{right}</div>
    ) : onClick ? (
      <IoChevronForward size={14} className="text-surface-600 flex-shrink-0 ml-1" />
    ) : null}
  </RowTag>
  );
};

// ─── Toggle ───────────────────────────────────────────────────────────────────
// Slightly smaller on tiny screens to save horizontal space.
export const Toggle = ({ checked, onChange, disabled = false }) => (
  <label
    className={[
      "relative inline-flex w-10 h-[22px] rounded-full flex-shrink-0",
      "transition-colors duration-300 ease-out",
      checked ? "bg-nexchat-600" : "bg-surface-600",
      disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
    ].join(" ")}
  >
    <input
      type="checkbox"
      checked={Boolean(checked)}
      onChange={(e) => onChange(e.target.checked)}
      disabled={disabled}
      role="switch"
      aria-checked={Boolean(checked)}
      className="sr-only"
    />
    <span
      className={[
        "pointer-events-none",
        "absolute top-[2px] left-[2px] w-[18px] h-[18px] bg-white rounded-full shadow",
        "transition-transform duration-300 ease-out",
        checked ? "translate-x-[18px]" : "translate-x-0",
      ].join(" ")}
    />
  </label>
);

// ─── SelectRow ────────────────────────────────────────────────────────────────
// At 320px: icon + label on left, select on right.
// Select is capped at 110px so it never overflows.
export const SelectRow = ({ icon: Icon, iconColor, label, value, options, onChange }) => (
  <div className="flex items-center gap-2.5 px-3 py-3 border-b border-surface-700/50 last:border-0 min-w-0">
    {Icon && (
      <div className="w-8 h-8 rounded-lg bg-surface-700 flex items-center justify-center flex-shrink-0">
        <Icon size={15} className={iconColor || "text-nexchat-400"} />
      </div>
    )}
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium text-white leading-snug">{label}</p>
    </div>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={[
        "bg-surface-700 border border-surface-600 text-white text-xs rounded-lg",
        "px-1.5 py-1.5 focus:outline-none focus:border-nexchat-500 cursor-pointer",
        "flex-shrink-0 min-w-0",
        "max-w-[110px] sm:max-w-[140px]",
      ].join(" ")}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  </div>
);

// ─── SaveButton ───────────────────────────────────────────────────────────────
export const SaveButton = ({ onClick, loading, label = "Save Changes" }) => (
  <div className="px-3 pb-4 pt-2">
    <button
      onClick={onClick}
      disabled={loading}
      className="btn-primary w-full py-2.5 text-sm flex items-center justify-center gap-2"
    >
      {loading ? <Spinner size="sm" /> : null}
      {label}
    </button>
  </div>
);

// ─── InputField ───────────────────────────────────────────────────────────────
export const InputField = ({
  label,
  value,
  onChange,
  type = "text",
  placeholder = "",
  maxLength,
  hint,
  required,
}) => (
  <div className="px-3 py-3 border-b border-surface-700/50 last:border-0">
    <label className="block text-xs text-surface-400 mb-1.5">
      {label}
      {required && <span className="text-rose-400 ml-0.5">*</span>}
    </label>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      className="w-full bg-surface-700 border border-surface-600 text-white placeholder-surface-500 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-nexchat-500 transition-colors"
    />
    {hint && <p className="text-xs text-surface-500 mt-1 leading-relaxed">{hint}</p>}
    {maxLength && (
      <p className="text-xs text-surface-600 mt-1 text-right">
        {value?.length || 0}/{maxLength}
      </p>
    )}
  </div>
);

// ─── TextareaField ────────────────────────────────────────────────────────────
export const TextareaField = ({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
  rows = 3,
}) => (
  <div className="px-3 py-3 border-b border-surface-700/50 last:border-0">
    <label className="block text-xs text-surface-400 mb-1.5">{label}</label>
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      rows={rows}
      className="w-full bg-surface-700 border border-surface-600 text-white placeholder-surface-500 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-nexchat-500 transition-colors resize-none"
    />
    {maxLength && (
      <p className="text-xs text-surface-600 mt-1 text-right">
        {value?.length || 0}/{maxLength}
      </p>
    )}
  </div>
);

// ─── ConfirmModal ─────────────────────────────────────────────────────────────
export const ConfirmModal = ({
  isOpen,
  title,
  message,
  confirmLabel = "Confirm",
  confirmDanger = false,
  onConfirm,
  onCancel,
  loading,
  children,
}) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-surface-900 border border-surface-800 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm shadow-2xl animate-slide-up">
        <div className="p-4">
          <h3 className="text-base font-semibold text-white mb-2">{title}</h3>
          <p className="text-sm text-surface-400 mb-4 leading-relaxed">{message}</p>
          {children}
        </div>
        <div className="flex gap-2 px-4 pb-4">
          <button onClick={onCancel} className="btn-secondary flex-1 py-2.5 text-sm">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={[
              "flex-1 py-2.5 text-sm rounded-xl font-medium",
              "flex items-center justify-center gap-2 transition-all",
              confirmDanger ? "bg-rose-600 hover:bg-rose-500 text-white" : "btn-primary",
            ].join(" ")}
          >
            {loading && <Spinner size="sm" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
