import type { RiskLevel, Severity } from "./types";

/**
 * Every tier pairs a color with an icon and plain-language text — never
 * color alone (WCAG 2.2). Headlines avoid jargon ("risk score", "confidence")
 * so the verdict reads the same to a child, an elderly user, or someone new
 * to smartphones: what happened, in one sentence.
 */
export function riskTheme(level: RiskLevel) {
  switch (level) {
    case "Safe":
      return {
        label: "Safe",
        accent: "text-severity-safe",
        bg: "bg-emerald-50",
        ring: "ring-emerald-300",
        bar: "text-severity-safe",
        chip: "bg-emerald-50 text-emerald-800 border-emerald-300",
        headline: "Nothing suspicious detected",
      };
    case "Low Risk":
      return {
        label: "Low Risk",
        accent: "text-severity-low",
        bg: "bg-lime-50",
        ring: "ring-lime-300",
        bar: "text-severity-low",
        chip: "bg-lime-50 text-lime-800 border-lime-300",
        headline: "Mostly safe — minor caution advised",
      };
    case "Suspicious":
      return {
        label: "Suspicious",
        accent: "text-severity-suspicious",
        bg: "bg-amber-50",
        ring: "ring-amber-300",
        bar: "text-severity-suspicious",
        chip: "bg-amber-50 text-amber-800 border-amber-300",
        headline: "Be careful — this may not be safe",
      };
    case "Likely Scam":
      return {
        label: "Likely Scam",
        accent: "text-severity-scam",
        bg: "bg-red-50",
        ring: "ring-red-300",
        bar: "text-severity-scam",
        chip: "bg-red-50 text-red-800 border-red-300",
        headline: "This looks like a scam",
      };
    case "High Risk":
    default:
      return {
        label: "High Risk",
        accent: "text-severity-high",
        bg: "bg-red-100",
        ring: "ring-red-400",
        bar: "text-severity-high",
        chip: "bg-red-100 text-red-900 border-red-400",
        headline: "Danger — do not proceed",
      };
  }
}

export function severityTheme(s: Severity) {
  switch (s) {
    case "low":
      return { dot: "bg-lime-600", text: "text-lime-800", label: "Low" };
    case "medium":
      return { dot: "bg-amber-600", text: "text-amber-800", label: "Medium" };
    case "high":
      return { dot: "bg-red-600", text: "text-red-800", label: "High" };
    case "critical":
    default:
      return { dot: "bg-red-800", text: "text-red-900", label: "Critical" };
  }
}

export function modeLabel(mode: string): string {
  if (mode === "message") return "Message Check";
  if (mode === "link") return "Link Check";
  if (mode === "job_offer") return "Job Offer Check";
  if (mode === "image") return "Image Check";
  if (mode === "voice_call") return "Voice Guard";
  if (mode === "voice_clip") return "Voice Guard";
  return mode;
}
