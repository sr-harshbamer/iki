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
  RefreshCw,
  Bell,
  Trash2
} from "lucide-react";

interface LogItem {
  id: string;
  time: string;
  why: string;
  score: number;
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
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    // Proxies /api/* to localhost:8000. So WS also connects to localhost:8000
    const wsUrl = isMockMode 
      ? `${protocol}//${host.replace("3000", "8000")}/api/ws/call-stream-test`
      : `${protocol}//${host.replace("3000", "8000")}/api/ws/call-stream`;

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
                    <strong>Alert Sent</strong>: Trusted Contact (Guardian) Notified
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
