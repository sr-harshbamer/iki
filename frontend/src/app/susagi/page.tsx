"use client";

import { useEffect, useRef, useState } from "react";
import {
  Shield,
  ShieldAlert,
  Mic,
  MicOff,
  Lock,
  Play,
  AlertTriangle,
  Activity,
  Bell,
  Trash2,
  UserCheck,
  Sparkles,
  Plus,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const WS_BASE = API_BASE.replace(/^http/, "ws");

interface LogItem {
  id: string;
  time: string;
  why: string;
  score: number;
}

interface BehavioralProfile {
  id: number;
  name: string;
  relationship_role: string;
  expected_style: string;
  never_asks_for: string[];
}

export default function SuSagiPage() {
  const [isScanning, setIsScanning] = useState(false);
  const [isTestMode, setIsTestMode] = useState(false);
  const [score, setScore] = useState(0);
  const [transcript, setTranscript] = useState("Click 'Start Real-Time Scan' or 'Replay Test Call' to begin monitoring...");
  const [evidenceLog, setEvidenceLog] = useState<LogItem[]>([]);
  const [wsStatus, setWsStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  
  // Protective Freeze State
  const [freezeCountdown, setFreezeCountdown] = useState(10);
  const [isFrozen, setIsFrozen] = useState(false);

  // Behavioral Impersonation Engine (Tier 2) state
  const [profiles, setProfiles] = useState<BehavioralProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<number | null>(null);
  const [behavioralScore, setBehavioralScore] = useState<number | null>(null);
  const [behavioralReason, setBehavioralReason] = useState<string | null>(null);
  const [guardianNotified, setGuardianNotified] = useState<boolean | null>(null);
  const [showNewProfile, setShowNewProfile] = useState(false);
  const [newProfile, setNewProfile] = useState({
    name: "", relationship_role: "", expected_style: "", never_asks_for: "",
  });
  const [creatingProfile, setCreatingProfile] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/behavioral-profiles`)
      .then((r) => r.json())
      .then((list: BehavioralProfile[]) => {
        setProfiles(list);
        if (list.length > 0) setSelectedProfileId((prev) => prev ?? list[0].id);
      })
      .catch(() => {});
  }, []);

  const selectedProfile = profiles.find((p) => p.id === selectedProfileId) ?? null;

  const createProfile = async () => {
    const never_asks_for = newProfile.never_asks_for
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!newProfile.name.trim() || !newProfile.relationship_role.trim() || never_asks_for.length === 0) {
      alert("Name, relationship, and at least one \"never asks for\" item are required.");
      return;
    }
    setCreatingProfile(true);
    try {
      const res = await fetch(`${API_BASE}/api/behavioral-profiles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newProfile.name.trim(),
          relationship_role: newProfile.relationship_role.trim(),
          expected_style: newProfile.expected_style.trim() || "No particular pattern noted yet.",
          never_asks_for,
        }),
      });
      if (!res.ok) throw new Error("Failed to create profile");
      const created: BehavioralProfile = await res.json();
      setProfiles((prev) => [...prev, created]);
      setSelectedProfileId(created.id);
      setShowNewProfile(false);
      setNewProfile({ name: "", relationship_role: "", expected_style: "", never_asks_for: "" });
    } catch {
      alert("Couldn't save that profile. Please try again.");
    } finally {
      setCreatingProfile(false);
    }
  };

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);

  // Helper to downsample Float32 audio buffer to 16kHz
  const downsampleBuffer = (buffer: Float32Array, inputSampleRate: number, outputSampleRate: number) => {
    if (inputSampleRate === outputSampleRate) {
      return buffer;
    }
    const sampleRateRatio = inputSampleRate / outputSampleRate;
    const newLength = Math.round(buffer.length / sampleRateRatio);
    const result = new Float32Array(newLength);
    let offsetResult = 0;
    let offsetBuffer = 0;
    while (offsetResult < result.length) {
      const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
      let accum = 0, count = 0;
      for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
        accum += buffer[i];
        count++;
      }
      result[offsetResult] = count > 0 ? accum / count : 0;
      offsetResult++;
      offsetBuffer = nextOffsetBuffer;
    }
    return result;
  };

  // Helper to convert Float32 array to 16-bit signed PCM ArrayBuffer
  const floatTo16BitPCM = (float32Array: Float32Array) => {
    const buffer = new ArrayBuffer(float32Array.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    return buffer;
  };
  
  // Custom Timer for Freeze
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (score >= 75 && !isFrozen) {
      interval = setInterval(() => {
        setFreezeCountdown((prev) => {
          if (prev <= 1) {
            setIsFrozen(true);
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (score < 75) {
      setFreezeCountdown(10);
      setIsFrozen(false);
    }
    return () => clearInterval(interval);
  }, [score, isFrozen]);

  // Connect to WebSocket (Mock or Real)
  const connectWebSocket = (isMockMode: boolean) => {
    setWsStatus("connecting");
    const qs = selectedProfileId ? `?profile_id=${selectedProfileId}` : "";
    // Derived from NEXT_PUBLIC_API_URL, same as every other WS/fetch call in
    // the app (see useLiveGuard.ts) -- a hardcoded "3000"->"8000" swap here
    // broke the moment the backend ran on any other port or behind a tunnel.
    const wsUrl = isMockMode
      ? `${WS_BASE}/api/ws/call-stream-test${qs}`
      : `${WS_BASE}/api/ws/call-stream${qs}`;

    if (wsRef.current) {
      wsRef.current.close();
    }

    console.log(`Connecting WS to: ${wsUrl}`);
    const socket = new WebSocket(wsUrl);
    wsRef.current = socket;

    socket.onopen = () => {
      setWsStatus("connected");
      console.log("WebSocket connected.");
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "behavioral_update") {
          setBehavioralScore(data.behavioral_score);
          setBehavioralReason(data.reason);
          return;
        }
        if (data.type === "escalation") {
          setGuardianNotified(!!data.notified);
          return;
        }

        if (data.score !== undefined) {
          setScore(data.score);
        }
        if (data.transcript) {
          setTranscript(data.transcript);
        }
        if (data.evidence && Array.isArray(data.evidence)) {
          const newLogs: LogItem[] = data.evidence.map((why: string, index: number) => {
            const id = `ev-${index}-${why.slice(0, 10)}`;
            const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            return {
              id,
              time: timeStr,
              why,
              score: data.score
            };
          });
          setEvidenceLog(newLogs);
        }
      } catch (err) {
        console.error("Error reading WS packet:", err);
      }
    };

    socket.onclose = () => {
      setWsStatus("disconnected");
      setIsScanning(false);
      console.log("WebSocket closed.");
    };

    socket.onerror = (err) => {
      setWsStatus("disconnected");
      console.error("WebSocket error:", err);
    };
  };

  const disconnectWebSocket = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    setWsStatus("disconnected");
    setIsScanning(false);
    setScore(0);
    setEvidenceLog([]);
    setTranscript("Monitoring stopped.");
    setBehavioralScore(null);
    setBehavioralReason(null);
    setGuardianNotified(null);
  };

  // Toggle Live Microphones
  const startMicScan = async () => {
    setIsTestMode(false);
    connectWebSocket(false);
    setIsScanning(true);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      micStreamRef.current = stream;
      
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContextClass();
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      
      const scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);
      scriptProcessorRef.current = scriptProcessor;
      
      source.connect(scriptProcessor);
      scriptProcessor.connect(audioContext.destination);

      const inputSampleRate = audioContext.sampleRate;
      
      scriptProcessor.onaudioprocess = (event) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
        
        const inputData = event.inputBuffer.getChannelData(0);
        const downsampled = downsampleBuffer(inputData, inputSampleRate, 16000);
        const pcmBuffer = floatTo16BitPCM(downsampled);
        
        wsRef.current.send(pcmBuffer);
      };
      
      console.log(`Microphone capturing at ${inputSampleRate}Hz and streaming downsampled 16kHz PCM.`);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Microphone access is required for live voice scanning.");
      disconnectWebSocket();
    }
  };

  // Toggle Mock Replay Scans
  const startMockReplay = () => {
    setIsTestMode(true);
    connectWebSocket(true);
    setIsScanning(true);
  };

  const stopScanning = () => {
    disconnectWebSocket();
    
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }
    
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(track => track.stop());
      micStreamRef.current = null;
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  };


  const resetAll = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send("reset");
    }
    setScore(0);
    setEvidenceLog([]);
    setIsFrozen(false);
    setFreezeCountdown(10);
    setTranscript("System reset. Awaiting input...");
    setBehavioralScore(null);
    setBehavioralReason(null);
    setGuardianNotified(null);
  };

  return (
    <div className="min-h-screen bg-ink-950 text-ink-50 font-sans pb-16">
      {/* Dynamic Header */}
      <header className="border-b border-ink-800 bg-ink-900/60 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/20">
              <Shield className="h-5 w-5 text-white" />
            </span>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-1.5">
                SuSagi <span className="text-[10px] uppercase bg-cyan-950 text-cyan-400 font-semibold px-2 py-0.5 rounded-full border border-cyan-800">Local Shield</span>
              </h1>
              <p className="text-xs text-ink-400">Offline Scam & Impersonation Interceptor</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* WS status badge */}
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
              wsStatus === "connected" 
                ? "bg-emerald-950/60 text-emerald-400 border-emerald-800" 
                : wsStatus === "connecting"
                ? "bg-amber-950/60 text-amber-400 border-amber-800"
                : "bg-ink-900 text-ink-500 border-ink-800"
            }`}>
              <span className={`h-2 w-2 rounded-full ${
                wsStatus === "connected" 
                  ? "bg-emerald-400 animate-pulse" 
                  : wsStatus === "connecting"
                  ? "bg-amber-400 animate-pulse"
                  : "bg-ink-600"
              }`} />
              {wsStatus === "connected" ? "Shield Active" : wsStatus === "connecting" ? "Connecting..." : "Shield Standby"}
            </span>
          </div>
        </div>
      </header>

      {/* Main Console Layout */}
      <main className="max-w-4xl mx-auto px-4 mt-8 relative">
        
        {/* Protective Action Critical Banner */}
        {score >= 75 && (
          <div className="mb-6 rounded-2xl border-2 border-red-500 bg-red-950/40 p-5 flex flex-col md:flex-row items-center justify-between gap-4 animate-pulse">
            <div className="flex items-center gap-4 text-center md:text-left">
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-red-500 text-white shrink-0">
                <ShieldAlert className="h-6 w-6" />
              </span>
              <div>
                <h3 className="text-lg font-bold text-white uppercase tracking-wider">CRITICAL RISK THRESHOLD BREACHED</h3>
                <p className="text-sm text-red-200">
                  {isFrozen 
                    ? "PROTECTIVE FREEZE ACTIVATED. Bank APIs locked. Alerts sent to Trusted Contact."
                    : `High risk scam tactics verified. Auto-Freezing request in ${freezeCountdown} seconds...`
                  }
                </p>
              </div>
            </div>
            
            <div className="flex gap-3 shrink-0">
              <div className="bg-red-500/20 border border-red-500/50 rounded-xl px-4 py-2 text-center">
                <p className="text-[10px] text-red-300 font-semibold uppercase">Lock Status</p>
                <p className="text-lg font-bold text-red-100 flex items-center gap-1.5 justify-center">
                  <Lock className="h-4 w-4" /> {isFrozen ? "LOCKED" : "PENDING"}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Left Controls & Risk Bar */}
          <div className="md:col-span-1 space-y-6">

            {/* Behavioral Profile picker -- who is this call supposed to be? */}
            <div className="rounded-2xl border border-ink-800 bg-ink-900/40 p-5 space-y-3">
              <h2 className="text-sm font-bold text-ink-300 uppercase tracking-wider flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-cyan-400" /> Who is calling?
              </h2>
              <p className="text-xs text-ink-500 leading-relaxed">
                Tier 2 checks whether this call actually sounds like the person it claims to be.
              </p>
              <select
                value={selectedProfileId ?? ""}
                onChange={(e) => setSelectedProfileId(Number(e.target.value))}
                disabled={isScanning}
                className="w-full rounded-xl bg-ink-950 border border-ink-800 px-3 py-2.5 text-sm text-ink-100 disabled:opacity-50"
              >
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.relationship_role})</option>
                ))}
              </select>
              {selectedProfile && (
                <p className="text-[11px] text-ink-500 leading-relaxed">
                  Never asks for: {selectedProfile.never_asks_for.join(", ")}
                </p>
              )}

              {!showNewProfile ? (
                <button
                  onClick={() => setShowNewProfile(true)}
                  disabled={isScanning}
                  className="w-full py-2 rounded-lg border border-dashed border-ink-700 text-ink-400 hover:text-cyan-400 hover:border-cyan-800 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors disabled:opacity-40"
                >
                  <Plus className="h-3.5 w-3.5" /> Add a trusted contact
                </button>
              ) : (
                <div className="space-y-2 pt-1 border-t border-ink-800">
                  <input
                    placeholder="Name (e.g. Priya)"
                    value={newProfile.name}
                    onChange={(e) => setNewProfile((p) => ({ ...p, name: e.target.value }))}
                    className="w-full rounded-lg bg-ink-950 border border-ink-800 px-3 py-2 text-xs text-ink-100 placeholder:text-ink-600"
                  />
                  <input
                    placeholder="Relationship (e.g. Sister)"
                    value={newProfile.relationship_role}
                    onChange={(e) => setNewProfile((p) => ({ ...p, relationship_role: e.target.value }))}
                    className="w-full rounded-lg bg-ink-950 border border-ink-800 px-3 py-2 text-xs text-ink-100 placeholder:text-ink-600"
                  />
                  <input
                    placeholder="Normally sounds like... (optional)"
                    value={newProfile.expected_style}
                    onChange={(e) => setNewProfile((p) => ({ ...p, expected_style: e.target.value }))}
                    className="w-full rounded-lg bg-ink-950 border border-ink-800 px-3 py-2 text-xs text-ink-100 placeholder:text-ink-600"
                  />
                  <input
                    placeholder="Would never ask for (comma-separated)"
                    value={newProfile.never_asks_for}
                    onChange={(e) => setNewProfile((p) => ({ ...p, never_asks_for: e.target.value }))}
                    className="w-full rounded-lg bg-ink-950 border border-ink-800 px-3 py-2 text-xs text-ink-100 placeholder:text-ink-600"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={createProfile}
                      disabled={creatingProfile}
                      className="flex-1 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold disabled:opacity-50"
                    >
                      {creatingProfile ? "Saving..." : "Save contact"}
                    </button>
                    <button
                      onClick={() => setShowNewProfile(false)}
                      className="px-3 py-1.5 rounded-lg border border-ink-700 text-ink-400 text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Core Controls */}
            <div className="rounded-2xl border border-ink-800 bg-ink-900/40 p-5 space-y-4">
              <h2 className="text-sm font-bold text-ink-300 uppercase tracking-wider">Console Controls</h2>
              
              {!isScanning ? (
                <div className="space-y-3">
                  <button 
                    onClick={startMicScan}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98]"
                  >
                    <Mic className="h-4 w-4" /> Start Real-Time Scan
                  </button>
                  <button 
                    onClick={startMockReplay}
                    className="w-full py-3 px-4 rounded-xl bg-ink-800 hover:bg-ink-700 text-ink-100 font-semibold flex items-center justify-center gap-2 border border-ink-700 shadow-sm transition-all active:scale-[0.98]"
                  >
                    <Play className="h-4 w-4" /> Replay Test Call
                  </button>
                </div>
              ) : (
                <button 
                  onClick={stopScanning}
                  className="w-full py-3 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98]"
                >
                  <MicOff className="h-4 w-4" /> Stop Monitoring
                </button>
              )}

              <button 
                onClick={resetAll}
                disabled={!isScanning && score === 0}
                className="w-full py-2.5 px-4 rounded-xl bg-ink-950 text-ink-400 hover:text-ink-200 border border-ink-800 flex items-center justify-center gap-2 hover:bg-ink-900 disabled:opacity-40 transition-all text-sm"
              >
                <Trash2 className="h-4 w-4" /> Reset Score & Logs
              </button>
            </div>

            {/* Glowing Risk Bar */}
            <div className="rounded-2xl border border-ink-800 bg-ink-900/40 p-5 text-center flex flex-col items-center">
              <h2 className="text-sm font-bold text-ink-300 uppercase tracking-wider mb-4 self-start">Live Risk Index</h2>
              
              <div className="relative w-36 h-36 flex items-center justify-center mb-4">
                {/* Score Circle Ring */}
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle 
                    cx="50" cy="50" r="42" 
                    fill="transparent" 
                    className="stroke-ink-800" 
                    strokeWidth="8"
                  />
                  <circle 
                    cx="50" cy="50" r="42" 
                    fill="transparent" 
                    className={`transition-all duration-500 ease-out ${
                      score >= 75 ? "stroke-red-500" : score >= 40 ? "stroke-amber-500" : "stroke-cyan-500"
                    }`}
                    strokeWidth="8"
                    strokeDasharray={`${2 * Math.PI * 42}`}
                    strokeDashoffset={`${2 * Math.PI * 42 * (1 - score / 100)}`}
                    strokeLinecap="round"
                  />
                </svg>
                
                {/* Score Number Centered */}
                <div className="absolute flex flex-col items-center justify-center">
                  <span className={`text-4xl font-extrabold tracking-tighter ${
                    score >= 75 ? "text-red-400" : score >= 40 ? "text-amber-400" : "text-cyan-400"
                  }`}>
                    {score}%
                  </span>
                  <span className="text-[9px] uppercase tracking-widest text-ink-400 font-bold mt-1">SCAM INDEX</span>
                </div>
              </div>
              
              {/* Category indicator */}
              <div className={`px-4 py-1.5 rounded-full text-xs font-semibold border ${
                score >= 75 
                  ? "bg-red-950/40 text-red-400 border-red-900" 
                  : score >= 40 
                  ? "bg-amber-950/40 text-amber-400 border-amber-900" 
                  : "bg-cyan-950/40 text-cyan-400 border-cyan-900"
              }`}>
                {score >= 75 ? "HIGH SCAM DANGER" : score >= 40 ? "SUSPICIOUS THREAT" : "SECURE DIALOGUE"}
              </div>
            </div>
          </div>

          {/* Right Live Transcripts & Evidence Feed */}
          <div className="md:col-span-2 space-y-6">
            
            {/* Live Transcript Monitor */}
            <div className="rounded-2xl border border-ink-800 bg-ink-900/40 p-6 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-ink-300 uppercase tracking-wider flex items-center gap-2">
                  <Activity className="h-4 w-4 text-cyan-400 animate-pulse" /> Live Call Transcription
                </h2>
                {isScanning && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-red-400 font-semibold px-2 py-0.5 rounded bg-red-950/30 border border-red-900">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-ping" />
                    LISTENING
                  </span>
                )}
              </div>
              
              <div className="min-h-[120px] max-h-[160px] overflow-y-auto p-4 rounded-xl bg-ink-950 border border-ink-900/60 text-sm leading-relaxed text-ink-200 font-mono">
                {transcript}
              </div>
            </div>

            {/* Behavioral Match -- Tier 2's cross-reference against the
                selected contact's baseline. Separate from the lexicon-based
                Live Risk Index on purpose: this is answering a different
                question ("does this sound like them?") using contextual
                reasoning, not keyword hits. */}
            {isScanning && selectedProfile && (
              <div
                className={`rounded-2xl border p-6 space-y-3 transition-colors ${
                  behavioralScore !== null && behavioralScore >= 60
                    ? "border-red-800 bg-red-950/20"
                    : "border-ink-800 bg-ink-900/40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-ink-300 uppercase tracking-wider flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-cyan-400" /> Behavioral Match vs. {selectedProfile.name}
                  </h2>
                  {behavioralScore !== null && (
                    <span className={`text-lg font-extrabold tabular-nums ${
                      behavioralScore >= 60 ? "text-red-400" : "text-emerald-400"
                    }`}>
                      {behavioralScore}%
                    </span>
                  )}
                </div>
                {behavioralReason ? (
                  <p className="text-sm text-ink-200 leading-relaxed">{behavioralReason}</p>
                ) : (
                  <p className="text-sm text-ink-500">
                    Waiting for enough of the call to compare against {selectedProfile.name}&apos;s baseline...
                  </p>
                )}
              </div>
            )}

            {/* Evidence Feed Timeline */}
            <div className="rounded-2xl border border-ink-800 bg-ink-900/40 p-6 space-y-4">
              <h2 className="text-sm font-bold text-ink-300 uppercase tracking-wider">Scam Indicators & Evidence Log</h2>
              
              <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                {evidenceLog.length === 0 ? (
                  <div className="text-center py-8 text-ink-500 text-sm">
                    Awaiting conversational evaluation logs...
                  </div>
                ) : (
                  evidenceLog.map((log) => (
                    <div 
                      key={log.id} 
                      className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs ${
                        log.score >= 75 
                          ? "bg-red-950/20 border-red-900 text-red-200" 
                          : log.score >= 40 
                          ? "bg-amber-950/20 border-amber-900 text-amber-200" 
                          : "bg-cyan-950/20 border-cyan-900 text-cyan-200"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-mono text-ink-400 bg-ink-950 px-2 py-1 rounded border border-ink-800">
                          {log.time}
                        </span>
                        <p className="font-medium">{log.why}</p>
                      </div>
                      
                      <span className={`font-bold px-2 py-1 rounded shrink-0 ${
                        log.score >= 75 ? "bg-red-900/40" : log.score >= 40 ? "bg-amber-900/40" : "bg-cyan-900/40"
                      }`}>
                        +{log.score}%
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Action Freeze Modal Overlay */}
        {isFrozen && (
          <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-red-950/30 border-2 border-red-500 rounded-3xl p-8 text-center space-y-6 shadow-2xl shadow-red-500/20 animate-in fade-in zoom-in duration-300">
              <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-red-500 text-white animate-bounce">
                <AlertTriangle className="h-8 w-8" />
              </span>
              
              <div className="space-y-2">
                <h2 className="text-2xl font-extrabold tracking-wide text-white uppercase">CALL PROTOCOL FROZEN</h2>
                <p className="text-sm text-red-200">
                  SuSagi identified a high-risk security threat. Active safety protocols have been deployed.
                </p>
              </div>

              <div className="p-4 bg-ink-950 border border-red-900/50 rounded-2xl text-left space-y-2.5 text-xs text-red-200">
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                  <p><strong>Mobile Wallet API</strong>: FROZEN & LOCKED</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                  <p><strong>SMS OTP Broadcast</strong>: PAUSED</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                  <p className="flex items-center gap-1.5">
                    <Bell className="h-3 w-3 text-red-400" />
                    <strong>Guardian Alert</strong>:{" "}
                    {guardianNotified === true
                      ? "Trusted contact notified via Telegram"
                      : guardianNotified === false
                      ? "Logged (no Guardian contact configured)"
                      : "Pending..."}
                  </p>
                </div>
              </div>

              <button 
                onClick={resetAll}
                className="w-full py-3 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold shadow-lg transition-all active:scale-[0.98]"
              >
                Override & Dismiss Protection
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
