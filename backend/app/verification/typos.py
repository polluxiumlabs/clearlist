from __future__ import annotations

TYPO_DOMAINS: dict[str, str] = {
    "gmai.com": "gmail.com",
    "gamil.com": "gmail.com",
    "gmial.com": "gmail.com",
    "gmaill.com": "gmail.com",
    "gmai.co": "gmail.com",
    "gmaill.co": "gmail.com",
    "gmal.com": "gmail.com",
    "gmaii.com": "gmail.com",
    "gmeil.com": "gmail.com",
    "yaho.com": "yahoo.com",
    "yahooo.com": "yahoo.com",
    "yhaoo.com": "yahoo.com",
    "yaho.co": "yahoo.com",
    "yaho.com.br": "yahoo.com.br",
    "hotmial.com": "hotmail.com",
    "hotmai.com": "hotmail.com",
    "hotmaill.com": "hotmail.com",
    "hotamail.com": "hotmail.com",
    "hotmal.com": "hotmail.com",
    "outlok.com": "outlook.com",
    "outloo.com": "outlook.com",
    "outlock.com": "outlook.com",
    "outllok.com": "outlook.com",
    "iclod.com": "icloud.com",
    "iclou.com": "icloud.com",
    "icould.com": "icloud.com",
    "protomail.com": "protonmail.com",
    "prtonmail.com": "protonmail.com",
    "protonmai.com": "protonmail.com",
    "comcast.nt": "comcast.net",
    "comast.net": "comcast.net",
    "verzon.net": "verizon.net",
    "att.nt": "att.net",
}


def detect_domain_typo(domain: str) -> str | None:
    return TYPO_DOMAINS.get(domain.strip().lower())
