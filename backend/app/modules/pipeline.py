"""
Pipeline orchestrator.

Ties the analyzers, scorer, explainer, and guidance modules together
into a single `run_analysis` call used by the API layer.
"""
from __future__ import annotations

from datetime import datetime
from typing import List, Optional, Tuple

from .anomaly_detection import detect_sender_anomaly
from .block_report_guidance import build_block_report_guidance
from .decision_risk import assess_decision_risk
from .explanation_engine import (
    build_highlighted_phrases,
    build_why_flagged,
    build_why_not_proceed,
)
from .image_analysis import GEMINI_API_KEY, analyze_image_with_llm, decode_qr_signals
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
    AttackForecast,
    RiskLevel,
    Signal,
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
    forecast: Optional[AttackForecast] = None
    if req.mode in (AnalysisMode.MESSAGE, AnalysisMode.JOB_OFFER):
        llm_signals, forecast = analyze_with_llm(req.content, req.mode)
        signals = signals + llm_signals

    return _build_result(req.mode, category, signals, sender_profile, forecast=forecast)


def run_image_analysis(
    image_bytes: bytes,
    mime_type: str,
    sender_profile: Optional[dict] = None,
) -> Tuple[AnalysisResult, str, Optional[str]]:
    """
    Screenshot intelligence: vision-extract text + visual cues from the
    image, run the extracted text through the exact same pipeline as a
    pasted message, decode any QR code into a real link-analysis (URL) or
    UPI payment check, and merge everything into one result.

    Returns (result, extracted_text, payee_vpa) -- extracted_text is shown
    to the user as the "analyzed content"; payee_vpa is set only for a
    payment QR code, so the caller can persist that specific payee's
    reputation for future scans (see /api/sender-lookup, which already
    exposes it under the "upi:<vpa>" tag with no new UI needed).
    """
    extracted_text, visual_signals = analyze_image_with_llm(image_bytes, mime_type)
    qr_value, qr_signals, qr_category, payee_vpa = decode_qr_signals(image_bytes)

    text_signals: List[Signal] = []
    category = ThreatCategory.NONE
    forecast: Optional[AttackForecast] = None
    if extracted_text:
        text_signals, category = analyze_message(extracted_text)
        llm_signals, forecast = analyze_with_llm(extracted_text, AnalysisMode.MESSAGE)
        text_signals = text_signals + llm_signals

    if category == ThreatCategory.NONE:
        category = qr_category

    signals = text_signals + visual_signals + qr_signals

    empty_reason = None
    if not extracted_text and not qr_value and not GEMINI_API_KEY:
        empty_reason = (
            "SuSagi could not read this image because no vision API key is "
            "configured yet -- ask the site operator to set GEMINI_API_KEY."
        )

    result = _build_result(
        AnalysisMode.IMAGE, category, signals, sender_profile, empty_reason, forecast
    )
    return result, extracted_text, payee_vpa


def _build_result(
    mode: AnalysisMode,
    category: ThreatCategory,
    signals: List[Signal],
    sender_profile: Optional[dict],
    empty_reason: Optional[str] = None,
    forecast: Optional[AttackForecast] = None,
) -> AnalysisResult:
    score, level, (conf_low, conf_high) = score_signals(signals)

    # Sender anomaly pass -- compares this analysis against the sender's own
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
            empty_reason
            or "No known red-flag patterns were detected in the content you provided."
        ]
        why_not_proceed = [
            "Even clean-looking content can be risky in context. If you did not "
            "expect this message or link, still verify the sender through an "
            "independent channel before acting."
        ]
        # A forecast with nothing to base it on isn't a forecast -- it's a guess.
        forecast = None
    else:
        why_flagged = build_why_flagged(signals)
        why_not_proceed = build_why_not_proceed(signals)

    # Image screenshots are almost always a photographed message (SMS/chat/
    # email) -- reuse MESSAGE-mode remediation guidance so users still get
    # concrete "block/report" steps instead of a generic fallback.
    guidance_mode = AnalysisMode.MESSAGE if mode == AnalysisMode.IMAGE else mode
    safe_actions = build_safe_actions(guidance_mode, category, signals)
    block_report = build_block_report_guidance(guidance_mode, category)
    highlights = build_highlighted_phrases(signals)
    decision_risk = assess_decision_risk(signals, score)

    return AnalysisResult(
        mode=mode,
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
        decision_risk=decision_risk,
        attack_forecast=forecast,
        analyzed_at=datetime.utcnow().isoformat(timespec="seconds") + "Z",
    )
