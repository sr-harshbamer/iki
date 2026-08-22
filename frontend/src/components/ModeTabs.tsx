"use client";

import { cn } from "@/lib/cn";
import type { AnalysisMode } from "@/lib/types";
import {
  BriefcaseBusiness,
  ImageIcon,
  Link2,
  MessageSquareWarning,
} from "lucide-react";

const TABS: { id: AnalysisMode; label: string; icon: React.ReactNode; hint: string }[] = [
  {
    id: "message",
    label: "Message Check",
    icon: <MessageSquareWarning className="h-4 w-4" />,
    hint: "SMS, chat, or email text",
  },
  {
    id: "link",
    label: "Link Check",
    icon: <Link2 className="h-4 w-4" />,
    hint: "A single URL",
  },
  {
    id: "job_offer",
    label: "Job Offer Check",
    icon: <BriefcaseBusiness className="h-4 w-4" />,
    hint: "Recruiter message or posting",
  },
  {
    id: "image",
    label: "Image Check",
    icon: <ImageIcon className="h-4 w-4" />,
    hint: "Screenshot of a message or QR code",
  },
];

export function ModeTabs({
  value,
  onChange,
}: {
  value: AnalysisMode;
  onChange: (mode: AnalysisMode) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Select analysis mode"
      className="grid grid-cols-1 gap-2 rounded-2xl border border-ink-800 bg-ink-900/60 p-2 shadow-soft sm:grid-cols-2 lg:grid-cols-4"
    >
      {TABS.map((t) => {
        const active = value === t.id;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className={cn(
              "group flex items-center gap-3 rounded-xl px-4 py-3 text-left transition",
              active
                ? "bg-brand-600 text-white shadow-glow"
                : "text-ink-300 hover:bg-ink-800",
            )}
          >
            <span
              className={cn(
                "grid h-9 w-9 shrink-0 place-items-center rounded-lg",
                active ? "bg-white/15 text-white" : "bg-brand-950 text-brand-600",
              )}
            >
              {t.icon}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold">{t.label}</span>
              <span
                className={cn(
                  "block text-xs",
                  active ? "text-white/70" : "text-ink-500",
                )}
              >
                {t.hint}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
