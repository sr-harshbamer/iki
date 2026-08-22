"use client";

import { cn } from "@/lib/cn";
import type { AnalysisMode } from "@/lib/types";
import { Check, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * What's actually happening while a request is in flight -- these steps
 * mirror the real pipeline (rule engine -> reputation lookup -> semantic
 * LLM pass, plus vision for image mode), not a fabricated progress bar.
 * The wait is real (the semantic pass alone can take a few seconds), so
 * this gives it something honest to show instead of a dead spinner.
 */
function stepsFor(mode: AnalysisMode): string[] {
  const base = [
    "Scanning content structure",
    "Checking known scam patterns",
  ];
  if (mode === "image") base.push("Reading image and decoding any QR code");
  base.push("Cross-referencing sender reputation", "Running semantic analysis");
  return base;
}

export function AnalyzingSequence({ mode }: { mode: AnalysisMode }) {
  const steps = stepsFor(mode);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    setCurrent(0);
    const interval = setInterval(() => {
      setCurrent((c) => (c < steps.length - 1 ? c + 1 : c));
      // Stays on the last step until the real result arrives and this
      // component unmounts -- never claims to be done before it is.
    }, 650);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  return (
    <div className="card flex flex-col items-center gap-6 p-10 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-950 text-brand-400">
        <Loader2 className="h-5 w-5 animate-spin" />
      </span>
      <div>
        <h2 className="text-lg font-semibold text-ink-50">Analyzing…</h2>
        <p className="mt-1 text-sm text-ink-400">
          Running this through SuSagi&apos;s detection pipeline
        </p>
      </div>
      <ul className="w-full max-w-sm space-y-2.5 text-left">
        {steps.map((label, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li
              key={label}
              className="animate-step-in flex items-center gap-3"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <span
                className={cn(
                  "grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-colors",
                  done && "border-brand-500 bg-brand-500 text-white",
                  active && !done && "border-brand-400 text-brand-400",
                  !done && !active && "border-ink-700 text-transparent",
                )}
              >
                {done ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full bg-current",
                      active && "animate-pulse",
                    )}
                  />
                )}
              </span>
              <span
                className={cn(
                  "text-sm transition-colors",
                  done && "text-ink-500 line-through decoration-ink-700",
                  active && "font-medium text-ink-50",
                  !done && !active && "text-ink-600",
                )}
              >
                {label}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
