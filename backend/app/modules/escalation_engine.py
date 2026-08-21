"""
Escalation engine.

When an analysis comes back at high risk, this module tells someone instead
of leaving the verdict to sit unseen: it pushes a webhook alert to a
designated "Trusted Contact" (if one is configured) and always logs the
event, so it shows up as a dashboard task even with zero setup.

This is strictly additive and best-effort. It runs after the user has
already received their analysis result (via FastAPI BackgroundTasks in
main.py), so a slow or failing webhook never affects response time or the
result the user sees.
"""
from __future__ import annotations

import os
from typing import Set

import httpx

from .data_access import log_escalation
from .schemas import AnalysisResult, RiskLevel

ESCALATION_LEVELS: Set[RiskLevel] = {RiskLevel.LIKELY_SCAM, RiskLevel.HIGH_RISK}

WEBHOOK_URL = os.environ.get("TRUSTED_CONTACT_WEBHOOK_URL", "")


def should_escalate(result: AnalysisResult) -> bool:
    return result.risk_level in ESCALATION_LEVELS


def _send_webhook_alert(content_preview: str, result: AnalysisResult) -> bool:
    """Best-effort push notification. Returns True only if the request
    actually went out successfully."""
    summary = (
        f"[SuSagi] {result.risk_level.value} ({result.risk_score}/100) -- "
        f"{result.threat_category.value} detected in a {result.mode.value} check.\n"
        f"Preview: {content_preview[:200]}"
    )
    try:
        resp = httpx.post(
            WEBHOOK_URL,
            # "text" covers Slack-style incoming webhooks, "content" covers
            # Discord -- sending both keeps this compatible with either
            # without needing to know which service is on the other end.
            json={"text": summary, "content": summary},
            timeout=5.0,
        )
        resp.raise_for_status()
        return True
    except httpx.HTTPError:
        return False


def handle_escalation(content_preview: str, result: AnalysisResult) -> None:
    """Notify the trusted contact (if configured) and always record the
    event so it appears in the Insights dashboard's escalation list."""
    notified = _send_webhook_alert(content_preview, result) if WEBHOOK_URL else False
    log_escalation(content_preview, result, notified)
