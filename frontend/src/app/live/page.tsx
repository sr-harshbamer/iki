"use client";

import { cn } from "@/lib/cn";
import { riskTheme, severityTheme } from "@/lib/risk";
import { signalLabel } from "@/lib/signalLabels";
import type { DecisionRiskLevel, RiskLevel } from "@/lib/types";
import { useLiveGuard } from "@/lib/useLiveGuard";
import {
  Loader2,
  Play,
  Radar,
  RotateCcw,
  Send,
  ShieldAlert,
  Undo2,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useState } from "react";

const SCRIPTED_ATTACK = [
  "Hey beta, I'm stuck at the airport.",
  "My phone is about to die, I need 35,000 rupees urgently.",
  "Please transfer it now to this account. Don't call me, I can't talk right now.",
];

function decisionTheme(level: DecisionRiskLevel) {
  switch (level) {
    case "Low":
      return "border-emerald-300 bg-emerald-50 text-emerald-800";
    case "Moderate":
      return "border-amber-300 bg-amber-50 text-amber-800";
    case "High":
      return "border-red-300 bg-red-50 text-red-800";
    case "Critical":
    default:
      return "border-red-400 bg-red-100 text-red-900";
  }
}

export default function LiveGuardPage() {
  const live = useLiveGuard("live-demo");
  const [draft, setDraft] = useState("");
  const [playing, setPlaying] = useState(false);

  const send = () => {
    if (!draft.trim()) return;
    live.sendMessage(draft);
    setDraft("");
  };

  const playScript = async () => {
    setPlaying(true);
    for (const line of SCRIPTED_ATTACK) {
      live.sendMessage(line);
      await new Promise((r) => setTimeout(r, 1400));
    }
    setPlaying(false);
  };

  const theme = live.level ? riskTheme(live.level as RiskLevel) : null;

  return (
    <>
      <section className="border-b border-ink-800 bg-ink-950">
        <div className="container-wide py-10 sm:py-14">
          <span className="eyebrow">Live monitoring, not a checker</span>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink-50 sm:text-4xl">
            Live Guard
          </h1>
          <p className="mt-3 max-w-2xl text-ink-300">
            This page doesn&apos;t have an &ldquo;Analyze&rdquo; button. Send messages
            one at a time — like they&apos;re arriving in a real conversation — and
            watch SuSagi react to each one on its own, live, over a persistent
            connection. If risk crosses a threshold, protection activates
            automatically. Nobody clicks anything for that to happen.
          </p>
          <div className="mt-4 flex items-center gap-2 text-sm">
            {live.connected ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-700">
                <Wifi className="h-4 w-4" /> Live connection open
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-ink-500">
                <WifiOff className="h-4 w-4" /> Connecting…
              </span>
            )}
          </div>
        </div>
      </section>

      <section className="bg-ink-900 py-10">
        <div className="container-wide grid gap-6 lg:grid-cols-5">
          {/* ── Conversation ─────────────────────────────────────── */}
          <div className="card flex flex-col p-6 lg:col-span-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-ink-50">Conversation</h2>
                <p className="text-xs text-ink-400">
                  Type a message and press Enter to simulate it arriving
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={playScript}
                  disabled={playing || !live.connected}
                  className="btn-outline px-3 py-1.5 text-xs"
                >
                  {playing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Play className="h-3.5 w-3.5" />
                  )}
                  Play scripted attack
                </button>
                <button
                  type="button"
                  onClick={live.reset}
                  className="btn-ghost px-3 py-1.5 text-xs"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset
                </button>
              </div>
            </div>

            <div className="mt-4 flex min-h-[280px] flex-1 flex-col gap-2 overflow-y-auto rounded-xl bg-ink-950 p-4">
              {live.messages.length === 0 ? (
                <p className="m-auto text-sm text-ink-500">
                  No messages yet — type one below or play the scripted attack.
                </p>
              ) : (
                live.messages.map((m) => (
                  <div
                    key={m.id}
                    className="max-w-[85%] self-start rounded-2xl rounded-tl-sm border border-ink-800 bg-ink-900 px-4 py-2 text-sm text-ink-200 shadow-soft"
                  >
                    {m.text}
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 flex items-center gap-2">
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="Type the next incoming message…"
                className="input flex-1"
                disabled={!live.connected}
              />
              <button
                type="button"
                onClick={send}
                disabled={!draft.trim() || !live.connected}
                className="btn-brand shrink-0 px-4"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* ── Live risk panel ──────────────────────────────────── */}
          <div className="space-y-4 lg:col-span-2">
            {live.escalated && (
              <div className="card flex items-start gap-3 border border-red-400 bg-red-100 p-4 text-red-900 ring-1 ring-red-400">
                <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <div className="text-sm font-semibold">Protection activated</div>
                  <p className="mt-0.5 text-xs leading-relaxed">{live.escalationMessage}</p>
                </div>
              </div>
            )}

            <div
              className={cn(
                "card p-6 transition-colors duration-500",
                theme ? theme.bg : "",
                theme ? "ring-1" : "",
                theme ? theme.ring : "",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-ink-400">
                  Live risk score
                </span>
                {live.semanticPending && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-ink-500">
                    <Loader2 className="h-3 w-3 animate-spin" /> deeper analysis running…
                  </span>
                )}
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-5xl font-bold tabular-nums text-ink-50 transition-all duration-500">
                  {live.score}
                </span>
                <span className="text-lg text-ink-500">/100</span>
              </div>
              {live.level && (
                <span className={cn("chip mt-3 border", theme?.chip)}>{live.level}</span>
              )}
              {live.category && live.category !== "No Clear Threat Detected" && (
                <span className="chip ml-2 mt-3 border bg-ink-950/60">{live.category}</span>
              )}
            </div>

            {live.decisionRisk && live.level !== "Safe" && (
              <div className={cn("card border p-5", decisionTheme(live.decisionRisk.level))}>
                <div className="flex items-center justify-between text-sm font-semibold">
                  <span>Decision risk</span>
                  <span>{live.decisionRisk.level}</span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                  <div>
                    <div className="text-lg font-semibold tabular-nums">{live.decisionRisk.scam_probability}%</div>
                    <div className="text-[10px] uppercase tracking-wide opacity-70">Probability</div>
                  </div>
                  <div>
                    <div className="text-lg font-semibold">{live.decisionRisk.potential_consequence}</div>
                    <div className="text-[10px] uppercase tracking-wide opacity-70">Loss</div>
                  </div>
                  <div>
                    <div className="flex items-center justify-center gap-1 text-lg font-semibold tabular-nums">
                      <Undo2 className="h-3 w-3" />
                      {live.decisionRisk.reversibility_score}
                    </div>
                    <div className="text-[10px] uppercase tracking-wide opacity-70">Reversibility</div>
                  </div>
                </div>
              </div>
            )}

            {live.attackForecast && (
              <div className="card bg-brand-900 ring-1 ring-brand-700/60 p-5 text-white">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/60">
                  <Radar className="h-3.5 w-3.5" /> Attack forecast
                </div>
                <p className="mt-2 text-sm font-semibold leading-snug">
                  {live.attackForecast.predicted_next_step}
                </p>
                <p className="mt-1 text-xs text-white/60">
                  {live.attackForecast.confidence}% confidence
                </p>
              </div>
            )}

            {live.signals.length > 0 && (
              <div className="card p-5">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-400">
                  Live signals ({live.signals.length})
                </h3>
                <ul className="mt-3 space-y-2">
                  {live.signals.map((s) => {
                    const st = severityTheme(s.severity);
                    return (
                      <li key={s.id} className="flex items-center gap-2 text-sm text-ink-200">
                        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", st.dot)} />
                        {signalLabel(s.id)}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
