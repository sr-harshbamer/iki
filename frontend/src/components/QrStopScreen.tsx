"use client";

import type { AnalysisResult } from "@/lib/types";
import { AlertOctagon, ShieldOff } from "lucide-react";

/**
 * The Truecaller-style moment: a dangerous QR code doesn't get a card
 * quietly sitting among six others -- it gets a full-screen, undeniable
 * stop, the same instinct as a red incoming-call overlay. The user has to
 * explicitly acknowledge the risk to see anything else, matching the
 * "psychological circuit breaker" pattern real call-screening apps use
 * before letting a risky action proceed.
 */
export function QrStopScreen({
  result,
  onAcknowledge,
}: {
  result: AnalysisResult;
  onAcknowledge: () => void;
}) {
  const destination = result.signals.find((s) => s.id === "qr_code_detected")?.evidence[0];
  const topReasons = result.why_flagged.slice(0, 3);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-red-700 p-6">
      <div className="w-full max-w-md text-center text-white">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-white/15">
          <ShieldOff className="h-10 w-10" />
        </div>
        <h1 className="mt-6 text-3xl font-bold tracking-tight">Don&apos;t scan this QR</h1>
        <p className="mt-2 text-sm text-red-100">
          {result.risk_level} &middot; {result.risk_score}/100 risk
        </p>

        {destination && (
          <div className="mt-6 rounded-xl border border-white/20 bg-black/20 p-3">
            <div className="text-[11px] uppercase tracking-wide text-red-200">Destination</div>
            <div className="mt-1 break-all font-mono text-sm text-white">{destination}</div>
          </div>
        )}

        {topReasons.length > 0 && (
          <ul className="mt-6 space-y-2 text-left text-sm text-red-50">
            {topReasons.map((reason, i) => (
              <li key={i} className="flex gap-2">
                <AlertOctagon className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-8 flex flex-col gap-3">
          <a
            href="/"
            className="rounded-xl bg-white px-6 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-50"
          >
            Don&apos;t proceed — leave this page
          </a>
          <button
            type="button"
            onClick={onAcknowledge}
            className="text-xs text-red-200 underline decoration-dotted underline-offset-4 transition hover:text-white"
          >
            I understand the risk — show full details anyway
          </button>
        </div>
      </div>
    </div>
  );
}
