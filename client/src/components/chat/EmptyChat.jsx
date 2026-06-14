import { IoAdd, IoPeople } from "react-icons/io5";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "../../store";

const EmptyChat = () => {
  const navigate = useNavigate();
  const { setActivePanel, setChatFilter } = useAppStore();

  const handleGroupsClick = () => {
    console.log("Groups clicked");
    setActivePanel("groups");
    setChatFilter("groups");
    navigate("/groups");
  };

  return (
    <div className="flex flex-col items-center justify-center h-full bg-surface-950 text-center px-8">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-96 h-96 bg-nexchat-600/5 rounded-full blur-3xl" />
      </div>

      <div className="relative">
        {/* BaatChit logo */}
        <div className="w-24 h-24 rounded-full overflow-hidden flex items-center justify-center mb-6 mx-auto bg-black shadow-2xl">
          <img src="/baatchit-icon.svg" alt="BaatChit" className="w-full h-full object-cover" />
        </div>

        <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">Welcome to BaatChit</h2>
        <p className="text-surface-400 text-sm max-w-xs sm:max-w-sm mb-6 sm:mb-8">
          Connecting the world in conversation.
        </p>

        <div className="flex flex-col xs:flex-row gap-3 justify-center w-full max-w-xs xs:max-w-none">
          <button
            onClick={() => setActivePanel("contacts")}
            disabled={false}
            className="flex items-center gap-2 btn-primary px-5 py-2.5 cursor-pointer"
          >
            <IoAdd size={18} />
            New Chat
          </button>
          <button
            onClick={handleGroupsClick}
            disabled={false}
            className="flex items-center gap-2 btn-secondary px-5 py-2.5 cursor-pointer relative z-10"
          >
            <IoPeople size={18} />
            Groups
          </button>
        </div>
      </div>

      {/* Feature highlights */}
      <div className="grid grid-cols-1 xs:grid-cols-3 sm:grid-cols-3 gap-3 mt-8 w-full max-w-sm sm:max-w-lg">
        {[
          { emoji: "💬", title: "Real-time Chat", desc: "Instant messaging" },
          { emoji: "📞", title: "Voice & Video", desc: "HD calls" },
          { emoji: "🔒", title: "Secure", desc: "Private & safe" },
        ].map(({ emoji, title, desc }) => (
          <div key={title} className="text-center p-3 sm:p-4 bg-surface-900/50 rounded-2xl border border-surface-800/50">
            <div className="text-2xl mb-2">{emoji}</div>
            <p className="text-white text-xs font-medium">{title}</p>
            <p className="text-surface-500 text-xs mt-0.5">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default EmptyChat;
