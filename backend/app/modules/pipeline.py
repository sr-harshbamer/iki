"""
Pipeline orchestrator.

Ties the analyzers, scorer, explainer, and guidance modules together
into a single `run_analysis` call used by the API layer.
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from .anomaly_detection import detect_sender_anomaly
from .block_report_guidance import build_block_report_guidance
from .explanation_engine import (
    build_highlighted_phrases,
    build_why_flagged,
    build_why_not_proceed,
)
from .job_offer_analysis import analyze_job_offer
from .link_analysis import analyze_link
from .llm_analysis import analyze_with_llm
from .message_analysis import analyze_message
from .risk_scoring import score_signals
from .safe_action_guidance import build_safe_actions
from .schemas import (
    AnalysisMode,
    AnalysisRequest,
    AnalysisResult,
    RiskLevel,
    ThreatCategory,
)


def run_analysis(req: AnalysisRequest, sender_profile: Optional[dict] = None) -> AnalysisResult:
    if req.mode == AnalysisMode.MESSAGE:
        signals, category = analyze_message(req.content)
    elif req.mode == AnalysisMode.LINK:
        signals, category = analyze_link(req.content)
    elif req.mode == AnalysisMode.JOB_OFFER:
        signals, category = analyze_job_offer(req.content)
    else:
        raise ValueError(f"Unsupported mode: {req.mode}")

    # Semantic LLM pass -- catches inconsistencies/tone that rules can't.
    # Skipped for link mode (a bare URL has no tone or logic to evaluate).
    if req.mode in (AnalysisMode.MESSAGE, AnalysisMode.JOB_OFFER):
        signals = signals + analyze_with_llm(req.content, req.mode)

    score, level, (conf_low, conf_high) = score_signals(signals)

    # Sender anomaly pass -- compares this message against the sender's own
    # history (only runs when the caller supplied a known sender profile).
    # Uses the score computed above as the "baseline-relative" comparison
    # point, then rescoring folds any anomaly signal into the final result.
    if sender_profile is not None:
        anomaly_signals = detect_sender_anomaly(
            sender_profile, score, {s.id for s in signals}
        )
        if anomaly_signals:
            signals = signals + anomaly_signals
            score, level, (conf_low, conf_high) = score_signals(signals)

    # If nothing triggered, we surface that clearly instead of faking risk
    if level == RiskLevel.SAFE and category == ThreatCategory.NONE:
        why_flagged = [
            "No known red-flag patterns were detected in the content you provided."
        ]
        why_not_proceed = [
            "Even clean-looking content can be risky in context. If you did not "
            "expect this message or link, still verify the sender through an "
            "independent channel before acting."
        ]
    else:
        why_flagged = build_why_flagged(signals)
        why_not_proceed = build_why_not_proceed(signals)

    safe_actions = build_safe_actions(req.mode, category, signals)
    block_report = build_block_report_guidance(req.mode, category)
    highlights = build_highlighted_phrases(signals)

    return AnalysisResult(
        mode=req.mode,
        risk_level=level,
        risk_score=score,
        confidence_low=conf_low,
        confidence_high=conf_high,
        threat_category=category,
        signals=signals,
        why_flagged=why_flagged,
        why_not_proceed=why_not_proceed,
        safe_actions=safe_actions,
        block_report_guidance=block_report,
        highlighted_phrases=highlights,
        analyzed_at=datetime.utcnow().isoformat(timespec="seconds") + "Z",
    )
