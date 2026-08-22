"use client";

import { cn } from "@/lib/cn";
import { modeLabel, riskTheme, severityTheme } from "@/lib/risk";
import type { AnalysisResult, DecisionRiskLevel } from "@/lib/types";
import {
  AlertOctagon,
  CheckCircle2,
  Gauge,
  ListChecks,
  Radar,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  SlashSquare,
  Tag,
  TriangleAlert,
  Undo2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { HighlightedContent } from "./HighlightedContent";

/**
 * The single most important component in the product. Presents the 6 output
 * layers in a clear, serious, actionable layout. Severity styling, spacing,
 * and hierarchy are intentional — the user should understand the verdict in
 * under five seconds and know what to do next in under fifteen.
 */
export function RiskVerdictPanel({
  result,
  content,
}: {
  result: AnalysisResult;
  content: string;
}) {
  const theme = riskTheme(result.risk_level);
  const isSafe = result.risk_level === "Safe";

  return (
    <section
      aria-labelledby="verdict-heading"
      className="animate-verdict-in space-y-6"
    >
      {/* ── Verdict header card — the "one glance" answer ─────────── */}
      <div
        className={cn(
          "card overflow-hidden",
          // strong tinted surface matching severity — color, icon, and text
          // together, so the verdict never depends on color alone
          theme.bg,
          "ring-2",
          theme.ring,
        )}
      >
        <div className="flex flex-col gap-6 p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="chip bg-ink-900/70">
                <Tag className="h-3.5 w-3.5 text-brand-600" />
                {modeLabel(result.mode)}
              </span>
              <span className="chip bg-ink-900/70">
                <Tag className="h-3.5 w-3.5 text-ink-400" />
                {result.threat_category}
              </span>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-full border-2", theme.chip)}>
                <VerdictIcon level={result.risk_level} className="h-6 w-6" />
              </span>
              <h2
                id="verdict-heading"
                className="text-2xl font-bold tracking-tight text-ink-50 sm:text-3xl"
              >
                {theme.headline}
              </h2>
            </div>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-300">
              Risk level: <strong className="font-semibold text-ink-50">{result.risk_level}</strong>.
              Based on {result.signals.length}{" "}
              {result.signals.length === 1 ? "signal" : "signals"} found in the
              content you provided.
            </p>
          </div>

          {/* Score gauge — supporting detail, not the headline */}
          <div className="flex shrink-0 items-center gap-5 rounded-2xl bg-ink-900/50 p-4">
            <ScoreDial
              score={result.risk_score}
              low={result.confidence_low}
              high={result.confidence_high}
              barClass={theme.bar}
            />
            <div className="text-sm">
              <div className="font-medium text-ink-400">Risk score</div>
              <div className="mt-1 text-2xl font-bold tabular-nums text-ink-50">
                <AnimatedScore target={result.risk_score} />
                <span className="text-base text-ink-500">/100</span>
              </div>
              <div className="mt-1 text-xs text-ink-500">
                Range {result.confidence_low}–{result.confidence_high}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── WHAT HAPPENED ─────────────────────────────────────────── */}
      <div>
        <SectionEyebrow>What happened</SectionEyebrow>
        <div className="mt-3 card p-6 sm:p-7">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-400">
              Analyzed content
            </h3>
            {result.highlighted_phrases.length > 0 && (
              <span className="text-xs text-ink-500">
                {result.highlighted_phrases.length} suspicious{" "}
                {result.highlighted_phrases.length === 1 ? "phrase" : "phrases"} highlighted
              </span>
            )}
          </div>
          <div className="mt-3 rounded-xl bg-ink-950 p-4">
            <HighlightedContent
              content={content}
              phrases={result.highlighted_phrases}
            />
          </div>
        </div>
      </div>

      {/* ── WHY IT'S SUSPICIOUS ───────────────────────────────────── */}
      <div>
        <SectionEyebrow>Why it&apos;s suspicious</SectionEyebrow>
        <div className="mt-3 space-y-6">
          {result.signals.length > 0 && <SignalList result={result} />}

          {!isSafe && (
            <div className="grid gap-6 lg:grid-cols-2">
              <DecisionRiskCard decisionRisk={result.decision_risk} />
              {result.attack_forecast && (
                <AttackForecastCard forecast={result.attack_forecast} />
              )}
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <ExplanationCard
              icon={<TriangleAlert className="h-4 w-4" />}
              tone="warn"
              title="Why it was flagged"
              subtitle="The specific patterns the analyser saw"
              items={result.why_flagged}
            />
            <ExplanationCard
              icon={<ShieldX className="h-4 w-4" />}
              tone="danger"
              title="Why you should not proceed"
              subtitle={
                isSafe
                  ? "Keep these general cautions in mind"
                  : "What could realistically happen if you do"
              }
              items={result.why_not_proceed}
            />
          </div>
        </div>
      </div>

      {/* ── WHAT YOU SHOULD DO ────────────────────────────────────── */}
      <div>
        <SectionEyebrow>What you should do</SectionEyebrow>
        <div className="mt-3 grid gap-6 lg:grid-cols-2">
          <ExplanationCard
            icon={<ShieldCheck className="h-4 w-4" />}
            tone="safe"
            title="Recommended safe action"
            subtitle="What to do right now"
            items={result.safe_actions}
            emphasize
          />
          <ExplanationCard
            icon={<SlashSquare className="h-4 w-4" />}
            tone="neutral"
            title="Block & report guidance"
            subtitle="Platform-agnostic steps you can take"
            items={result.block_report_guidance}
          />
        </div>
      </div>

      {/* ── Disclaimer ──────────────────────────────────────────── */}
      <div className="rounded-2xl border border-ink-800 bg-ink-900 p-5 text-sm leading-relaxed text-ink-400">
        <strong className="text-ink-200">Important:</strong> SuSagi is a
        decision-support and educational tool. It does not automatically block,
        report, or take action on any content. Treat results as guidance, and
        when in doubt, verify through the sender&apos;s official channels.
      </div>
    </section>
  );
}

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-brand-600">
      {children}
    </h3>
  );
}

