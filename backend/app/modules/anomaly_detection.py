"""
Sender anomaly detection.

Compares the current analysis against a sender's historical baseline (built
from their past analyses in `sender_profiles`) to catch messages that are
unusual *for that specific sender* -- even when nothing else about the
message stands out on its own. Requires a few prior messages before it will
speak up, so a brand-new sender never triggers a false "anomaly".

This is opt-in: it only runs when the caller supplies a `sender_id`, keeping
anonymous single-message analysis unchanged.
"""
from __future__ import annotations

import json
from typing import List, Optional, Set

from .schemas import Severity, Signal

MIN_HISTORY_FOR_BASELINE = 3
MIN_HISTORY_FOR_NEW_PATTERN = 5
SCORE_SPIKE_THRESHOLD = 25
BASELINE_CEILING_FOR_SPIKE = 30


def detect_sender_anomaly(
    profile: Optional[dict],
    current_score: int,
    current_signal_ids: Set[str],
) -> List[Signal]:
    """Return extra Signals for ways this message deviates from the sender's
    own history. Empty if there isn't enough history to judge yet."""
    if not profile or profile["message_count"] < MIN_HISTORY_FOR_BASELINE:
        return []

    signals: List[Signal] = []
    baseline = profile["avg_risk_score"]
    deviation = current_score - baseline

    if deviation >= SCORE_SPIKE_THRESHOLD and baseline < BASELINE_CEILING_FOR_SPIKE:
        signals.append(Signal(
            id="sender_anomaly_score_spike",
            label="Unusual risk spike vs. this sender's history",
            severity=Severity.HIGH,
            evidence=[
                f"This sender's past {profile['message_count']} messages averaged "
                f"~{round(baseline)}/100 risk; this one scores {current_score}/100."
            ],
            category_hint=None,
        ))

    known_signal_ids = set(json.loads(profile["signal_ids"]))
    new_signal_ids = current_signal_ids - known_signal_ids
    if new_signal_ids and profile["message_count"] >= MIN_HISTORY_FOR_NEW_PATTERN:
        signals.append(Signal(
            id="sender_anomaly_new_pattern",
            label="New red-flag pattern never seen from this sender before",
            severity=Severity.MEDIUM,
            evidence=[
                f"First time this sender has triggered: {', '.join(sorted(new_signal_ids))}."
            ],
            category_hint=None,
        ))

    return signals
