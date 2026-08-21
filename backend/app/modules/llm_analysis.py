"""
LLM-based semantic analysis.

The rule-based analyzers (message_analysis.py, link_analysis.py,
job_offer_analysis.py) catch known phrasing and structural patterns. This
module asks a Groq-hosted LLM to read for *meaning* instead: logical
inconsistencies, tone mismatches, and manipulation tactics that don't match
any fixed pattern -- plus a forecast of what a matching scam pattern
typically asks for next (e.g. an emergency story is often followed by a
payment request, then an OTP/confirmation request).

Findings are normalized into the same `Signal` shape the rule-based analyzers
produce, so they merge into the existing scoring/explanation pipeline without
any changes to that code. This layer is strictly additive: any failure (no
API key, network error, malformed response) degrades to zero signals and no
forecast rather than breaking the analysis.

Results are cached by a hash of the exact input (see data_access.get/set_ai_
cache) -- LLMs are not perfectly deterministic even at low temperature, so
without this, re-analyzing identical content could return a different set of
findings, and therefore a different score, each time. The cache makes
repeat analysis of the same content stable.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
from typing import List, Optional, Tuple

import httpx

from .data_access import get_ai_cache, set_ai_cache
from .schemas import AnalysisMode, AttackForecast, Severity, Signal

GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
GROQ_MODEL = os.environ.get("GROQ_MODEL", "openai/gpt-oss-120b")
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

_SEVERITY_MAP = {
    "low": Severity.LOW,
    "medium": Severity.MEDIUM,
    "high": Severity.HIGH,
    "critical": Severity.CRITICAL,
}

_PROMPT_TEMPLATE = """You are a fraud-detection assistant reviewing user-submitted \
content for social-engineering risk. Content type: {mode}.

Look ONLY for things a keyword scanner would miss:
- Logical inconsistencies: details that don't add up, contradictions, implausible claims
- Tone mismatches: e.g. claims to be an official/formal source but writes casually, or vice versa
- Subtle manipulation tactics: guilt-tripping, false familiarity, fabricated authority

Do NOT flag generic urgency language, credential requests, or brand names -- those are \
already handled by a separate rule-based system. Only report findings you are genuinely \
confident about. If nothing stands out, return an empty findings list.

Separately from the findings list above: if this content looks like it is part of an \
active scam or social-engineering attempt -- whether or not you personally found a new \
finding, since the rule-based system may have already caught the obvious part -- forecast \
what this kind of pattern typically asks for NEXT if it continues (e.g. an emergency/ \
urgency story is commonly followed by a payment request, which is commonly followed by an \
OTP or transaction-confirmation request; a bank-impersonation OTP request is commonly \
followed by a second "confirm this transaction" message). Give a realistic confidence, \
never 100, and phrase it as a possibility, not a certainty. If the content looks genuinely \
legitimate, omit the forecast entirely.

Respond with ONLY valid JSON, no other text, in exactly this shape:
{{"findings": [{{"label": "short label", "explanation": "why this is suspicious", "evidence": "exact quoted snippet or empty string", "severity": "low|medium|high|critical"}}], "forecast": {{"predicted_next_step": "short phrase", "confidence": 0-100, "potential_outcome": "short phrase"}} or null}}

Content to review:
---
{content}
---
"""


def _slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_")[:40] or "finding"


def _cache_key(content: str, mode: AnalysisMode) -> str:
    return "llm:" + hashlib.sha256(f"{mode.value}:{content}".encode("utf-8")).hexdigest()


def analyze_with_llm(
    content: str, mode: AnalysisMode
) -> Tuple[List[Signal], Optional[AttackForecast]]:
    """Call Groq for semantic red flags plus an attack forecast. Returns
    ([], None) on any failure or when no API key is configured -- this layer
    must never break the pipeline. Identical (content, mode) pairs are
    served from cache after the first call, so results are stable across
    repeat analyses."""
    if not GROQ_API_KEY:
        return [], None

    key = _cache_key(content, mode)
    cached = get_ai_cache(key)
    if cached is not None:
        data = json.loads(cached)
        signals = [Signal(**d) for d in data["signals"]]
        forecast = AttackForecast(**data["forecast"]) if data.get("forecast") else None
        return signals, forecast

    try:
        resp = httpx.post(
            GROQ_URL,
            headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
            json={
                "model": GROQ_MODEL,
                "messages": [
                    {"role": "user", "content": _PROMPT_TEMPLATE.format(mode=mode.value, content=content[:6000])}
                ],
                "response_format": {"type": "json_object"},
                "temperature": 0,
            },
            timeout=8.0,
        )
        resp.raise_for_status()
        text = resp.json()["choices"][0]["message"]["content"]
        parsed = json.loads(text)
    except (httpx.HTTPError, KeyError, IndexError, json.JSONDecodeError):
        return [], None

    signals: List[Signal] = []
    for finding in parsed.get("findings", [])[:5]:
        label = str(finding.get("label", "")).strip()
        if not label:
            continue
        severity = _SEVERITY_MAP.get(str(finding.get("severity", "")).lower(), Severity.MEDIUM)
        evidence = [e for e in (finding.get("explanation"), finding.get("evidence")) if e]
        signals.append(Signal(
            id=f"llm_{_slug(label)}",
            label=f"AI review: {label}",
            severity=severity,
            evidence=evidence,
            category_hint=None,
        ))

    # Deliberately not gated on `signals` being non-empty -- the model is
    # told not to re-report things the rule-based layer already caught, but
    # it can still recognize an in-progress scam pattern well enough to
    # forecast its next step even when it found nothing new to flag itself.
    forecast: Optional[AttackForecast] = None
    raw_forecast = parsed.get("forecast")
    if isinstance(raw_forecast, dict) and raw_forecast.get("predicted_next_step"):
        try:
            forecast = AttackForecast(
                predicted_next_step=str(raw_forecast["predicted_next_step"]).strip(),
                confidence=max(0, min(100, int(raw_forecast.get("confidence", 50)))),
                potential_outcome=str(raw_forecast.get("potential_outcome", "")).strip() or "Unclear",
            )
        except (KeyError, TypeError, ValueError):
            forecast = None

    set_ai_cache(key, json.dumps({
        "signals": [s.model_dump(mode="json") for s in signals],
        "forecast": forecast.model_dump(mode="json") if forecast else None,
    }))
    return signals, forecast
