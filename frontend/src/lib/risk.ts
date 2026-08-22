import type { RiskLevel, Severity } from "./types";

export function riskTheme(level: RiskLevel) {
  switch (level) {
    case "Safe":
      return {
        label: "Safe",
        accent: "text-severity-safe",
        bg: "bg-emerald-950/30",
        ring: "ring-emerald-800/60",
        bar: "text-severity-safe",
        chip: "bg-emerald-950/50 text-emerald-300 border-emerald-800",
        headline: "No red flags detected",
      };
    case "Low Risk":
      return {
        label: "Low Risk",
        accent: "text-severity-low",
        bg: "bg-lime-950/30",
        ring: "ring-lime-800/60",
        bar: "text-severity-low",
        chip: "bg-lime-950/50 text-lime-300 border-lime-800",
        headline: "Low-risk indicators present",
      };
    case "Suspicious":
      return {
        label: "Suspicious",
        accent: "text-severity-suspicious",
        bg: "bg-amber-950/30",
        ring: "ring-amber-800/60",
        bar: "text-severity-suspicious",
        chip: "bg-amber-950/50 text-amber-300 border-amber-800",
        headline: "Proceed with caution",
      };
    case "Likely Scam":
      return {
        label: "Likely Scam",
        accent: "text-severity-scam",
        bg: "bg-red-950/30",
        ring: "ring-red-800/60",
        bar: "text-severity-scam",
        chip: "bg-red-950/50 text-red-300 border-red-800",
        headline: "Strong scam indicators",
      };
    case "High Risk":
    default:
      return {
        label: "High Risk",
        accent: "text-severity-high",
        bg: "bg-red-950/50",
        ring: "ring-red-700",
        bar: "text-severity-high",
        chip: "bg-red-900/60 text-red-200 border-red-700",
        headline: "Do not engage",
      };
  }
}

export function severityTheme(s: Severity) {
  switch (s) {
    case "low":
      return { dot: "bg-lime-500", text: "text-lime-300", label: "Low" };
    case "medium":
      return { dot: "bg-amber-500", text: "text-amber-300", label: "Medium" };
    case "high":
      return { dot: "bg-red-500", text: "text-red-300", label: "High" };
    case "critical":
    default:
      return { dot: "bg-red-600", text: "text-red-200", label: "Critical" };
  }
}

export function modeLabel(mode: string): string {
  if (mode === "message") return "Message Check";
  if (mode === "link") return "Link Check";
  if (mode === "job_offer") return "Job Offer Check";
  if (mode === "image") return "Image Check";
  if (mode === "voice_call") return "Voice Guard";
  return mode;
}
