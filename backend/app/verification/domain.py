from dataclasses import dataclass

import dns.asyncresolver
import dns.exception
import dns.resolver


@dataclass(frozen=True)
class DomainFacts:
    exists: bool | None
    has_mx: bool | None
    mx_hosts: tuple[str, ...] = ()
    has_spf: bool | None = None
    has_dmarc: bool | None = None
    provider: str | None = None
    null_mx: bool = False


def detect_provider(mx_hosts: tuple[str, ...]) -> str | None:
    for host in mx_hosts:
        h = host.lower()
        if "google.com" in h or "googlemail.com" in h or "aspmx.l.google.com" in h:
            return "Google Workspace / Gmail"
        if "outlook.com" in h or "protection.outlook.com" in h or "office365.com" in h:
            return "Microsoft 365 / Outlook"
        if "yahoodns.net" in h or "yahoo.com" in h:
            return "Yahoo Mail"
        if "icloud.com" in h or "apple.com" in h:
            return "Apple iCloud"
        if "protonmail.ch" in h or "proton.me" in h:
            return "ProtonMail"
        if "zoho.com" in h or "zohomail.com" in h:
            return "Zoho Mail"
        if "mimecast.com" in h:
            return "Mimecast"
        if "pphosted.com" in h:
            return "Proofpoint"
        if "barracudanetworks.com" in h:
            return "Barracuda"
        if "secureserver.net" in h:
            return "GoDaddy Mail"
    return None


async def _check_spf(resolver: dns.asyncresolver.Resolver, domain: str) -> bool | None:
    try:
        txt_records = await resolver.resolve(domain, "TXT")
        for record in txt_records:
            text = "".join(s.decode("utf-8", errors="replace") if isinstance(s, bytes) else str(s) for s in record.strings)
            if text.startswith("v=spf1"):
                return True
        return False
    except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer):
        return False
    except Exception:
        return None


async def _check_dmarc(resolver: dns.asyncresolver.Resolver, domain: str) -> bool | None:
    try:
        txt_records = await resolver.resolve(f"_dmarc.{domain}", "TXT")
        for record in txt_records:
            text = "".join(s.decode("utf-8", errors="replace") if isinstance(s, bytes) else str(s) for s in record.strings)
            if "v=DMARC1" in text:
                return True
        return False
    except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer):
        return False
    except Exception:
        return None


async def lookup_domain(domain: str, timeout: float) -> DomainFacts:
    resolver = dns.asyncresolver.Resolver()
    resolver.lifetime = timeout
    try:
        answer = await resolver.resolve(domain, "MX")
        raw_records = [(int(record.preference), str(record.exchange).rstrip(".")) for record in answer]
        
        # Check for RFC 7505 Null MX (preference 0 and host ".")
        if any(host in {"", "."} for _, host in raw_records):
            return DomainFacts(exists=True, has_mx=False, null_mx=True)

        records = sorted(raw_records, key=lambda item: item[0])
        hosts = tuple(host for _, host in records if host and host != ".")
        if not hosts:
            return DomainFacts(exists=True, has_mx=False)

        provider = detect_provider(hosts)
        has_spf = await _check_spf(resolver, domain)
        has_dmarc = await _check_dmarc(resolver, domain)

        return DomainFacts(
            exists=True,
            has_mx=True,
            mx_hosts=hosts,
            has_spf=has_spf,
            has_dmarc=has_dmarc,
            provider=provider,
            null_mx=False,
        )
    except dns.resolver.NXDOMAIN:
        return DomainFacts(exists=False, has_mx=False)
    except dns.resolver.NoAnswer:
        return DomainFacts(exists=True, has_mx=False)
    except (dns.resolver.NoNameservers, dns.exception.Timeout, OSError):
        return DomainFacts(exists=None, has_mx=None)
