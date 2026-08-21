"use client";

import { ATTACK_SCENARIOS } from "@/lib/scenarios";
import { useRouter } from "next/navigation";
import { Landmark, PhoneCall, ShieldCheck, Users } from "lucide-react";

const ICONS: Record<string, React.ReactNode> = {
  family: <Users className="h-5 w-5" />,
  bank: <Landmark className="h-5 w-5" />,
  hr: <PhoneCall className="h-5 w-5" />,
  safe: <ShieldCheck className="h-5 w-5" />,
};

/**
 * "Simulate Attack" -- lets anyone (a judge, a first-time visitor) trigger
 * a realistic scam scenario in one click and watch the real pipeline run,
 * instead of needing to write or paste something themselves first.
 */
export function AttackSimulator() {
  const router = useRouter();

  return (
    <div className="card p-6 sm:p-7">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-ink-900 text-white">
          <ShieldCheck className="h-4 w-4" />
        </span>
        <div>
          <h3 className="text-base font-semibold text-ink-900">
            Attack Simulator
          </h3>
          <p className="text-xs text-ink-500">
            Pick a real scam pattern and watch SuSagi analyze it live — same engine, same pipeline
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {ATTACK_SCENARIOS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => router.push(`/analyze?scenario=${s.id}`)}
            className="group flex flex-col gap-2 rounded-xl border border-ink-200 bg-white p-4 text-left transition hover:border-brand-300 hover:bg-brand-50/40"
          >
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700 group-hover:bg-brand-100">
                {ICONS[s.id]}
              </span>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-ink-900">{s.label}</div>
                <div className="text-[11px] uppercase tracking-wide text-ink-400">
                  {s.category}
                </div>
              </div>
            </div>
            <p className="text-xs italic leading-relaxed text-ink-600">
              {s.description}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
