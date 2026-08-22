"""
Data access layer.

Lightweight SQLite persistence for analysis history and Safety Insights
aggregates. No user accounts, no PII — we store only the mode, category,
risk score, level, and triggered signal IDs plus a truncated preview.
"""
from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from typing import Iterator, List, Optional

from .schemas import AnalysisResult


DB_PATH = Path(__file__).resolve().parent.parent.parent / "susagi.db"


def init_db() -> None:
    with _conn() as cx:
        cx.executescript("""
        CREATE TABLE IF NOT EXISTS analyses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            mode TEXT NOT NULL,
            risk_level TEXT NOT NULL,
            risk_score INTEGER NOT NULL,
            threat_category TEXT NOT NULL,
            signal_ids TEXT NOT NULL,       -- JSON list
            evidence_samples TEXT NOT NULL, -- JSON list (short)
            preview TEXT NOT NULL,          -- truncated input
            created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_analyses_created_at ON analyses(created_at);

        CREATE TABLE IF NOT EXISTS sender_profiles (
            sender_id TEXT PRIMARY KEY,
            message_count INTEGER NOT NULL DEFAULT 0,
            avg_risk_score REAL NOT NULL DEFAULT 0,
            signal_ids TEXT NOT NULL DEFAULT '[]',  -- JSON list, union of all signal ids ever seen
            last_seen TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS escalations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            mode TEXT NOT NULL,
            risk_level TEXT NOT NULL,
            risk_score INTEGER NOT NULL,
            threat_category TEXT NOT NULL,
            preview TEXT NOT NULL,
            notified_webhook INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_escalations_created_at ON escalations(created_at);

        CREATE TABLE IF NOT EXISTS ai_cache (
            cache_key TEXT PRIMARY KEY,
            result_json TEXT NOT NULL,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS behavioral_profiles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            relationship_role TEXT NOT NULL,
            expected_style TEXT NOT NULL,
            never_asks_for TEXT NOT NULL,   -- JSON list of red-flag strings
            created_at TEXT NOT NULL
        );
        """)
    _seed_default_behavioral_profiles()


