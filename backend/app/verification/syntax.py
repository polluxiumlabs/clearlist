from email_validator import EmailNotValidError, validate_email


def normalize_email(address: str) -> str | None:
    try:
        result = validate_email(address.strip(), check_deliverability=False)
        return result.normalized.lower()
    except (EmailNotValidError, AttributeError):
        return None
