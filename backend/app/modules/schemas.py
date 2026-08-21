"""
Shared data contracts for SuSagi's analysis pipeline.

Every analyzer (message / link / job offer) produces a list of `Signal` objects.
The risk scorer aggregates them, and the explanation engine maps them to
human-readable reasoning. This keeps the pipeline modular and testable.
"""
from __future__ import annotations

from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


class AnalysisMode(str, Enum):
    MESSAGE = "message"
    LINK = "link"
    JOB_OFFER = "job_offer"
    IMAGE = "image"


class RiskLevel(str, Enum):
    SAFE = "Safe"
    LOW_RISK = "Low Risk"
    SUSPICIOUS = "Suspicious"
    LIKELY_SCAM = "Likely Scam"
    HIGH_RISK = "High Risk"


class ThreatCategory(str, Enum):
    PHISHING = "Phishing"
    FAKE_JOB_OFFER = "Fake Job Offer"
    SUSPICIOUS_LINK = "Suspicious Link"
    OTP_SCAM = "OTP Scam"
    IMPERSONATION = "Impersonation"
    FINANCIAL_FRAUD = "Financial Fraud"
    UNKNOWN_SUSPICIOUS = "Unknown Suspicious Pattern"
    NONE = "No Clear Threat Detected"


class Severity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class Signal(BaseModel):
    """A single detected red flag with the exact evidence that triggered it."""
    id: str
    label: str                    # Short human label, e.g. "Urgency pressure"
    severity: Severity
    evidence: List[str] = Field(default_factory=list)  # Exact snippets matched
    category_hint: Optional[ThreatCategory] = None


class AnalysisRequest(BaseModel):
    mode: AnalysisMode
    content: str = Field(..., min_length=1, max_length=8000)
    # Optional, user-chosen tag (e.g. a phone number or handle) used only to
    # build a communication baseline for anomaly detection. Not required --
    # omitting it keeps analysis fully anonymous as before.
    sender_id: Optional[str] = Field(default=None, max_length=120)


class HighlightedPhrase(BaseModel):
    phrase: str
    reason: str


class AttackForecast(BaseModel):
    """What the attacker is likely to ask for next, based on which stage of
    a known scam pattern the current content matches. A forecast, not a
    guarantee -- always carries a confidence, never presented as certain."""
    predicted_next_step: str
    confidence: int                # 0-100
    potential_outcome: str


class DecisionRiskLevel(str, Enum):
    LOW = "Low"
    MODERATE = "Moderate"
    HIGH = "High"
    CRITICAL = "Critical"


class DecisionRisk(BaseModel):
    """Answers a different question than the risk score: not "is this a
    scam" but "how dangerous is the specific decision being pressured
    here" -- combining scam likelihood with what's actually at stake and
    how hard it would be to undo if acted on."""
    scam_probability: int          # 0-100, mirrors risk_score
    potential_consequence: str     # "Low" | "Medium" | "High"
    reversibility_score: int       # 0-100, LOWER = harder to undo if acted on
    level: DecisionRiskLevel


class AnalysisResult(BaseModel):
    """The full 6-layer output returned to the frontend."""
    mode: AnalysisMode
    risk_level: RiskLevel
    risk_score: int               # 0-100
    confidence_low: int           # 0-100
    confidence_high: int          # 0-100
    threat_category: ThreatCategory
    signals: List[Signal]
    why_flagged: List[str]        # Layer 3
    why_not_proceed: List[str]    # Layer 4
    safe_actions: List[str]       # Layer 5
    block_report_guidance: List[str]  # Layer 6
    highlighted_phrases: List[HighlightedPhrase]
    decision_risk: DecisionRisk
    attack_forecast: Optional[AttackForecast] = None
    analyzed_at: str              # ISO timestamp


class ImageAnalysisResponse(BaseModel):
    """Response for /api/analyze-image. Includes the vision-extracted text
    alongside the usual result, since there's no original text input for the
    frontend to fall back on when displaying the analyzed content."""
    result: AnalysisResult
    extracted_text: str