/* ─────────────────────────────────────────────────────────── */

function VerdictIcon({
  level,
  className = "h-3.5 w-3.5",
}: {
  level: AnalysisResult["risk_level"];
  className?: string;
}) {
  switch (level) {
    case "Safe":
      return <CheckCircle2 className={className} />;
    case "Low Risk":
      return <ShieldCheck className={className} />;
    case "Suspicious":
      return <TriangleAlert className={className} />;
    case "Likely Scam":
      return <ShieldAlert className={className} />;
    case "High Risk":
    default:
      return <AlertOctagon className={className} />;
  }
}

/**
 * Counts up from 0 to `target` once on mount, easing out. The caller keys
 * this component's ancestor by something unique per analysis so React
 * remounts it (and restarts the animation) on every new result, not just
 * the first one.
 */
function useCountUp(target: number, durationMs = 900): number {
  const [value, setValue] = useState(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    let raf = 0;
    const tick = (now: number) => {
      if (startRef.current === null) startRef.current = now;
      const elapsed = now - startRef.current;
      const t = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setValue(Math.round(eased * target));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, durationMs]);

  return value;
}

function AnimatedScore({ target }: { target: number }) {
  const value = useCountUp(target);
  return <>{value}</>;
}

function ScoreDial({
  score,
  low,
  high,
  barClass,
}: {
  score: number;
  low: number;
  high: number;
  barClass: string;
}) {
  // SVG ring dial — readable at small sizes, theme-aware
  const size = 96;
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  const [filled, setFilled] = useState(false);
  useEffect(() => {
    // Start the ring at 0 and flip to the real value one tick after mount
    // so the browser commits the 0-state first -- without this the CSS
    // transition has nothing to animate from and just snaps to the target.
    const t = setTimeout(() => setFilled(true), 30);
    return () => clearTimeout(t);
  }, []);

  const animatedScore = filled ? score : 0;
  const animatedLow = filled ? low : 0;
  const animatedHigh = filled ? high : 0;
  const offset = circumference - (animatedScore / 100) * circumference;
  const lowOffset = circumference - (animatedLow / 100) * circumference;
  const highOffset = circumference - (animatedHigh / 100) * circumference;
  const ringTransition = { transition: "stroke-dashoffset 900ms cubic-bezier(0.16, 1, 0.3, 1)" };

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="-rotate-90"
      aria-hidden
    >
      {/* track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="rgba(20,23,42,0.12)"
        strokeWidth={stroke}
        fill="none"
      />
      {/* confidence band (lighter) */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        className={cn(barClass, "opacity-30")}
        stroke="currentColor"
        strokeWidth={stroke}
        strokeDasharray={circumference}
        strokeDashoffset={highOffset}
        style={ringTransition}
        fill="none"
        strokeLinecap="round"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="rgba(20,23,42,0.12)"
        strokeWidth={stroke}
        strokeDasharray={circumference}
        strokeDashoffset={lowOffset}
        style={ringTransition}
        fill="none"
        strokeLinecap="round"
      />
      {/* score */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        className={barClass}
        stroke="currentColor"
        strokeWidth={stroke}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        style={ringTransition}
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SignalList({ result }: { result: AnalysisResult }) {
  // Sort critical/high first so the strongest evidence is visible first
  const rank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  const sorted = [...result.signals].sort(
    (a, b) => rank[a.severity] - rank[b.severity],
  );

  return (
    <div className="card p-6 sm:p-7">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-ink-800 text-ink-50">
          <ListChecks className="h-4 w-4" />
        </span>
        <div>
          <h3 className="text-base font-semibold text-ink-50">
            Detected signals
          </h3>
          <p className="text-xs text-ink-400">
            Each signal below triggered on the specific evidence shown.
          </p>
        </div>
      </div>

      <ul className="mt-5 space-y-3">
        {sorted.map((s) => {
          const st = severityTheme(s.severity);
          return (
            <li
              key={s.id}
              className="rounded-xl border border-ink-800 bg-ink-950/60 p-4 transition hover:border-ink-700"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={cn("h-2 w-2 shrink-0 rounded-full", st.dot)} />
                    <span className="text-sm font-semibold text-ink-50">
                      {s.label}
                    </span>
                  </div>
                  {s.evidence.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {s.evidence.map((ev, i) => (
                        <code
                          key={i}
                          className="rounded bg-ink-800 px-1.5 py-0.5 font-mono text-[12px] text-ink-100"
                        >
                          {ev}
                        </code>
                      ))}
                    </div>
                  )}
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide",
                    s.severity === "critical" && "border-red-800 bg-red-800 text-white",
                    s.severity === "high" && "border-red-600 bg-red-600 text-white",
                    s.severity === "medium" && "border-amber-300 bg-amber-100 text-amber-900",
                    s.severity === "low" && "border-lime-300 bg-lime-100 text-lime-900",
                  )}
                >
                  {st.label}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function decisionRiskTheme(level: DecisionRiskLevel) {
  switch (level) {
    case "Low":
      return { bg: "bg-emerald-50", ring: "ring-emerald-300", text: "text-emerald-800", chip: "bg-emerald-50 text-emerald-800 border-emerald-300" };
    case "Moderate":
      return { bg: "bg-amber-50", ring: "ring-amber-300", text: "text-amber-800", chip: "bg-amber-50 text-amber-800 border-amber-300" };
    case "High":
      return { bg: "bg-red-50", ring: "ring-red-300", text: "text-red-800", chip: "bg-red-50 text-red-800 border-red-300" };
    case "Critical":
    default:
      return { bg: "bg-red-100", ring: "ring-red-400", text: "text-red-900", chip: "bg-red-100 text-red-900 border-red-400" };
  }
}

/**
 * Answers a different question than the risk score: not "is this a scam"
 * but "how dangerous is the specific decision being pressured here" --
 * combining scam likelihood with what's at stake and how hard it would be
 * to undo. A high-probability scam asking you to just read an email is
 * lower decision-risk than a lower-probability one asking you to wire money.
 */
function DecisionRiskCard({
  decisionRisk,
}: {
  decisionRisk: AnalysisResult["decision_risk"];
}) {
  const theme = decisionRiskTheme(decisionRisk.level);
  return (
    <div className={cn("card overflow-hidden ring-1", theme.bg, theme.ring)}>
      <div className="p-6 sm:p-7">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-ink-800 text-ink-50">
              <Gauge className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-base font-semibold text-ink-50">Decision risk</h3>
              <p className="text-xs text-ink-400">
                How dangerous is the specific action being pressured, not just the message
              </p>
            </div>
          </div>
          <span className={cn("chip border shrink-0", theme.chip)}>
            {decisionRisk.level}
          </span>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-xl border border-ink-800 bg-ink-950/60 p-3">
            <div className="text-xl font-semibold tabular-nums text-ink-50">
              {decisionRisk.scam_probability}%
            </div>
            <div className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-ink-400">
              Scam probability
            </div>
          </div>
          <div className="rounded-xl border border-ink-800 bg-ink-950/60 p-3">
            <div className="text-xl font-semibold text-ink-50">
              {decisionRisk.potential_consequence}
            </div>
            <div className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-ink-400">
              Potential loss
            </div>
          </div>
          <div className="rounded-xl border border-ink-800 bg-ink-950/60 p-3">
            <div className="flex items-center justify-center gap-1 text-xl font-semibold tabular-nums text-ink-50">
              <Undo2 className="h-3.5 w-3.5 text-ink-500" />
              {decisionRisk.reversibility_score}
            </div>
            <div className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-ink-400">
              Reversibility
            </div>
          </div>
        </div>
        {decisionRisk.reversibility_score <= 30 && (
          <p className={cn("mt-4 text-xs leading-relaxed", theme.text)}>
            This action would be difficult to reverse once taken — money sent
            or credentials shared here are very unlikely to be recoverable.
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * What a matching scam pattern typically escalates to next, so the user
 * recognizes the next message as a continuation of the same attack instead
 * of a fresh, unrelated request. A forecast, never presented as certain.
 */
function AttackForecastCard({
  forecast,
}: {
  forecast: NonNullable<AnalysisResult["attack_forecast"]>;
}) {
  return (
    <div className="card overflow-hidden bg-brand-900 ring-1 ring-brand-700/60 text-white">
      <div className="p-6 sm:p-7">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/10">
            <Radar className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-base font-semibold text-white">Attack forecast</h3>
            <p className="text-xs text-white/60">What the attacker may do next</p>
          </div>
        </div>
        <div className="mt-5">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-white/70">
            Likely next step
          </div>
          <p className="mt-1.5 text-lg font-semibold leading-snug text-white">
            {forecast.predicted_next_step}
          </p>
          <div className="mt-3 flex items-center gap-2">
            <span className="chip border-white/20 bg-white/10 text-white">
              {forecast.confidence}% confidence
            </span>
          </div>
        </div>
        <div className="mt-5 border-t border-white/10 pt-4">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-white/70">
            Potential outcome
          </div>
          <p className="mt-1.5 text-[15px] leading-relaxed text-white/90">
            {forecast.potential_outcome}
          </p>
        </div>
        <p className="mt-5 text-[11px] leading-relaxed text-white/40">
          A forecast based on common patterns for this kind of scam — not a
          guarantee of what will happen.
        </p>
      </div>
    </div>
  );
}

function ExplanationCard({
  icon,
  title,
  subtitle,
  items,
  tone,
  emphasize,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  items: string[];
  tone: "warn" | "danger" | "safe" | "neutral";
  /** The single most actionable card (safe action) — given a stronger tint
   * and border so it reads as the primary "what to do" answer at a glance. */
  emphasize?: boolean;
}) {
  const toneStyles = {
    warn: "bg-amber-50 text-amber-800 border-amber-300",
    danger: "bg-red-50 text-red-800 border-red-300",
    safe: "bg-emerald-50 text-emerald-800 border-emerald-300",
    neutral: "bg-brand-50 text-brand-800 border-brand-300",
  }[tone];

  return (
    <div
      className={cn(
        "card flex h-full flex-col p-6",
        emphasize && "ring-2 ring-emerald-300 bg-emerald-50/40",
      )}
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "grid h-10 w-10 shrink-0 place-items-center rounded-lg border-2",
            toneStyles,
          )}
        >
          {icon}
        </span>
        <div>
          <h3 className="text-base font-bold text-ink-50">{title}</h3>
          <p className="text-xs text-ink-400">{subtitle}</p>
        </div>
      </div>
      <ul className="mt-5 space-y-3.5 text-[15px] leading-relaxed text-ink-200">
        {items.map((item, i) => (
          <li key={i} className="flex gap-3">
            <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ink-500" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
