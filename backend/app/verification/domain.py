from dataclasses import dataclass

import dns.asyncresolver
import dns.exception
import dns.resolver


@dataclass(frozen=True)
class DomainFacts:
    exists: bool | None
    has_mx: bool | None
    mx_hosts: tuple[str, ...] = ()


async def lookup_domain(domain: str, timeout: float) -> DomainFacts:
    resolver = dns.asyncresolver.Resolver()
    resolver.lifetime = timeout
    try:
        answer = await resolver.resolve(domain, "MX")
        records = sorted(((int(record.preference), str(record.exchange).rstrip(".")) for record in answer), key=lambda item: item[0])
        hosts = tuple(host for _, host in records if host and host != ".")
        return DomainFacts(exists=True, has_mx=bool(hosts), mx_hosts=hosts)
    except dns.resolver.NXDOMAIN:
        return DomainFacts(exists=False, has_mx=False)
    except dns.resolver.NoAnswer:
        return DomainFacts(exists=True, has_mx=False)
    except (dns.resolver.NoNameservers, dns.exception.Timeout, OSError):
        return DomainFacts(exists=None, has_mx=None)
