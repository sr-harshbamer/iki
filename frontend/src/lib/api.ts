import type {
  AnalysisMode,
  AnalysisResult,
  HistoryItem,
  InsightsSummary,
} from "./types";

// The Next.js rewrite in next.config.js proxies /api/* to the FastAPI backend.
const BASE = "";

export async function analyze(
  mode: AnalysisMode,
  content: string,
): Promise<AnalysisResult> {
  const res = await fetch(`${BASE}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode, content }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Analysis failed: ${text}`);
  }
  return res.json();
}

export async function fetchInsights(): Promise<InsightsSummary> {
  const res = await fetch(`${BASE}/api/insights`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load insights");
  return res.json();
}

export async function fetchHistory(limit = 20): Promise<HistoryItem[]> {
  const res = await fetch(`${BASE}/api/history?limit=${limit}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to load history");
  return res.json();
}
