"""
Decision Protection Engine.

The risk score answers "is this a scam?". This module answers a different,
complementary question: "how dangerous is the specific decision the user is
being pressured toward, right now?" -- combining scam likelihood with what's
actually at stake (potential consequence) and how hard it would be to undo
if acted on (reversibility). A high-probability scam asking you to read a
suspicious email is lower decision-risk than a lower-probability one asking
you to wire money -- the stakes matter, not just the likelihood.

Deterministic and signal-based on purpose: the LLM layers already inform
which signals fired, but the consequence/reversibility mapping itself is a
fixed rule table, not another model call -- keeps this fast, explainable,
and immune to the non-determinism that affects the AI layers.
"""
from __future__ import annotations

from typing import List

from .schemas import DecisionRisk, DecisionRiskLevel, Signal

# Signals that mean real, hard-to-undo harm if the user complies: money
# already gone, credentials already handed over, a malicious link already
# opened. These floor the reversibility score hard.
IRREVERSIBLE_SIGNAL_IDS = {
    "credential_request", "financial_fraud_wording", "url_plus_pressure",
    "upfront_fee", "premature_pii", "sender_anomaly_score_spike",
    "upi_missing_payee_id", "upi_malformed_payee_id",
    "upi_missing_payee_name", "upi_prefilled_large_amount",
}

# Signals that raise the stakes but don't by themselves make the action
# irreversible (e.g. a phone number is still just pressure, not loss).
ELEVATED_CONSEQUENCE_SIGNAL_IDS = {
    "urgency_pressure", "isolation_tactic", "brand_impersonation",
    "coercive_threat", "reward_bait", "unrealistic_pay",
}


def assess_decision_risk(signals: List[Signal], risk_score: int) -> DecisionRisk:
    ids = {s.id for s in signals}
    irreversible_hits = ids & IRREVERSIBLE_SIGNAL_IDS
    elevated_hits = ids & ELEVATED_CONSEQUENCE_SIGNAL_IDS

    if irreversible_hits:
        consequence = "High"
        reversibility_score = 10
    elif elevated_hits:
        consequence = "Medium"
        reversibility_score = 50
    else:
        consequence = "Low"
        reversibility_score = 90

    if risk_score >= 80 and reversibility_score <= 30:
        level = DecisionRiskLevel.CRITICAL
    elif risk_score >= 60:
        level = DecisionRiskLevel.HIGH
    elif risk_score >= 30:
        level = DecisionRiskLevel.MODERATE
    else:
        level = DecisionRiskLevel.LOW

    return DecisionRisk(
        scam_probability=risk_score,
        potential_consequence=consequence,
        reversibility_score=reversibility_score,
        level=level,
    )
