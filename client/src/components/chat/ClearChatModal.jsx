import { IoAlertCircleOutline, IoTrashOutline } from "react-icons/io5";
import Spinner from "../ui/Spinner";

const ClearChatModal = ({ isOpen, chatName, clearing, onCancel, onConfirm }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/45 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="w-full max-w-md rounded-t-3xl border theme-border theme-card p-5 shadow-2xl shadow-black/30 sm:rounded-3xl">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent">
            <IoAlertCircleOutline size={24} />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-semibold theme-text">Clear chat?</h3>
            <p className="mt-1 text-sm leading-6 text-zinc-400">
              Are you sure you want to clear this chat?
            </p>
            {chatName ? (
              <p className="mt-2 truncate text-xs font-medium text-zinc-500">
                {chatName}
              </p>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border theme-border app-bg px-3 py-2.5 text-xs leading-5 theme-text-secondary">
          This only clears messages for you. Messages are not deleted for other
          users and new messages will appear normally.
        </div>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={clearing}
            className="flex-1 rounded-2xl border theme-border app-bg px-4 py-2.5 text-sm font-semibold theme-text-secondary transition hover:border-accent disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={clearing}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[rgba(var(--accent-primary-rgb),0.20)] transition hover:bg-[var(--accent-light)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {clearing ? <Spinner size="sm" /> : <IoTrashOutline size={17} />}
            {clearing ? "Clearing..." : "Clear Chat"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClearChatModal;
