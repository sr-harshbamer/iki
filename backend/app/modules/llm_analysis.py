"""
LLM-based semantic analysis.

The rule-based analyzers (message_analysis.py, link_analysis.py,
job_offer_analysis.py) catch known phrasing and structural patterns. This
module asks a Groq-hosted LLM to read for *meaning* instead: logical
inconsistencies, tone mismatches, and manipulation tactics that don't match
any fixed pattern.

Findings are normalized into the same `Signal` shape the rule-based analyzers
produce, so they merge into the existing scoring/explanation pipeline without
any changes to that code. This layer is strictly additive: any failure (no
API key, network error, malformed response) degrades to zero signals rather
than breaking the analysis.
"""
from __future__ import annotations

import json
import os
import re
from typing import List

import httpx

from .schemas import AnalysisMode, Severity, Signal

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

Respond with ONLY valid JSON, no other text, in exactly this shape:
{{"findings": [{{"label": "short label", "explanation": "why this is suspicious", "evidence": "exact quoted snippet or empty string", "severity": "low|medium|high|critical"}}]}}

Content to review:
---
{content}
---
"""


def _slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_")[:40] or "finding"


def analyze_with_llm(content: str, mode: AnalysisMode) -> List[Signal]:
    """Call Groq for semantic red flags. Returns [] on any failure or when
    no API key is configured -- this layer must never break the pipeline."""
    if not GROQ_API_KEY:
        return []

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
                "temperature": 0.1,
            },
            timeout=8.0,
        )
        resp.raise_for_status()
        text = resp.json()["choices"][0]["message"]["content"]
        parsed = json.loads(text)
    except (httpx.HTTPError, KeyError, IndexError, json.JSONDecodeError):
        return []

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
    return signals
