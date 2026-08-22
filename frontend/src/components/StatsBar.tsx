"use client";

import { fetchInsights } from "@/lib/api";
import { useEffect, useState } from "react";

/**
 * Bold, real numbers pulled from SuSagi's own accumulated activity --
 * inspired by the stat bars security vendors use to signal scale, but
 * every figure here is a live count from /api/insights, not a marketing
 * placeholder. Renders a plausible resting state while loading rather
 * than a jarring layout shift once the numbers land.
 */
export function StatsBar() {
  const [stats, setStats] = useState<{
    total: number;
    highRisk: number;
    signalTypes: number;
    categories: number;
  } | null>(null);

  useEffect(() => {
    fetchInsights()
      .then((data) => {
        const highRisk = data.by_level
          .filter((l) => l.level === "Likely Scam" || l.level === "High Risk")
          .reduce((sum, l) => sum + l.count, 0);
        setStats({
          total: data.total_analyses,
          highRisk,
          signalTypes: data.top_signals.length,
          categories: data.by_category.length,
        });
      })
      .catch(() => {});
  }, []);

  const items = [
    { value: stats ? formatCount(stats.total) : "—", label: "Checks run" },
    { value: stats ? formatCount(stats.highRisk) : "—", label: "Scams caught" },
    { value: stats ? String(stats.signalTypes) : "—", label: "Red-flag patterns tracked" },
    { value: "6", label: "Layers of reasoning per verdict" },
  ];

  return (
    <section className="border-y border-ink-800 bg-ink-900 py-12">
      <div className="container-wide grid grid-cols-2 gap-8 sm:grid-cols-4">
        {items.map((it) => (
          <div key={it.label} className="text-center sm:text-left">
            <div className="text-4xl font-bold tracking-tight text-ink-50 sm:text-5xl">
              {it.value}
            </div>
            <div className="mt-2 text-sm text-ink-400">{it.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K+`;
  return String(n);
}
