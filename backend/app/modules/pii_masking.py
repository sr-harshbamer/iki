import re

# Regex for Email Addresses
EMAIL_REGEX = re.compile(r'([a-zA-Z0-9_.+-]+)@([a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)')

# Regex for Phone Numbers (supports contiguous 10, 5-5 splits, and 3-3-4 split with optional parenthesized area codes)
PHONE_REGEX = re.compile(r'(?:\+?\d{1,3}[-.\s]?)?(?:\d{10}\b|\d{5}[-.\s]?\d{5}\b|\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b)')

# Regex for UPI handles (e.g., payee@bankname)
UPI_REGEX = re.compile(r'\b[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}\b')

# OTPs / PINs / verification codes -- a short numeric code immediately
# preceded by a keyword that names it as such. Not standalone-number-based
# (that would collide with phone/account patterns): the keyword anchor is
# what makes this specifically an OTP and not some other digit string.
OTP_REGEX = re.compile(
    r'\b(?:otp|pin|cvv|verification code|one[- ]time password|security code|auth code)\b'
    r'[\s:.\-]*\**\s*(\d{3,8})\b',
    re.IGNORECASE,
)

# Card numbers: 16 digits in the conventional 4-4-4-4 grouping (with or
# without separators), or 15-digit Amex-style 4-6-5.
CARD_REGEX = re.compile(
    r'\b\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}\b|\b\d{4}[ -]?\d{6}[ -]?\d{5}\b'
)

# Aadhaar-style Indian identifiers: 12 digits, conventionally grouped 4-4-4.
AADHAAR_REGEX = re.compile(r'\b\d{4}[ -]?\d{4}[ -]?\d{4}\b')

# PAN-style Indian tax identifiers: 5 letters, 4 digits, 1 letter.
PAN_REGEX = re.compile(r'\b[A-Za-z]{5}\d{4}[A-Za-z]\b')

# Bank account numbers: no universal format, so only mask when explicitly
# named as one -- an unanchored 9-18 digit match would swallow every other
# long number on the page (order IDs, timestamps, etc.).
BANK_ACCOUNT_REGEX = re.compile(
    r'\b(?:account\s*(?:no\.?|number)?|a\/?c\s*(?:no\.?)?|acc\.?\s*no\.?)'
    r'[\s:.\-]*(\d{9,18})\b',
    re.IGNORECASE,
)


def _mask_digits(digits: str, keep: int = 3) -> str:
    if len(digits) <= keep:
        return "X" * len(digits)
    return "X" * (len(digits) - keep) + digits[-keep:]


def mask_pii(text: str) -> str:
    """
    Masks Personally Identifiable Information (PII) -- phone numbers,
    emails, UPI handles, OTPs/PINs, card numbers, bank account numbers,
    and Aadhaar/PAN-style identifiers -- inside text before it is stored
    or sent to an external AI service.
    """
    if not text:
        return text

    # Mask Emails
    def mask_email(match):
        local_part = match.group(1)
        domain = match.group(2)
        if len(local_part) <= 2:
            return f"{local_part[0]}*@{domain}"
        return f"{local_part[0]}{'*' * (len(local_part) - 2)}{local_part[-1]}@{domain}"

    text = EMAIL_REGEX.sub(mask_email, text)

    # Mask UPI Addresses
    def mask_upi(match):
        full_match = match.group(0)
        parts = full_match.split('@')
        handle = parts[0]
        provider = parts[1]
        if len(handle) <= 2:
            return f"{handle[0]}*@{provider}"
        return f"{handle[0]}{'*' * (len(handle) - 2)}{handle[-1]}@{provider}"

    # Do not mask if it looks like a standard email (already handled above)
    if "@" in text and not EMAIL_REGEX.search(text):
        text = UPI_REGEX.sub(mask_upi, text)

    # Mask card numbers (16-digit / Amex 15-digit) before Aadhaar, since a
    # 16-digit card number also contains a 12-digit Aadhaar-shaped substring.
    def mask_card(match):
        digits = [c for c in match.group(0) if c.isdigit()]
        return f"[CARD_REDACTED:{_mask_digits(''.join(digits))}]"

    text = CARD_REGEX.sub(mask_card, text)

    # Mask bank account numbers first, while still keyword-anchored -- this
    # must run before the unanchored Aadhaar pattern below, since a labeled
    # "account number 000123456789" would otherwise just look like a bare
    # 12-digit Aadhaar-shaped number and be mis-tagged (still redacted
    # either way, but the label should match what it actually is).
    def mask_account(match):
        digits = match.group(1)
        return match.group(0)[: match.start(1) - match.start(0)] + f"[ACCOUNT_REDACTED:{_mask_digits(digits)}]"

    text = BANK_ACCOUNT_REGEX.sub(mask_account, text)

    # Mask Aadhaar-style 12-digit identifiers
    def mask_aadhaar(match):
        digits = [c for c in match.group(0) if c.isdigit()]
        if len(digits) != 12:
            return match.group(0)
        return f"[AADHAAR_REDACTED:{_mask_digits(''.join(digits))}]"

    text = AADHAAR_REGEX.sub(mask_aadhaar, text)

    # Mask PAN-style identifiers
    text = PAN_REGEX.sub("[PAN_REDACTED]", text)

    # Mask OTPs / PINs / verification codes (keyword-anchored digit codes)
    def mask_otp(match):
        return match.group(0)[: match.start(1) - match.start(0)] + "[OTP_REDACTED]"

    text = OTP_REGEX.sub(mask_otp, text)

    # Mask Phone Numbers (keeps last 3 digits visible)
    def mask_phone(match):
        raw_number = match.group(0)
        # Strip spacing and chars to count digit length
        digits = [c for c in raw_number if c.isdigit()]
        if len(digits) < 7:
            return raw_number # Too short to be a valid phone number

        # Keep last 3 digits
        masked_digits = "X" * (len(digits) - 3) + "".join(digits[-3:])
        return f"[Phone: {masked_digits}]"

    text = PHONE_REGEX.sub(mask_phone, text)

    return text
