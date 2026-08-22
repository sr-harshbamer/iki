import re

# Regex for Email Addresses
EMAIL_REGEX = re.compile(r'([a-zA-Z0-9_.+-]+)@([a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)')

# Regex for Phone Numbers (supports contiguous 10, 5-5 splits, and 3-3-4 split with optional parenthesized area codes)
PHONE_REGEX = re.compile(r'(?:\+?\d{1,3}[-.\s]?)?(?:\d{10}\b|\d{5}[-.\s]?\d{5}\b|\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b)')

# Regex for UPI handles (e.g., payee@bankname)
UPI_REGEX = re.compile(r'\b[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}\b')

def mask_pii(text: str) -> str:
    """
    Masks Personally Identifiable Information (PII) like phone numbers,
    emails, and UPI addresses inside text transcripts to protect privacy.
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
