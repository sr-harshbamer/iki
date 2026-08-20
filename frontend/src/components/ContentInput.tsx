"use client";

import { cn } from "@/lib/cn";
import type { AnalysisMode } from "@/lib/types";
import { Sparkles } from "lucide-react";

/**
 * Per-mode sample inputs. These are short, realistic, and cover the red flags
 * each analyzer looks for — so users can see the result experience immediately.
 */
const SAMPLES: Record<AnalysisMode, { label: string; value: string }[]> = {
  message: [
    {
      label: "Bank OTP phishing",
      value:
        "URGENT: Your BCA account is suspended. Verify now with OTP 828311 at http://bca-secure.xyz/login within 30 minutes or it will be closed.",
    },
    {
      label: "Parcel redelivery scam",
      value:
        "Your DHL parcel could not be delivered. Reschedule within 24 hours at http://dhl-reschedule.top/update to avoid return.",
    },
    {
      label: "Legitimate message",
      value: "Hey, are we still on for lunch tomorrow at noon?",
    },
  ],
  link: [
    {
      label: "Typosquatted brand",
      value: "http://paypa1-secure.login.xyz/account/verify?user=1",
    },
    {
      label: "Shortened link",
      value: "https://bit.ly/3xAbCdE",
    },
    {
      label: "Legitimate site",
      value: "https://github.com/torvalds/linux",
    },
  ],
  job_offer: [
    {
      label: "Advance-fee recruiter",
      value:
        "Congratulations! You're hired immediately as a data entry specialist, $500/day no experience needed. Pay a $50 training fee first. Contact recruiter@gmail.com or Telegram +628123456789.",
    },
    {
      label: "Mule-style role",
      value:
        "Work from home, flexible hours. Reshipping agent role, no skills required. Send passport photo to verify. Bank details needed for setup.",
    },
    {
      label: "Plausible offer",
      value:
        "Software Engineer position at Acme Corp. Interview scheduled next week via our careers page at acme.com/careers. HR contact: hr@acme.com.",
    },
  ],
};

export function ContentInput({
  mode,
  value,
  onChange,
  disabled,
}: {
  mode: AnalysisMode;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const placeholder =
    mode === "link"
      ? "Paste the full URL, including https://"
      : mode === "job_offer"
      ? "Paste the recruiter message, job description, or offer email"
      : "Paste the suspicious SMS, chat, or email text";

  const limit = mode === "link" ? 500 : 6000;
  const tooLong = value.length > limit;

  return (
    <div className="space-y-3">
      <label className="flex items-center justify-between">
        <span className="text-sm font-medium text-ink-800">
          Content to analyze
        </span>
        <span
          className={cn(
            "text-xs",
            tooLong ? "text-red-600" : "text-ink-400",
          )}
        >
          {value.length} / {limit}
        </span>
      </label>

      {mode === "link" ? (
        <input
          type="text"
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="none"
          className="input font-mono"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
      ) : (
        <textarea
          rows={8}
          spellCheck={false}
          className="input min-h-[180px] resize-y leading-relaxed"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
      )}

      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-500">
          <Sparkles className="h-3.5 w-3.5" />
          Try a sample:
        </span>
        {SAMPLES[mode].map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => onChange(s.value)}
            className="chip transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800"
            disabled={disabled}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
