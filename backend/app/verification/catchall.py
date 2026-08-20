import secrets

from .smtp import SmtpStatus, probe_mailbox


async def detect_catch_all(domain: str, mx_host: str, timeout: float) -> bool | None:
    random_mailbox = f"clearlist-{secrets.token_hex(12)}@{domain}"
    result: SmtpStatus = await probe_mailbox(random_mailbox, mx_host, timeout)
    if result == "accepted":
        return True
    if result == "rejected":
        return False
    return None
