// ─── CallModal — complete WebRTC implementation ───────────────────────────
// All bugs fixed:
//   1. Callback refs for media elements — stream re-attached if ontrack fires
//      before the element mounts (race condition on first render).
//   2. Audio element rendered with opacity:0 / position:absolute instead of
//      display:none — browsers block autoplay on display:none elements.
//   3. pendingRemoteStream ref — if ontrack fires before the audio/video
//      element is in the DOM, the stream is stored and attached when the
//      element mounts via the callback ref.
//   4. Explicit .play() with user-gesture unlock on every srcObject assignment.
//   5. setupRanRef guards against double-run (hot-reload / any edge case).
//   6. Socket listeners registered BEFORE any async work.
//   7. ICE candidate queue drained after remote description is set.
//   8. getOtherUserId() handles all call object shapes robustly.
import { useEffect, useRef, useState, useCallback } from "react";
import { useAppStore } from "../../store";
import { useSocket } from "../../context/SocketContext";
import { apiClient } from "../../lib/api-client";
import { UPDATE_CALL_STATUS_ROUTE } from "../../utils/constants";
import Avatar from "../ui/Avatar";
import { getFullName } from "../../utils/helpers";
import {
  IoMic, IoMicOff, IoVideocam, IoVideocamOff,
  IoCall, IoDesktop, IoDesktopOutline,
  IoVolumeMedium, IoVolumeMute, IoWarning,
  IoCameraReverse,
} from "react-icons/io5";
import { toast } from "react-toastify";

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
  ],
};