@contextmanager
def _conn() -> Iterator[sqlite3.Connection]:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def save_analysis(content_preview: str, result: AnalysisResult) -> None:
    signal_ids = [s.id for s in result.signals]
    evidence = []
    for s in result.signals:
        evidence.extend(s.evidence[:2])
    evidence = evidence[:8]

    with _conn() as cx:
        cx.execute(
            """INSERT INTO analyses
               (mode, risk_level, risk_score, threat_category,
                signal_ids, evidence_samples, preview, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                result.mode.value,
                result.risk_level.value,
                result.risk_score,
                result.threat_category.value,
                json.dumps(signal_ids),
                json.dumps(evidence),
                content_preview[:240],
                datetime.utcnow().isoformat(timespec="seconds") + "Z",
            ),
        )


def recent_history(limit: int = 20) -> List[dict]:
    with _conn() as cx:
        rows = cx.execute(
            "SELECT mode, risk_level, risk_score, threat_category, preview, created_at "
            "FROM analyses ORDER BY id DESC LIMIT ?",
            (limit,),
        ).fetchall()
    return [dict(r) for r in rows]


def insights_summary() -> dict:
    with _conn() as cx:
        total = cx.execute("SELECT COUNT(*) AS c FROM analyses").fetchone()["c"]

        by_category = cx.execute(
            "SELECT threat_category AS category, COUNT(*) AS count "
            "FROM analyses GROUP BY threat_category ORDER BY count DESC"
        ).fetchall()

        by_level = cx.execute(
            "SELECT risk_level AS level, COUNT(*) AS count "
            "FROM analyses GROUP BY risk_level"
        ).fetchall()

        by_mode = cx.execute(
            "SELECT mode, COUNT(*) AS count FROM analyses GROUP BY mode"
        ).fetchall()

        # Aggregate most-seen signal ids across the last 200 analyses
        recent = cx.execute(
            "SELECT signal_ids, evidence_samples FROM analyses "
            "ORDER BY id DESC LIMIT 200"
        ).fetchall()

    signal_counter: dict[str, int] = {}
    evidence_counter: dict[str, int] = {}
    for row in recent:
        for sid in json.loads(row["signal_ids"]):
            signal_counter[sid] = signal_counter.get(sid, 0) + 1
        for ev in json.loads(row["evidence_samples"]):
            k = ev.strip().lower()
            if 2 < len(k) < 60:
                evidence_counter[k] = evidence_counter.get(k, 0) + 1

    top_signals = sorted(signal_counter.items(), key=lambda kv: kv[1], reverse=True)[:8]
    top_phrases = sorted(evidence_counter.items(), key=lambda kv: kv[1], reverse=True)[:10]

    return {
        "total_analyses": total,
        "by_category": [dict(r) for r in by_category],
        "by_level": [dict(r) for r in by_level],
        "by_mode": [dict(r) for r in by_mode],
        "top_signals": [{"signal_id": s, "count": c} for s, c in top_signals],
        "top_phrases": [{"phrase": p, "count": c} for p, c in top_phrases],
    }


def get_sender_profile(sender_id: str) -> Optional[dict]:
    """Return this sender's communication baseline, or None if unseen."""
    with _conn() as cx:
        row = cx.execute(
            "SELECT sender_id, message_count, avg_risk_score, signal_ids, last_seen "
            "FROM sender_profiles WHERE sender_id = ?",
            (sender_id,),
        ).fetchone()
    return dict(row) if row else None


def update_sender_profile(sender_id: str, result: AnalysisResult) -> None:
    """Fold this analysis into the sender's rolling baseline."""
    now = datetime.utcnow().isoformat(timespec="seconds") + "Z"
    existing = get_sender_profile(sender_id)
    new_signal_ids = {s.id for s in result.signals}

    with _conn() as cx:
        if existing:
            count = existing["message_count"] + 1
            avg = (
                (existing["avg_risk_score"] * existing["message_count"]) + result.risk_score
            ) / count
            all_signal_ids = set(json.loads(existing["signal_ids"])) | new_signal_ids
            cx.execute(
                """UPDATE sender_profiles
                   SET message_count = ?, avg_risk_score = ?, signal_ids = ?, last_seen = ?
                   WHERE sender_id = ?""",
                (count, avg, json.dumps(sorted(all_signal_ids)), now, sender_id),
            )
        else:
            cx.execute(
                """INSERT INTO sender_profiles
                   (sender_id, message_count, avg_risk_score, signal_ids, last_seen)
                   VALUES (?, ?, ?, ?, ?)""",
                (sender_id, 1, float(result.risk_score), json.dumps(sorted(new_signal_ids)), now),
            )


def log_escalation(content_preview: str, result: AnalysisResult, notified_webhook: bool) -> None:
    with _conn() as cx:
        cx.execute(
            """INSERT INTO escalations
               (mode, risk_level, risk_score, threat_category, preview, notified_webhook, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (
                result.mode.value,
                result.risk_level.value,
                result.risk_score,
                result.threat_category.value,
                content_preview[:240],
                1 if notified_webhook else 0,
                datetime.utcnow().isoformat(timespec="seconds") + "Z",
            ),
        )


def log_voice_escalation(preview: str, risk_level: str, score: int, notified: bool) -> None:
    """Same escalations table as log_escalation, for the live call monitor --
    which has a score and a transcript but no full AnalysisResult (there are
    no discrete `Signal`s in a voice call, just a rolling score), so this
    takes the handful of fields that actually apply instead of forcing a
    shape that doesn't fit."""
    with _conn() as cx:
        cx.execute(
            """INSERT INTO escalations
               (mode, risk_level, risk_score, threat_category, preview, notified_webhook, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (
                "voice_call",
                risk_level,
                score,
                "Impersonation",
                preview[:240],
                1 if notified else 0,
                datetime.utcnow().isoformat(timespec="seconds") + "Z",
            ),
        )


def get_ai_cache(cache_key: str) -> Optional[str]:
    """Return the cached JSON result for this key, or None on a miss."""
    with _conn() as cx:
        row = cx.execute(
            "SELECT result_json FROM ai_cache WHERE cache_key = ?", (cache_key,)
        ).fetchone()
    return row["result_json"] if row else None


def set_ai_cache(cache_key: str, result_json: str) -> None:
    """Store a JSON result, keyed by a hash of the exact input that produced
    it -- so identical input always returns the identical AI findings
    instead of a fresh, potentially different LLM call each time."""
    now = datetime.utcnow().isoformat(timespec="seconds") + "Z"
    with _conn() as cx:
        cx.execute(
            "INSERT OR REPLACE INTO ai_cache (cache_key, result_json, created_at) VALUES (?, ?, ?)",
            (cache_key, result_json, now),
        )


def recent_escalations(limit: int = 20) -> List[dict]:
    with _conn() as cx:
        rows = cx.execute(
            "SELECT mode, risk_level, risk_score, threat_category, preview, "
            "notified_webhook, created_at FROM escalations ORDER BY id DESC LIMIT ?",
            (limit,),
        ).fetchall()
    return [dict(r) for r in rows]


# ── Behavioral profiles (Behavioral Impersonation Engine) ──────────────────
#
# A lightweight "who does this contact normally sound like" matrix per
# trusted contact, used to cross-reference a live call transcript against
# the person the caller claims to be -- see behavioral_analysis.py. Three
# presets are seeded on first run so the feature is demoable with zero
# setup; anyone can add their own via POST /api/behavioral-profiles.
_DEFAULT_BEHAVIORAL_PROFILES = [
    {
        "name": "Dad",
        "relationship_role": "Father",
        "expected_style": "Warm, casual, talks about family and daily routine. Never in a rush.",
        "never_asks_for": [
            "gift cards", "UPI PIN", "OTP", "urgent untraceable money transfer",
        ],
    },
    {
        "name": "My Manager",
        "relationship_role": "Direct Manager",
        "expected_style": "Professional, brief, talks about deadlines and work items over official channels.",
        "never_asks_for": [
            "gift cards", "personal passwords", "urgent wire transfer", "your bank OTP",
        ],
    },
    {
        "name": "Bank Officer",
        "relationship_role": "Bank Officer",
        "expected_style": "Formal, never asks you to act within minutes, directs you to visit a branch for anything sensitive.",
        "never_asks_for": [
            "OTP", "full card number", "PIN", "remote screen-sharing access",
        ],
    },
]


def _seed_default_behavioral_profiles() -> None:
    with _conn() as cx:
        count = cx.execute("SELECT COUNT(*) AS c FROM behavioral_profiles").fetchone()["c"]
        if count > 0:
            return
        now = datetime.utcnow().isoformat(timespec="seconds") + "Z"
        for p in _DEFAULT_BEHAVIORAL_PROFILES:
            cx.execute(
                """INSERT INTO behavioral_profiles
                   (name, relationship_role, expected_style, never_asks_for, created_at)
                   VALUES (?, ?, ?, ?, ?)""",
                (p["name"], p["relationship_role"], p["expected_style"],
                 json.dumps(p["never_asks_for"]), now),
            )


def list_behavioral_profiles() -> List[dict]:
    with _conn() as cx:
        rows = cx.execute(
            "SELECT id, name, relationship_role, expected_style, never_asks_for, created_at "
            "FROM behavioral_profiles ORDER BY id ASC"
        ).fetchall()
    out = []
    for r in rows:
        d = dict(r)
        d["never_asks_for"] = json.loads(d["never_asks_for"])
        out.append(d)
    return out


def get_behavioral_profile(profile_id: int) -> Optional[dict]:
    with _conn() as cx:
        row = cx.execute(
            "SELECT id, name, relationship_role, expected_style, never_asks_for, created_at "
            "FROM behavioral_profiles WHERE id = ?",
            (profile_id,),
        ).fetchone()
    if not row:
        return None
    d = dict(row)
    d["never_asks_for"] = json.loads(d["never_asks_for"])
    return d


def create_behavioral_profile(
    name: str, relationship_role: str, expected_style: str, never_asks_for: List[str]
) -> dict:
    now = datetime.utcnow().isoformat(timespec="seconds") + "Z"
    with _conn() as cx:
        cursor = cx.execute(
            """INSERT INTO behavioral_profiles
               (name, relationship_role, expected_style, never_asks_for, created_at)
               VALUES (?, ?, ?, ?, ?)""",
            (name, relationship_role, expected_style, json.dumps(never_asks_for), now),
        )
        new_id = cursor.lastrowid
    return {
        "id": new_id,
        "name": name,
        "relationship_role": relationship_role,
        "expected_style": expected_style,
        "never_asks_for": never_asks_for,
        "created_at": now,
    }
