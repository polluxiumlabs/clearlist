ROLE_LOCAL_PARTS = frozenset({
    "admin", "billing", "careers", "contact", "hello", "help", "hr", "info",
    "jobs", "legal", "marketing", "office", "sales", "security", "support",
    "team", "webmaster", "postmaster", "abuse", "noreply", "no-reply",
})


def is_role_address(email: str) -> bool:
    return email.rsplit("@", 1)[0].lower() in ROLE_LOCAL_PARTS
