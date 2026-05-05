import { useEffect, useRef } from "react";
import { useAppStore } from "../../store";
import { useSocket } from "../../context/SocketContext";
import Avatar from "../ui/Avatar";
import { getFullName } from "../../utils/helpers";
import { IoCall, IoCallOutline, IoVideocam } from "react-icons/io5";

// IncomingCallModal ONLY shows the ring UI.
// It does NOT render CallModal — that is handled exclusively by ChatPage
// to prevent two peer connections being created simultaneously.

const IncomingCallModal = () => {
  const { incomingCall, setIncomingCall, setActiveCall } = useAppStore();
  const { getSocket } = useSocket();
  const ringtoneRef = useRef(null);

  useEffect(() => {
    if (!incomingCall) return;

    // Ringtone using Web Audio API — no external file needed
    let ctx;
    let interval;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      const playBeep = () => {
        try {
          const osc  = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.value = 440;
          gain.gain.setValueAtTime(0.25, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 0.5);
        } catch (_) {}
      };
      playBeep();
      interval = setInterval(playBeep, 1800);
      ringtoneRef.current = {
        stop: () => {
          clearInterval(interval);
          try { ctx.close(); } catch (_) {}
        },
      };
    } catch (_) {
      // Audio API not available — silent
    }

    return () => {
      ringtoneRef.current?.stop();
      ringtoneRef.current = null;
    };
  }, [incomingCall?.callId]); // re-run only when a new call comes in

  const stopRingtone = () => {
    ringtoneRef.current?.stop();
    ringtoneRef.current = null;
  };

  const handleAccept = () => {
    stopRingtone();
    // Set activeCall — ChatPage will render <CallModal /> which sets up the peer connection
    setActiveCall({
      ...incomingCall,
      isInitiator: false,
    });
    setIncomingCall(null);
  };

  const handleReject = () => {
    stopRingtone();
    const socket = getSocket();
    if (socket && incomingCall) {
      socket.emit("rejectCall", {
        to: incomingCall.from,
        callId: incomingCall.callId,
      });
    }
    setIncomingCall(null);
  };

  if (!incomingCall) return null;

  const caller  = incomingCall.caller;
  const isVideo = incomingCall.callType === "video";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center pb-6 sm:pb-8 px-3 sm:px-4 bg-black/40 backdrop-blur-sm">
      <div className="incoming-call-modal bg-surface-900 border border-surface-700 rounded-3xl p-5 sm:p-6 w-full max-w-sm shadow-2xl animate-slide-up">
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-4">
            <Avatar user={caller} size="xl" />
            <div className="absolute inset-0 rounded-full border-4 border-nexchat-500/40 animate-pulse" />
          </div>

          <p className="text-surface-400 text-sm mb-1">
            Incoming {isVideo ? "video" : "audio"} call
          </p>
          <h2 className="text-xl font-bold text-white">{getFullName(caller)}</h2>

          <div className="flex gap-8 mt-8">
            {/* Decline */}
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={handleReject}
                className="w-16 h-16 bg-rose-600 hover:bg-rose-500 rounded-full flex items-center justify-center transition-all active:scale-95 shadow-lg"
              >
                <IoCallOutline size={28} className="text-white rotate-[135deg]" />
              </button>
              <span className="text-xs text-surface-400">Decline</span>
            </div>

            {/* Accept */}
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={handleAccept}
                className="w-16 h-16 bg-emerald-600 hover:bg-emerald-500 rounded-full flex items-center justify-center transition-all active:scale-95 shadow-lg call-pulse"
              >
                {isVideo
                  ? <IoVideocam size={28} className="text-white" />
                  : <IoCall    size={28} className="text-white" />
                }
              </button>
              <span className="text-xs text-surface-400">Accept</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IncomingCallModal;
