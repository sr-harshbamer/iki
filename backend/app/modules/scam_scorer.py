from rapidfuzz import fuzz
from typing import List, Dict, Tuple

# Pre-defined lexicons for scam categories
LEXICONS = {
    "urgency": [
        "immediately", "right now", "within 10 minutes", "as soon as possible", 
        "urgent", "hurry up", "quick", "no time", "limited time"
    ],
    "authority": [
        "police", "cbi", "crime branch", "officer", "inspector", "court order", 
        "arrest warrant", "customs", "supreme court", "government agency", "fbi"
    ],
    "secrecy": [
        "keep this secret", "dont tell anyone", "do not share", "keep this between us", 
        "confidential", "dont talk to family", "under wrap"
    ],
    "payment": [
        "transfer money", "upi", "gpay", "phonepe", "bank account", "processing fee", 
        "registration fee", "gift card", "send money", "verify account", "otp code", "pin number"
    ]
}

# Score weight values per category hit
WEIGHTS = {
    "urgency": 18,
    "authority": 25,
    "secrecy": 20,
    "payment": 25
}

# Descriptions mapping for evidence output
DESCRIPTIONS = {
    "urgency": "Urgency / Time pressure pressure tactics detected",
    "authority": "Authority claim or impersonation of law enforcement/agencies",
    "secrecy": "Secrecy request to isolate the victim",
    "payment": "Financial demand, credential request, or transaction trigger"
}

class ConvState:
    def __init__(self):
        self.score = 0
        self.hits = {
            "urgency": False,
            "authority": False,
            "secrecy": False,
            "payment": False
        }
        self.evidence: List[str] = []

    def update(self, sentence: str) -> Tuple[int, List[str]]:
        """
        Evaluate a sentence, update scoring state, and return (score, evidence_list).
        Fuzzy matching using rapidfuzz prevents minor speech recognition mistakes from bypassing rules.
        """
        sentence_lower = sentence.lower().strip()
        if not sentence_lower:
            return self.score, self.evidence

        hit_occurred = False

        for category, keywords in LEXICONS.items():
            # If we've already logged this category, we don't repeat the full bump, 
            # but we keep the score ratcheted high.
            if self.hits[category]:
                continue

            for keyword in keywords:
                # Use partial ratio matching to catch phrases hidden inside sentences
                # E.g. "Calling from see bee eye" matches "CBI" or "police officer" matches "officer"
                ratio = fuzz.partial_ratio(keyword, sentence_lower)
                if ratio >= 82:  # 82% similarity threshold
                    self.hits[category] = True
                    bump = WEIGHTS[category]
                    self.score = min(100, self.score + bump)
                    self.evidence.append(f"{DESCRIPTIONS[category]} (Matched: '{keyword}')")
                    hit_occurred = True
                    break

        if not hit_occurred:
            # Slow decay for bland/neutral sentences (decays by 2, minimum 0)
            # This ensures that short normal chatter doesn't keep a high score forever
            # but it also doesn't drop instantly.
            self.score = max(0, self.score - 2)

        return self.score, self.evidence
