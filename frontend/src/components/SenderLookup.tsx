"use client";

import { cn } from "@/lib/cn";
import { lookupSender } from "@/lib/api";
import { riskTheme } from "@/lib/risk";
import { signalLabel } from "@/lib/signalLabels";
import type { RiskLevel, SenderLookupResult } from "@/lib/types";
import { Loader2, PhoneCall, Search, ShieldQuestion } from "lucide-react";
import { useState } from "react";

/**
 * "Check before you answer" -- the one thing a paste-and-check tool can't
 * do on its own: look a number or handle up BEFORE you've even opened
 * whatever it just sent you. Built entirely on SuSagi's own accumulated
 * sender history (real prior checks against that tag), not a purchased or
 * fabricated reputation database -- so a tag with no history correctly
 * says so, rather than pretending to know.
 */
export function SenderLookup() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SenderLookupResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheck = async () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await lookupSender(trimmed);
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lookup failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card p-6 sm:p-7">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/10 text-ink-50">
          <PhoneCall className="h-4 w-4" />
        </span>
        <div>
          <h3 className="text-base font-semibold text-ink-50">
            Check before you answer
          </h3>
          <p className="text-xs text-ink-400">
            Look up a number or handle&apos;s history before opening what it just sent you
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCheck()}
          placeholder="e.g. a phone number or handle you tagged before"
          className="input flex-1"
          spellCheck={false}
          autoComplete="off"
        />
        <button
          type="button"
          onClick={handleCheck}
          disabled={loading || !query.trim()}
          className="btn-brand shrink-0 px-5"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
          Check
        </button>
      </div>
      <p className="mt-2 text-xs text-ink-500">
        Built from SuSagi&apos;s own accumulated checks — try{" "}
        <button
          type="button"
          onClick={() => setQuery("sim-dad")}
          className="font-medium text-brand-400 underline decoration-dotted underline-offset-2"
        >
          sim-dad
        </button>{" "}
        (used in the Family Impersonation scenario above) to see a real history.
      </p>

      {error && (
        <p className="mt-4 text-sm text-red-400">{error}</p>
      )}

      {result && <LookupResult result={result} />}
    </div>
  );
}

function LookupResult({ result }: { result: SenderLookupResult }) {
  if (!result.found) {
    return (
      <div className="mt-5 flex items-start gap-3 rounded-xl border border-ink-800 bg-ink-950/60 p-4">
        <ShieldQuestion className="mt-0.5 h-4 w-4 shrink-0 text-ink-500" />
        <div className="text-sm text-ink-300">
          <span className="font-medium text-ink-100">No history for &ldquo;{result.sender_id}&rdquo; yet.</span>{" "}
          SuSagi hasn&apos;t seen a check against this tag before — that means
          unknown, not necessarily safe. Still verify independently before acting.
        </div>
      </div>
    );
  }

  const theme = riskTheme((result.risk_level ?? "Safe") as RiskLevel);

  return (
    <div className={cn("mt-5 rounded-xl border p-4", theme.bg, theme.ring, "ring-1")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-ink-50">
          &ldquo;{result.sender_id}&rdquo;
        </span>
        <span className={cn("chip border", theme.chip)}>{result.risk_level}</span>
      </div>
      <p className="mt-2 text-sm text-ink-300">
        {result.message_count} previous {result.message_count === 1 ? "check" : "checks"}{" "}
        averaged <strong>{result.avg_risk_score}/100</strong> risk.
      </p>
      {result.signal_ids.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {result.signal_ids.map((id) => (
            <span
              key={id}
              className="rounded-full border border-ink-800 bg-ink-950/60 px-2.5 py-1 text-xs text-ink-300"
            >
              {signalLabel(id)}
            </span>
          ))}
        </div>
      )}
      {result.last_seen && (
        <p className="mt-3 text-xs text-ink-500">
          Last checked {new Date(result.last_seen).toLocaleString()}
        </p>
      )}
    </div>
  );
}
