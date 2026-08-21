export type AnalysisMode = "message" | "link" | "job_offer" | "image";

export type RiskLevel =
  | "Safe"
  | "Low Risk"
  | "Suspicious"
  | "Likely Scam"
  | "High Risk";

export type ThreatCategory =
  | "Phishing"
  | "Fake Job Offer"
  | "Suspicious Link"
  | "OTP Scam"
  | "Impersonation"
  | "Financial Fraud"
  | "Unknown Suspicious Pattern"
  | "No Clear Threat Detected";

export type Severity = "low" | "medium" | "high" | "critical";

export interface Signal {
  id: string;
  label: string;
  severity: Severity;
  evidence: string[];
  category_hint: ThreatCategory | null;
}

export interface HighlightedPhrase {
  phrase: string;
  reason: string;
}

export type DecisionRiskLevel = "Low" | "Moderate" | "High" | "Critical";

export interface DecisionRisk {
  scam_probability: number;
  potential_consequence: "Low" | "Medium" | "High";
  reversibility_score: number;
  level: DecisionRiskLevel;
}

export interface AttackForecast {
  predicted_next_step: string;
  confidence: number;
  potential_outcome: string;
}

export interface AnalysisResult {
  mode: AnalysisMode;
  risk_level: RiskLevel;
  risk_score: number;
  confidence_low: number;
  confidence_high: number;
  threat_category: ThreatCategory;
  signals: Signal[];
  why_flagged: string[];
  why_not_proceed: string[];
  safe_actions: string[];
  block_report_guidance: string[];
  highlighted_phrases: HighlightedPhrase[];
  decision_risk: DecisionRisk;
  attack_forecast: AttackForecast | null;
  analyzed_at: string;
}

export interface ImageAnalysisResponse {
  result: AnalysisResult;
  extracted_text: string;
}

export interface InsightsSummary {
  total_analyses: number;
  by_category: { category: string; count: number }[];
  by_level: { level: string; count: number }[];
  by_mode: { mode: string; count: number }[];
  top_signals: { signal_id: string; count: number }[];
  top_phrases: { phrase: string; count: number }[];
}

export interface HistoryItem {
  mode: string;
  risk_level: string;
  risk_score: number;
  threat_category: string;
  preview: string;
  created_at: string;
}

export interface SenderLookupResult {
  found: boolean;
  sender_id: string;
  message_count: number;
  avg_risk_score: number;
  risk_level: RiskLevel | null;
  signal_ids: string[];
  last_seen: string | null;
}

export interface EscalationItem {
  mode: string;
  risk_level: string;
  risk_score: number;
  threat_category: string;
  preview: string;
  notified_webhook: number;
  created_at: string;
}