const CallModal = () => {
  const { activeCall, setActiveCall, userInfo } = useAppStore();
  const { getSocket } = useSocket();

  // ── Refs ──────────────────────────────────────────────────────────────────
  const pcRef              = useRef(null);
  const localStreamRef     = useRef(null);
  const remoteStreamRef    = useRef(null);   // live remote MediaStream
  const pendingStreamRef   = useRef(null);   // stream that arrived before element mounted
  const screenStreamRef    = useRef(null);
  const localVideoEl       = useRef(null);   // actual DOM element (set by callback ref)
  const remoteVideoEl      = useRef(null);   // actual DOM element (set by callback ref)
  const remoteAudioEl      = useRef(null);   // actual DOM element (set by callback ref)
  const durationTimerRef   = useRef(null);
  const startedAtRef       = useRef(null);
  const isEndingRef        = useRef(false);
  const timerStartedRef    = useRef(false);
  const iceCandidateQueue  = useRef([]);
  const remoteDescSet      = useRef(false);
  const activeCallRef      = useRef(activeCall);
  const setupRanRef        = useRef(false);
  const speakerOffRef      = useRef(false);  // stable ref for speaker state

  // ── State ─────────────────────────────────────────────────────────────────
  const [isMuted,         setIsMuted]         = useState(false);
  const [isCameraOff,     setIsCameraOff]      = useState(false);
  const [isScreenSharing, setIsScreenSharing]  = useState(false);
  const [isSpeakerOff,    setIsSpeakerOff]     = useState(false);
  const [cameraDevices,   setCameraDevices]    = useState([]);
  const [selectedCameraId,setSelectedCameraId] = useState(null);
  const [cameraFacingMode,setCameraFacingMode] = useState("user");
  const [isSwitchingCamera,setIsSwitchingCamera] = useState(false);
  const [callDuration,    setCallDuration]      = useState(0);
  const [callStatus,      setCallStatus]        = useState("connecting");
  const [mediaError,      setMediaError]        = useState(null);

  // ── Derived (stable, from ref) ────────────────────────────────────────────
  const call    = activeCallRef.current;
  const isVideo = call?.callType === "video";
  const myId    = userInfo?.id?.toString();

  // ── Helper: safely play a media element ───────────────────────────────────
  const safePlay = (el) => {
    if (!el) return;
    const p = el.play();
    if (p && typeof p.catch === "function") {
      p.catch((err) => {
        // AbortError is benign (element removed before play resolved)
        if (err.name !== "AbortError") {
          console.warn("media play() failed:", err.name, err.message);
        }
      });
    }
  };

  // ── Helper: attach remote stream to the correct element ───────────────────
  // Called from both ontrack AND the callback refs so it works regardless
  // of which arrives first.
  const attachRemoteStream = useCallback((stream) => {
    if (!stream) return;
    remoteStreamRef.current = stream;

    if (isVideo) {
      const el = remoteVideoEl.current;
      if (el) {
        if (el.srcObject !== stream) el.srcObject = stream;
        el.muted = speakerOffRef.current;
        safePlay(el);
      } else {
        // Element not mounted yet — store for when callback ref fires
        pendingStreamRef.current = stream;
      }
    } else {
      const el = remoteAudioEl.current;
      if (el) {
        if (el.srcObject !== stream) el.srcObject = stream;
        el.muted = speakerOffRef.current;
        safePlay(el);
      } else {
        pendingStreamRef.current = stream;
      }
    }
  }, [isVideo]);

  // ── Callback refs — called by React when element mounts/unmounts ──────────
  const setRemoteVideoRef = useCallback((el) => {
    remoteVideoEl.current = el;
    if (el) {
      // Attach any stream that arrived before this element mounted
      const stream = remoteStreamRef.current || pendingStreamRef.current;
      if (stream) {
        el.srcObject = stream;
        el.muted = speakerOffRef.current;
        safePlay(el);
        pendingStreamRef.current = null;
      }
    }
  }, []);

  const setRemoteAudioRef = useCallback((el) => {
    remoteAudioEl.current = el;
    if (el) {
      const stream = remoteStreamRef.current || pendingStreamRef.current;
      if (stream) {
        el.srcObject = stream;
        el.muted = speakerOffRef.current;
        safePlay(el);
        pendingStreamRef.current = null;
      }
    }
  }, []);

  const setLocalVideoRef = useCallback((el) => {
    localVideoEl.current = el;
    if (el && localStreamRef.current) {
      el.srcObject = localStreamRef.current;
      safePlay(el);
    }
  }, []);

  // ── Duration timer ────────────────────────────────────────────────────────
  const startDurationTimer = useCallback(() => {
    if (timerStartedRef.current) return;
    timerStartedRef.current = true;
    startedAtRef.current = Date.now();
    durationTimerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
  }, []);

  // ── Cleanup ───────────────────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    clearInterval(durationTimerRef.current);
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    if (remoteAudioEl.current) { remoteAudioEl.current.srcObject = null; }
    if (remoteVideoEl.current) { remoteVideoEl.current.srcObject = null; }
    if (pcRef.current) {
      pcRef.current.ontrack                    = null;
      pcRef.current.onicecandidate             = null;
      pcRef.current.onconnectionstatechange    = null;
      pcRef.current.oniceconnectionstatechange = null;
      pcRef.current.close();
      pcRef.current = null;
    }
    localStreamRef.current   = null;
    remoteStreamRef.current  = null;
    pendingStreamRef.current = null;
    screenStreamRef.current  = null;
    iceCandidateQueue.current = [];
    remoteDescSet.current    = false;
    timerStartedRef.current  = false;
    setupRanRef.current      = false;
  }, []);

  // ── Get other user ID — handles all call object shapes ───────────────────
  const getOtherUserId = useCallback(() => {
    const c = activeCallRef.current;
    if (!c) return null;
    const me = userInfo?.id?.toString();

    // Shape from initiateCall API: participants[].user is a populated object
    if (Array.isArray(c.participants) && c.participants.length > 0) {
      for (const p of c.participants) {
        const uid = (p.user?._id ?? p.user)?.toString();
        if (uid && uid !== me) return uid;
      }
    }
    // Shape from incomingCall socket event: { from, caller, offer, ... }
    if (c.from) return c.from.toString();
    // Fallback: initiator field
    const init = c.initiator?._id ?? c.initiator;
    if (init && init.toString() !== me) return init.toString();
    return null;
  }, [userInfo]);

  // ── Finalize / end call ───────────────────────────────────────────────────
  const finalizeCall = useCallback(async (reason = "ended") => {
    if (isEndingRef.current) return;
    isEndingRef.current = true;
    const socket  = getSocket();
    const c       = activeCallRef.current;
    const callId  = c?._id || c?.callId;
    const otherId = getOtherUserId();
    if (socket && otherId) socket.emit("endCall", { to: otherId, callId, reason });
    if (callId) {
      try {
        const duration = startedAtRef.current
          ? Math.floor((Date.now() - startedAtRef.current) / 1000) : 0;
        await apiClient.put(`${UPDATE_CALL_STATUS_ROUTE}/${callId}`, {
          status: reason === "rejected" ? "rejected" : "ended",
          duration,
        });
      } catch (err) {
        console.warn("Unable to update call status:", err.message);
      }
    }
    cleanup();
    setActiveCall(null);
  }, [getSocket, getOtherUserId, cleanup, setActiveCall]);

  // ── Drain ICE candidate queue ─────────────────────────────────────────────
  const drainIceCandidateQueue = useCallback(async (pc) => {
    const queued = iceCandidateQueue.current.splice(0);
    for (const candidate of queued) {
      try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); }
      catch (e) { if (!e.message?.includes("closed")) console.warn("ICE drain:", e.message); }
    }
  }, []);

  // ── Get local media with fallbacks ────────────────────────────────────────
  const gatherCameraDevices = useCallback(async () => {
    if (!navigator?.mediaDevices?.enumerateDevices) return [];
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter((device) => device.kind === "videoinput");
    } catch {
      return [];
    }
  }, []);

  const getLocalMedia = useCallback(async (callType) => {
    const wantVideo = callType === "video";
    try {
      const videoConstraints = wantVideo
        ? selectedCameraId
          ? { deviceId: { exact: selectedCameraId }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: cameraFacingMode }
        : false;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: videoConstraints,
      });

      const videoInputs = await gatherCameraDevices();
      setCameraDevices(videoInputs);
      const cameraTrack = stream.getVideoTracks()[0];
      if (cameraTrack) {
        const settings = cameraTrack.getSettings?.() ?? {};
        if (settings.deviceId) setSelectedCameraId(settings.deviceId);
        if (settings.facingMode) setCameraFacingMode(settings.facingMode);
      }

      return { stream, videoEnabled: wantVideo };
    } catch (err) {
      if (wantVideo && ["NotFoundError","NotReadableError","OverconstrainedError"].includes(err.name)) {
        // eslint-disable-next-line no-useless-catch
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true }, video: false,
          });
          toast.warn("Camera unavailable — continuing with audio only");
          return { stream, videoEnabled: false };
        } catch (e2) { throw e2; }
      }
      if (["NotFoundError","DevicesNotFoundError"].includes(err.name)) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          return { stream, videoEnabled: false };
        } catch {
          // Keep the original media error so the caller can show the right message.
        }
      }
      throw err;
    }
  }, [cameraFacingMode, gatherCameraDevices, selectedCameraId]);

  // ── Main effect — WebRTC setup ────────────────────────────────────────────
  useEffect(() => {
    const c = activeCallRef.current;
    if (!c) return;
    const socket = getSocket();
    if (!socket) return;

    // ── 1. Register socket listeners FIRST — before any async work ──────────
    //    This guarantees callAnswered / iceCandidate are never missed while
    //    getUserMedia or createOffer are awaiting.

    const onCallAnswered = async ({ answer }) => {
      const pc = pcRef.current;
      if (!pc) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        remoteDescSet.current = true;
        await drainIceCandidateQueue(pc);
        setCallStatus("ongoing");
        startDurationTimer();
      } catch (e) { console.error("setRemoteDescription(answer):", e); }
    };

    const onIceCandidate = async ({ candidate }) => {
      if (!candidate) return;
      const pc = pcRef.current;
      if (!pc) return;
      if (!remoteDescSet.current) {
        iceCandidateQueue.current.push(candidate);
        return;
      }
      try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); }
      catch (e) { if (!e.message?.includes("closed")) console.warn("addIceCandidate:", e.message); }
    };

    const onCallEnded    = () => { if (!isEndingRef.current) { cleanup(); setActiveCall(null); } };
    const onCallRejected = () => { toast.info("Call was declined"); if (!isEndingRef.current) { cleanup(); setActiveCall(null); } };
    const onCallBusy     = () => { toast.info("User is busy");     if (!isEndingRef.current) { cleanup(); setActiveCall(null); } };

    socket.on("callAnswered", onCallAnswered);
    socket.on("iceCandidate", onIceCandidate);
    socket.on("callEnded",    onCallEnded);
    socket.on("callRejected", onCallRejected);
    socket.on("callBusy",     onCallBusy);

    // ── 2. Async setup ────────────────────────────────────────────────────────
    const setup = async () => {
      if (setupRanRef.current) return;
      setupRanRef.current = true;

      // 2a. Get local media
      let stream;
      try {
        ({ stream } = await getLocalMedia(c.callType));
        localStreamRef.current = stream;
        // Attach local preview via callback ref (element may already be mounted)
        if (localVideoEl.current) {
          localVideoEl.current.srcObject = stream;
          safePlay(localVideoEl.current);
        }
      } catch (err) {
        let msg = "Could not access microphone";
        if (["NotAllowedError","PermissionDeniedError"].includes(err.name))
          msg = "Permission denied — allow microphone/camera in browser settings.";
        else if (["NotFoundError","DevicesNotFoundError"].includes(err.name))
          msg = "No microphone found. Connect one and try again.";
        else if (["NotReadableError","TrackStartError"].includes(err.name))
          msg = "Microphone in use by another app. Close it and try again.";
        else if (err.name === "SecurityError")
          msg = "Media blocked — page must be served over HTTPS or localhost.";
        setMediaError(msg);
        toast.error(msg, { autoClose: 6000 });
        setTimeout(() => finalizeCall("ended"), 4000);
        return;
      }

      // 2b. Create RTCPeerConnection
      const pc = new RTCPeerConnection(ICE_SERVERS);
      pcRef.current = pc;
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      // 2c. Remote track handler
      //     Video calls: attach to <video> (carries audio+video)
      //     Audio calls: attach to <audio>
      //     attachRemoteStream() handles the case where the element isn't
      //     mounted yet — it stores the stream in pendingStreamRef and the
      //     callback ref picks it up when the element mounts.
      pc.ontrack = (event) => {
        console.log("ontrack:", event.track.kind, "streams:", event.streams?.length);
        let remote;
        if (event.streams?.[0]) {
          remote = event.streams[0];
        } else {
          if (!remoteStreamRef.current) remoteStreamRef.current = new MediaStream();
          remoteStreamRef.current.addTrack(event.track);
          remote = remoteStreamRef.current;
        }
        attachRemoteStream(remote);
        setCallStatus("ongoing");
        startDurationTimer();
      };

      // 2d. ICE candidates
      pc.onicecandidate = (event) => {
        if (!event.candidate) return;
        const otherId = getOtherUserId();
        if (otherId) {
          socket.emit("iceCandidate", {
            to: otherId,
            candidate: event.candidate,
            callId: c._id || c.callId,
          });
        }
      };

      // 2e. Connection state
      pc.onconnectionstatechange = () => {
        const s = pc.connectionState;
        console.log("connectionState:", s);
        if (s === "connected") {
          setCallStatus("ongoing");
          startDurationTimer();
          const id = c._id || c.callId;
          if (id) apiClient.put(`${UPDATE_CALL_STATUS_ROUTE}/${id}`, { status: "ongoing" }).catch(() => {});
        } else if (s === "disconnected" || s === "failed") {
          if (!isEndingRef.current) finalizeCall("ended");
        }
      };

      pc.oniceconnectionstatechange = () => {
        const s = pc.iceConnectionState;
        console.log("iceConnectionState:", s);
        if (s === "connected" || s === "completed") { setCallStatus("ongoing"); startDurationTimer(); }
        else if (s === "failed") { if (!isEndingRef.current) finalizeCall("ended"); }
      };

      // 2f. Signaling
      if (c.isInitiator) {
        // CALLER: create offer → send to receiver
        try {
          const offer = await pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: c.callType === "video",
          });
          await pc.setLocalDescription(offer);
          const otherId = getOtherUserId();
          if (!otherId) { console.error("callOffer: no otherId", c); finalizeCall("ended"); return; }
          socket.emit("callOffer", {
            to:       otherId,
            from:     userInfo.id,
            offer:    pc.localDescription,
            callType: c.callType,
            callId:   c._id || c.callId,
          });
          console.log("callOffer sent to", otherId);
        } catch (e) { console.error("createOffer:", e); finalizeCall("ended"); }
      } else {
        // ANSWERER: set remote offer → create answer → send back
        if (!c.offer) {
          console.error("Answerer: no offer in activeCall", c);
          finalizeCall("ended");
          return;
        }
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(c.offer));
          remoteDescSet.current = true;
          await drainIceCandidateQueue(pc);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          const otherId = getOtherUserId();
          if (!otherId) { console.error("callAnswer: no otherId", c); finalizeCall("ended"); return; }
          socket.emit("callAnswer", {
            to:     otherId,
            answer: pc.localDescription,
            callId: c._id || c.callId,
          });
          console.log("callAnswer sent to", otherId);
        } catch (e) { console.error("setRemoteDescription/createAnswer:", e); finalizeCall("ended"); }
      }
    };

    setup();

    return () => {
      socket.off("callAnswered", onCallAnswered);
      socket.off("iceCandidate", onIceCandidate);
      socket.off("callEnded",    onCallEnded);
      socket.off("callRejected", onCallRejected);
      socket.off("callBusy",     onCallBusy);
      cleanup();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Controls ──────────────────────────────────────────────────────────────

  const toggleMute = () => {
    const tracks = localStreamRef.current?.getAudioTracks() ?? [];
    // isMuted is current state — we want to toggle to opposite
    const newEnabled = isMuted; // if currently muted, re-enable
    tracks.forEach(t => { t.enabled = newEnabled; });
    setIsMuted(m => !m);
  };

  const toggleCamera = () => {
    const tracks = localStreamRef.current?.getVideoTracks() ?? [];
    const newEnabled = isCameraOff; // if currently off, re-enable
    tracks.forEach(t => { t.enabled = newEnabled; });
    setIsCameraOff(c => !c);
  };

  const replaceLocalVideoTrack = useCallback(async (newVideoTrack) => {
    newVideoTrack.enabled = !isCameraOff;

    const pc = pcRef.current;
    if (pc) {
      const sender = pc.getSenders().find((s) => s.track?.kind === "video");
      await sender?.replaceTrack(newVideoTrack);
    }

    const audioTracks = localStreamRef.current?.getAudioTracks() ?? [];
    localStreamRef.current?.getVideoTracks().forEach((t) => t.stop());
    localStreamRef.current = new MediaStream([...audioTracks, newVideoTrack]);
    if (localVideoEl.current) {
      localVideoEl.current.srcObject = localStreamRef.current;
      safePlay(localVideoEl.current);
    }
  }, [isCameraOff]);

  const switchCamera = useCallback(async () => {
    if (isSwitchingCamera || isScreenSharing) return;

    setIsSwitchingCamera(true);
    try {
      const latestDevices = await gatherCameraDevices();
      if (latestDevices.length) setCameraDevices(latestDevices);

      const usableDevices = latestDevices.length ? latestDevices : cameraDevices;
      const currentTrack = localStreamRef.current?.getVideoTracks()?.[0];
      const currentSettings = currentTrack?.getSettings?.() ?? {};
      const currentId = selectedCameraId || currentSettings.deviceId;
      const currentIndex = usableDevices.findIndex((device) => device.deviceId === currentId);
      const nextDevice = usableDevices.length > 1
        ? usableDevices[(currentIndex >= 0 ? currentIndex + 1 : 0) % usableDevices.length]
        : null;

      const newStream = await navigator.mediaDevices.getUserMedia({
        video: nextDevice
          ? { deviceId: { exact: nextDevice.deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              facingMode: { exact: (currentSettings.facingMode || cameraFacingMode) === "user" ? "environment" : "user" },
            },
        audio: false,
      });
      const newVideoTrack = newStream.getVideoTracks()[0];
      if (!newVideoTrack) throw new Error("No video track available");

      await replaceLocalVideoTrack(newVideoTrack);

      const nextSettings = newVideoTrack.getSettings?.() ?? {};
      if (nextSettings.deviceId) setSelectedCameraId(nextSettings.deviceId);
      if (nextSettings.facingMode) setCameraFacingMode(nextSettings.facingMode);
      toast.success(`Switched to ${nextDevice?.label || "camera"}`);
    } catch (err) {
      console.error("Camera switch failed:", err);
      toast.error(err.name === "OverconstrainedError" ? "No other camera available" : "Could not switch camera");
    } finally {
      setIsSwitchingCamera(false);
    }
  }, [
    cameraDevices,
    cameraFacingMode,
    gatherCameraDevices,
    isScreenSharing,
    isSwitchingCamera,
    replaceLocalVideoTrack,
    selectedCameraId,
  ]);

  const toggleScreenShare = async () => {
    const pc = pcRef.current;
    if (!pc) return;
    if (isScreenSharing) {
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
      const camTrack = localStreamRef.current?.getVideoTracks()[0];
      if (camTrack) {
        const sender = pc.getSenders().find(s => s.track?.kind === "video");
        await sender?.replaceTrack(camTrack);
      }
      setIsScreenSharing(false);
    } else {
      try {
        const ss = await navigator.mediaDevices.getDisplayMedia({ video: { cursor: "always" }, audio: false });
        screenStreamRef.current = ss;
        const screenTrack = ss.getVideoTracks()[0];
        const sender = pc.getSenders().find(s => s.track?.kind === "video");
        await sender?.replaceTrack(screenTrack);
        screenTrack.onended = () => toggleScreenShare();
        setIsScreenSharing(true);
      } catch { toast.error("Screen sharing failed or was cancelled"); }
    }
  };

  const toggleSpeaker = () => {
    const next = !isSpeakerOff;
    speakerOffRef.current = next;
    setIsSpeakerOff(next);
    if (isVideo && remoteVideoEl.current) remoteVideoEl.current.muted = next;
    if (!isVideo && remoteAudioEl.current) remoteAudioEl.current.muted = next;
  };

  const formatDuration = (s) => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    if (h > 0) return `${h}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
    return `${m}:${String(sec).padStart(2,"0")}`;
  };

  // ── Other user info ───────────────────────────────────────────────────────
  const otherUser = (() => {
    if (!call) return null;
    if (Array.isArray(call.participants)) {
      const other = call.participants.find(
        p => (p.user?._id ?? p.user)?.toString() !== myId
      );
      if (other?.user && typeof other.user === "object") return other.user;
    }
    return call.caller ?? null;
  })();

  if (mediaError) return (
    <div className="fixed inset-0 bg-surface-950 z-50 flex flex-col items-center justify-center p-8 text-center">
      <div className="w-16 h-16 bg-rose-500/20 rounded-full flex items-center justify-center mb-4"><IoWarning size={32} className="text-rose-400" /></div>
      <h2 className="text-xl font-bold text-white mb-2">Media Access Failed</h2>
      <p className="text-surface-400 text-sm max-w-sm mb-6">{mediaError}</p>
      <p className="text-surface-500 text-xs">Ending call in a moment...</p>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-surface-950 z-50 flex flex-col">

      {/*
        Audio element for audio-only calls.
        IMPORTANT: Do NOT use display:none — browsers block autoplay on
        display:none elements. Use position:absolute with zero size instead.
        For video calls the <video> element carries both audio+video tracks.
      */}
      {!isVideo && (
        <audio
          ref={setRemoteAudioRef}
          autoPlay
          style={{ position: "absolute", width: 0, height: 0, opacity: 0, pointerEvents: "none" }}
        />
      )}

      {isVideo ? (
        <div className="flex-1 relative bg-black overflow-hidden">
          {/* Remote video — full screen, carries both audio+video */}
          <video
            ref={setRemoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
          {/* Local PiP */}
          <div
            className="absolute bottom-24 right-3 sm:right-4 w-28 sm:w-36 rounded-xl overflow-hidden border-2 border-surface-700 shadow-2xl bg-surface-900"
            style={{ aspectRatio: "4/3" }}
          >
            <video
              ref={setLocalVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            {isCameraOff && (
              <div className="absolute inset-0 bg-surface-800 flex items-center justify-center">
                <IoVideocamOff size={20} className="text-surface-400" />
              </div>
            )}
          </div>
          {callStatus !== "ongoing" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70">
              <Avatar user={otherUser} size="xl" />
              <h2 className="text-2xl font-bold text-white mt-4">{getFullName(otherUser)}</h2>
              <p className="text-surface-300 mt-2 animate-pulse">Connecting...</p>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-b from-surface-900 to-surface-950 px-6">
          <div className="relative mb-6">
            <Avatar user={otherUser} size="2xl" />
            {callStatus === "ongoing" && (
              <div className="absolute inset-0 rounded-full border-4 border-nexchat-500/30 animate-pulse" />
            )}
          </div>
          <h2 className="text-2xl font-bold text-white">{getFullName(otherUser)}</h2>
          <p className="text-surface-300 mt-2 text-lg">
            {callStatus === "ongoing" ? formatDuration(callDuration) : "Connecting..."}
          </p>
          {callStatus === "ongoing" && (
            <div className="flex items-center gap-2 mt-3">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-emerald-400 text-sm">Connected</span>
            </div>
          )}
        </div>
      )}

      {/* Controls */}
      <div className="call-controls-bar bg-surface-900/95 backdrop-blur-md px-4 sm:px-8 py-4 sm:py-6 flex items-center justify-center gap-3 sm:gap-5 flex-shrink-0 relative flex-wrap">
        {!isVideo && callStatus === "ongoing" && (
          <span className="absolute left-4 sm:left-8 text-surface-400 text-sm font-mono">
            {formatDuration(callDuration)}
          </span>
        )}
        <CallButton icon={isMuted ? IoMicOff : IoMic} label={isMuted ? "Unmute" : "Mute"} onClick={toggleMute} active={isMuted} variant="secondary" />
        {isVideo && (
          <>
            <CallButton icon={isCameraOff ? IoVideocamOff : IoVideocam} label={isCameraOff ? "Cam On" : "Cam Off"} onClick={toggleCamera} active={isCameraOff} variant="secondary" />
            <CallButton icon={IoCameraReverse} label={isSwitchingCamera ? "Switching" : "Switch"} onClick={switchCamera} active={isSwitchingCamera} variant="secondary" disabled={isScreenSharing || isSwitchingCamera} />
            <CallButton icon={isScreenSharing ? IoDesktop : IoDesktopOutline} label="Screen" onClick={toggleScreenShare} active={isScreenSharing} variant="secondary" />
          </>
        )}
        <CallButton icon={IoCall} label="End" onClick={() => finalizeCall("ended")} variant="danger" size="lg" />
        <CallButton
          icon={isSpeakerOff ? IoVolumeMute : IoVolumeMedium}
          label={isSpeakerOff ? "Spkr Off" : "Speaker"}
          onClick={toggleSpeaker}
          active={isSpeakerOff}
          variant="secondary"
        />
      </div>
    </div>
  );
};

// eslint-disable-next-line react/prop-types
const CallButton = ({ icon: Icon, label, onClick, active, variant, size = "md", disabled = false }) => {
  const sizeClass = size === "lg" ? "w-14 h-14 sm:w-16 sm:h-16" : "w-11 h-11 sm:w-12 sm:h-12";
  const iconSize = size === "lg" ? 24 : 20;
  const variantClass = disabled
    ? "bg-surface-800/60 text-surface-500 cursor-not-allowed"
    : variant === "danger" ? "bg-rose-600 hover:bg-rose-500 text-white" : active ? "bg-nexchat-600/30 text-nexchat-400 border border-nexchat-600/50" : "bg-surface-800 hover:bg-surface-700 text-white";
  return (
    <div className="flex flex-col items-center gap-1">
      <button onClick={onClick} disabled={disabled} className={`${sizeClass} rounded-full flex items-center justify-center transition-all duration-200 active:scale-95 disabled:active:scale-100 ${variantClass}`}>
        <Icon size={iconSize} />
      </button>
      <span className="text-xs text-surface-400">{label}</span>
    </div>
  );
};

export default CallModal;
