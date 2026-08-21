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
      className="space-y-6"
    >
      {/* ── Verdict header card ───────────────────────────────────── */}
      <div
        className={cn(
          "card overflow-hidden",
          // subtle tinted surface matching severity
          theme.bg,
          "ring-1",
          theme.ring,
        )}
      >
        <div className="flex flex-col gap-6 p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="chip bg-white/80">
                <Tag className="h-3.5 w-3.5 text-brand-700" />
                {modeLabel(result.mode)}
              </span>
              <span className={cn("chip border", theme.chip)}>
                <VerdictIcon level={result.risk_level} />
                {result.risk_level}
              </span>
              <span className="chip bg-white/80">
                <Tag className="h-3.5 w-3.5 text-ink-500" />
                {result.threat_category}
              </span>
            </div>
            <h2
              id="verdict-heading"
              className="mt-4 text-2xl font-semibold tracking-tight text-ink-900 sm:text-3xl"
            >
              {theme.headline}
            </h2>
            <p className="mt-2 text-sm text-ink-600">
              Based on {result.signals.length}{" "}
              {result.signals.length === 1 ? "signal" : "signals"} detected in
              the content you provided.
            </p>
          </div>

          {/* Score gauge */}
          <div className="flex shrink-0 items-center gap-5">
            <ScoreDial
              score={result.risk_score}
              low={result.confidence_low}
              high={result.confidence_high}
              barClass={theme.bar}
            />
            <div className="text-sm">
              <div className="text-ink-500">Risk score</div>
              <div className="mt-1 text-3xl font-semibold text-ink-900">
                {result.risk_score}
                <span className="text-lg text-ink-400">/100</span>
              </div>
              <div className="mt-1 text-xs text-ink-500">
                Confidence {result.confidence_low}–{result.confidence_high}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Analyzed content with highlights ─────────────────────── */}
      <div className="card p-6 sm:p-7">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-500">
            Analyzed content
          </h3>
          {result.highlighted_phrases.length > 0 && (
            <span className="text-xs text-ink-500">
              {result.highlighted_phrases.length} suspicious{" "}
              {result.highlighted_phrases.length === 1 ? "phrase" : "phrases"} highlighted
            </span>
          )}
        </div>
        <div className="mt-3 rounded-xl bg-ink-50 p-4">
          <HighlightedContent
            content={content}
            phrases={result.highlighted_phrases}
          />
        </div>
      </div>

      {/* ── Signals (detected red flags) ─────────────────────────── */}
      {result.signals.length > 0 && (
        <SignalList result={result} />
      )}

      {/* ── Decision risk + attack forecast ──────────────────────── */}
      {!isSafe && (
        <div className="grid gap-6 lg:grid-cols-2">
          <DecisionRiskCard decisionRisk={result.decision_risk} />
          {result.attack_forecast && (
            <AttackForecastCard forecast={result.attack_forecast} />
          )}
        </div>
      )}

      {/* ── The four explanation layers ──────────────────────────── */}
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
        <ExplanationCard
          icon={<ShieldCheck className="h-4 w-4" />}
          tone="safe"
          title="Recommended safe action"
          subtitle="What to do right now"
          items={result.safe_actions}
        />
        <ExplanationCard
          icon={<SlashSquare className="h-4 w-4" />}
          tone="neutral"
          title="Block & report guidance"
          subtitle="Platform-agnostic steps you can take"
          items={result.block_report_guidance}
        />
      </div>

      {/* ── Disclaimer ──────────────────────────────────────────── */}
      <div className="rounded-2xl border border-ink-200 bg-white p-5 text-xs leading-relaxed text-ink-500">
        <strong className="text-ink-700">Important:</strong> SuSagi is a
        decision-support and educational tool. It does not automatically block,
        report, or take action on any content. Treat results as guidance, and
        when in doubt, verify through the sender&apos;s official channels.
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────── */

