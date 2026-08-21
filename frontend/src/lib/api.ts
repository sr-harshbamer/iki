import type {
  AnalysisMode,
  AnalysisResult,
  EscalationItem,
  HistoryItem,
  ImageAnalysisResponse,
  InsightsSummary,
  SenderLookupResult,
} from "./types";

// The Next.js rewrite in next.config.js proxies /api/* to the FastAPI backend.
const BASE = "";

// Image analysis can take 20-60s (vision model + JSON schema constraint).
// Next.js's dev-server rewrite proxy times out well before that and resets
// the connection ("socket hang up"), so this one call goes straight to the
// backend instead of through the /api/* rewrite.
const DIRECT_API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function analyze(
  mode: AnalysisMode,
  content: string,
  senderId?: string,
): Promise<AnalysisResult> {
  const res = await fetch(`${BASE}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode,
      content,
      sender_id: senderId?.trim() || undefined,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Analysis failed: ${text}`);
  }
  return res.json();
}

export async function analyzeImage(
  file: File,
  senderId?: string,
): Promise<ImageAnalysisResponse> {
  const form = new FormData();
  form.append("file", file);
  if (senderId?.trim()) form.append("sender_id", senderId.trim());

  const res = await fetch(`${DIRECT_API_BASE}/api/analyze-image`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Analysis failed: ${text}`);
  }
  return res.json();
}

export async function lookupSender(senderId: string): Promise<SenderLookupResult> {
  const res = await fetch(`${BASE}/api/sender-lookup?sender_id=${encodeURIComponent(senderId)}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Lookup failed");
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

export async function fetchEscalations(limit = 20): Promise<EscalationItem[]> {
  const res = await fetch(`${BASE}/api/escalations?limit=${limit}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to load escalations");
  return res.json();
}
