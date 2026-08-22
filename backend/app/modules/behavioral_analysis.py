"""
Behavioral Impersonation Engine -- Tier 2 (cloud context).

Tier 1 (scam_scorer.ConvState) reacts instantly to a fixed lexicon and
never needs a network call. This module answers a different, slower
question that no keyword list can: "does what this caller just said fit
how the person they claim to be actually talks?" A cloned voice or a
compromised account can say "hi dad" perfectly -- it's much harder for it
to stay in character for an entire conversation without ever asking for
something that person's real baseline rules out.

Zero-shot: no training data is collected on the trusted contact. The
"Behavioral Profile" is a small, human-written matrix (relationship role,
expected tone, and an explicit "never asks for" list) supplied once by the
person setting up the contact, not learned from months of chat history.

Cached by a hash of the profile's content + the exact transcript so far --
same reasoning as llm_analysis.py and image_analysis.py: identical input
must always return the identical score, or "why did the score change on
the exact same words" becomes an unanswerable, trust-destroying question.
"""
from __future__ import annotations

import hashlib
import json
import os
from typing import List, Optional, Tuple

import httpx

from .data_access import get_ai_cache, set_ai_cache

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_TEXT_MODEL = os.environ.get("GEMINI_TEXT_MODEL", "gemini-3.6-flash")
GEMINI_URL = (
    f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_TEXT_MODEL}:generateContent"
)

_RESPONSE_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "impersonation_score": {"type": "INTEGER"},
        "reason": {"type": "STRING"},
    },
    "required": ["impersonation_score", "reason"],
}

_PROMPT_TEMPLATE = """You are an impartial fraud auditor. You will be given who a caller \
claims to be, that person's normal behavioral baseline, and the exact transcript of what \
the caller just said on a live call. Decide how much the transcript deviates from the \
claimed identity's real baseline -- NOT whether the topic is generically suspicious.

Claimed identity: {role} ("{name}")
Expected communication style: {style}
This person would NEVER ask for: {never_asks_for}

Transcript so far:
\"\"\"{transcript}\"\"\"

Return impersonation_score (0-100, where 0 means this sounds exactly like the real person \
and 100 means this clearly violates their baseline -- e.g. asking for something on the \
"never asks for" list, or a drastic tone/style mismatch) and a short, specific, plain-English \
reason a non-technical person would understand (e.g. "Asking for gift cards drastically \
violates the manager's baseline behavior"). If nothing in the transcript relates to the \
baseline yet, return a low score and say so plainly.
"""


def _cache_key(profile: dict, transcript: str) -> str:
    canonical = json.dumps(
        {
            "role": profile["relationship_role"],
            "name": profile["name"],
            "style": profile["expected_style"],
            "never_asks_for": profile["never_asks_for"],
            "transcript": transcript,
        },
        sort_keys=True,
    )
    digest = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    return f"behavioral:{digest}"


def analyze_behavioral_anomaly(
    profile: dict, transcript: str
) -> Optional[Tuple[int, str]]:
    """Returns (impersonation_score, reason), or None if unavailable (no
    API key configured, empty transcript, or the call failed) -- callers
    must treat None as "no opinion yet", never as a score of 0."""
    transcript = transcript.strip()
    if not transcript or not GEMINI_API_KEY:
        return None

    key = _cache_key(profile, transcript)
    cached = get_ai_cache(key)
    if cached is not None:
        data = json.loads(cached)
        return data["impersonation_score"], data["reason"]

    prompt = _PROMPT_TEMPLATE.format(
        role=profile["relationship_role"],
        name=profile["name"],
        style=profile["expected_style"],
        never_asks_for=", ".join(profile["never_asks_for"]),
        transcript=transcript,
    )

    try:
        resp = httpx.post(
            GEMINI_URL,
            params={"key": GEMINI_API_KEY},
            json={
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {
                    "response_mime_type": "application/json",
                    "response_schema": _RESPONSE_SCHEMA,
                    "temperature": 0,
                },
            },
            timeout=30.0,
        )
        resp.raise_for_status()
        text = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
        parsed = json.loads(text)
    except (httpx.HTTPError, KeyError, IndexError, json.JSONDecodeError):
        return None

    score = max(0, min(100, int(parsed.get("impersonation_score", 0))))
    reason = str(parsed.get("reason", "")).strip()
    if not reason:
        return None

    set_ai_cache(key, json.dumps({"impersonation_score": score, "reason": reason}))
    return score, reason
