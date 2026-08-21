"""
UPI payment QR analysis.

A UPI deep link (upi://pay?pa=...) encodes a payment request directly in
the QR code -- scanning one can pre-fill a recipient and amount before the
user has verified either. This module parses the payload structurally, no
external API, and flags the patterns real UPI QR scams commonly use: a
missing or malformed payee ID, no payee name attached, or a suspiciously
large pre-filled amount designed to be scanned in a hurry.
"""
from __future__ import annotations

import re
from typing import List, Optional, Tuple
from urllib.parse import parse_qs, urlparse

from .schemas import Severity, Signal, ThreatCategory

# name@bankhandle -- UPI handles are short alphabetic codes (oksbi, ybl,
# okhdfcbank, paytm, upi, ...); this isn't exhaustive, just a shape check.
_VPA_RE = re.compile(r"^[\w.\-]{2,256}@[a-zA-Z][a-zA-Z0-9]{1,64}$")
LARGE_AMOUNT_THRESHOLD = 5000.0


def _parse_upi_params(data: str) -> dict:
    parsed = urlparse(data)
    return {k: v[0] for k, v in parse_qs(parsed.query).items()}


def analyze_upi_payload(data: str) -> Tuple[List[Signal], ThreatCategory, Optional[str]]:
    """Returns (signals, category, payee_vpa) for a upi://pay?... deep link."""
    params = _parse_upi_params(data)
    vpa = params.get("pa", "").strip()
    name = params.get("pn", "").strip()
    amount_raw = params.get("am", "").strip()

    signals: List[Signal] = []

    if not vpa:
        signals.append(Signal(
            id="upi_missing_payee_id",
            label="Payment QR has no payee ID at all",
            severity=Severity.CRITICAL,
            evidence=[data],
            category_hint=ThreatCategory.FINANCIAL_FRAUD,
        ))
    elif not _VPA_RE.match(vpa):
        signals.append(Signal(
            id="upi_malformed_payee_id",
            label="Payee UPI ID doesn't match a valid format",
            severity=Severity.HIGH,
            evidence=[vpa],
            category_hint=ThreatCategory.FINANCIAL_FRAUD,
        ))

    if vpa and not name:
        signals.append(Signal(
            id="upi_missing_payee_name",
            label="No verified payee name attached to this UPI ID",
            severity=Severity.MEDIUM,
            evidence=[vpa],
            category_hint=ThreatCategory.FINANCIAL_FRAUD,
        ))

    if amount_raw:
        try:
            amount = float(amount_raw)
            if amount >= LARGE_AMOUNT_THRESHOLD:
                signals.append(Signal(
                    id="upi_prefilled_large_amount",
                    label="QR pre-fills a large payment amount",
                    severity=Severity.HIGH,
                    evidence=[f"Rs {amount:,.0f}" + (f" to {name}" if name else "")],
                    category_hint=ThreatCategory.FINANCIAL_FRAUD,
                ))
        except ValueError:
            pass

    category = ThreatCategory.FINANCIAL_FRAUD if signals else ThreatCategory.NONE
    return signals, category, vpa or None