function VerdictIcon({ level }: { level: AnalysisResult["risk_level"] }) {
  switch (level) {
    case "Safe":
      return <CheckCircle2 className="h-3.5 w-3.5" />;
    case "Low Risk":
      return <ShieldCheck className="h-3.5 w-3.5" />;
    case "Suspicious":
      return <TriangleAlert className="h-3.5 w-3.5" />;
    case "Likely Scam":
      return <ShieldAlert className="h-3.5 w-3.5" />;
    case "High Risk":
    default:
      return <AlertOctagon className="h-3.5 w-3.5" />;
  }
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
  const offset = circumference - (score / 100) * circumference;
  const lowOffset = circumference - (low / 100) * circumference;
  const highOffset = circumference - (high / 100) * circumference;

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
        stroke="rgb(226 228 235)"
        strokeWidth={stroke}
        fill="none"
      />
      {/* confidence band (lighter) */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        className={cn(barClass, "opacity-25")}
        stroke="currentColor"
        strokeWidth={stroke}
        strokeDasharray={circumference}
        strokeDashoffset={highOffset}
        fill="none"
        strokeLinecap="round"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="rgb(226 228 235)"
        strokeWidth={stroke}
        strokeDasharray={circumference}
        strokeDashoffset={lowOffset}
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
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-ink-900 text-white">
          <ListChecks className="h-4 w-4" />
        </span>
        <div>
          <h3 className="text-base font-semibold text-ink-900">
            Detected signals
          </h3>
          <p className="text-xs text-ink-500">
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
              className="rounded-xl border border-ink-200 bg-white p-4 transition hover:border-ink-300"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={cn("h-2 w-2 shrink-0 rounded-full", st.dot)} />
                    <span className="text-sm font-semibold text-ink-900">
                      {s.label}
                    </span>
                  </div>
                  {s.evidence.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {s.evidence.map((ev, i) => (
                        <code
                          key={i}
                          className="rounded bg-ink-100 px-1.5 py-0.5 font-mono text-[12px] text-ink-800"
                        >
                          {ev}
                        </code>
                      ))}
                    </div>
                  )}
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
                    s.severity === "critical" && "border-red-300 bg-red-50 text-red-900",
                    s.severity === "high" && "border-red-200 bg-red-50 text-red-800",
                    s.severity === "medium" && "border-amber-200 bg-amber-50 text-amber-900",
                    s.severity === "low" && "border-lime-200 bg-lime-50 text-lime-800",
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
      return { bg: "bg-emerald-50", ring: "ring-emerald-200", text: "text-emerald-800", chip: "bg-emerald-50 text-emerald-800 border-emerald-200" };
    case "Moderate":
      return { bg: "bg-amber-50", ring: "ring-amber-200", text: "text-amber-900", chip: "bg-amber-50 text-amber-900 border-amber-200" };
    case "High":
      return { bg: "bg-red-50", ring: "ring-red-200", text: "text-red-800", chip: "bg-red-50 text-red-800 border-red-200" };
    case "Critical":
    default:
      return { bg: "bg-red-100", ring: "ring-red-300", text: "text-red-900", chip: "bg-red-100 text-red-900 border-red-300" };
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
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-ink-900 text-white">
              <Gauge className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-base font-semibold text-ink-900">Decision risk</h3>
              <p className="text-xs text-ink-500">
                How dangerous is the specific action being pressured, not just the message
              </p>
            </div>
          </div>
          <span className={cn("chip border shrink-0", theme.chip)}>
            {decisionRisk.level}
          </span>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-xl border border-ink-200 bg-white p-3">
            <div className="text-xl font-semibold tabular-nums text-ink-900">
              {decisionRisk.scam_probability}%
            </div>
            <div className="mt-1 text-[11px] uppercase tracking-wide text-ink-500">
              Scam probability
            </div>
          </div>
          <div className="rounded-xl border border-ink-200 bg-white p-3">
            <div className="text-xl font-semibold text-ink-900">
              {decisionRisk.potential_consequence}
            </div>
            <div className="mt-1 text-[11px] uppercase tracking-wide text-ink-500">
              Potential loss
            </div>
          </div>
          <div className="rounded-xl border border-ink-200 bg-white p-3">
            <div className="flex items-center justify-center gap-1 text-xl font-semibold tabular-nums text-ink-900">
              <Undo2 className="h-3.5 w-3.5 text-ink-400" />
              {decisionRisk.reversibility_score}
            </div>
            <div className="mt-1 text-[11px] uppercase tracking-wide text-ink-500">
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
    <div className="card overflow-hidden bg-ink-900 text-white">
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
          <div className="text-[11px] uppercase tracking-wide text-white/50">
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
          <div className="text-[11px] uppercase tracking-wide text-white/50">
            Potential outcome
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-white/80">
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
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  items: string[];
  tone: "warn" | "danger" | "safe" | "neutral";
}) {
  const toneStyles = {
    warn: "bg-amber-50 text-amber-900 border-amber-200",
    danger: "bg-red-50 text-red-900 border-red-200",
    safe: "bg-emerald-50 text-emerald-900 border-emerald-200",
    neutral: "bg-ink-900 text-white border-ink-900",
  }[tone];

  return (
    <div className="card flex h-full flex-col p-6">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "grid h-9 w-9 place-items-center rounded-lg border",
            toneStyles,
          )}
        >
          {icon}
        </span>
        <div>
          <h3 className="text-base font-semibold text-ink-900">{title}</h3>
          <p className="text-xs text-ink-500">{subtitle}</p>
        </div>
      </div>
      <ul className="mt-5 space-y-3 text-sm leading-relaxed text-ink-700">
        {items.map((item, i) => (
          <li key={i} className="flex gap-3">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-ink-400" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
