import asyncio
from collections import defaultdict

from app.cache.domain_cache import DomainCache
from app.config import settings

from .catchall import detect_catch_all
from .disposable import is_disposable
from .domain import DomainFacts, lookup_domain
from .result import VerificationResult
from .role import is_role_address
from .smtp import probe_mailbox
from .syntax import normalize_email
from .typos import detect_domain_typo


class VerificationService:
    def __init__(self) -> None:
        self.domain_cache = DomainCache(settings.cache_ttl_seconds)
        self.catch_all_cache = DomainCache(settings.cache_ttl_seconds)
        self.global_limit = asyncio.Semaphore(settings.global_concurrency)
        self.domain_limits: dict[str, asyncio.Semaphore] = defaultdict(
            lambda: asyncio.Semaphore(settings.per_domain_concurrency)
        )

    async def _domain_facts(self, domain: str) -> DomainFacts:
        cache_key = f"domain:{domain}"
        cached = self.domain_cache.get(cache_key)
        if cached is not None:
            return cached
        async with self.domain_cache.lock_for(cache_key):
            cached = self.domain_cache.get(cache_key)
            if cached is not None:
                return cached
            facts = await lookup_domain(domain, settings.dns_timeout_seconds)
            self.domain_cache.set(cache_key, facts)
            return facts

    async def _catch_all(self, domain: str, mx_host: str) -> bool | None:
        cache_key = f"catchall:{domain}"
        cached = self.catch_all_cache.get(cache_key)
        if cached is not None:
            return cached
        async with self.catch_all_cache.lock_for(cache_key):
            cached = self.catch_all_cache.get(cache_key)
            if cached is not None:
                return cached
            result = await detect_catch_all(domain, mx_host, settings.smtp_timeout_seconds)
            self.catch_all_cache.set(cache_key, result)
            return result

    async def verify(self, raw_email: str) -> VerificationResult:
        normalized = normalize_email(raw_email)
        if normalized is None:
            return VerificationResult(email=raw_email.strip().lower(), syntax=False, status="invalid", reason="Invalid email syntax")

        local_part, domain = normalized.rsplit("@", 1)
        disposable = is_disposable(domain)
        role = is_role_address(normalized)
        typo_domain = detect_domain_typo(domain)
        suggested_email = f"{local_part}@{typo_domain}" if typo_domain else None

        async with self.global_limit, self.domain_limits[domain]:
            facts = await self._domain_facts(domain)
            if facts.null_mx:
                return VerificationResult(
                    email=normalized,
                    syntax=True,
                    domain=True,
                    mx=False,
                    disposable=disposable,
                    role=role,
                    suggested_email=suggested_email,
                    status="invalid",
                    reason="Domain explicitly rejects all email (Null MX)",
                )
            if facts.exists is False:
                reason = f"Domain does not exist (did you mean {suggested_email}?)" if suggested_email else "Domain does not exist"
                return VerificationResult(
                    email=normalized,
                    syntax=True,
                    domain=False,
                    mx=False,
                    disposable=disposable,
                    role=role,
                    suggested_email=suggested_email,
                    status="invalid",
                    reason=reason,
                )
            if facts.exists is None:
                return VerificationResult(
                    email=normalized,
                    syntax=True,
                    domain=None,
                    mx=None,
                    disposable=disposable,
                    role=role,
                    suggested_email=suggested_email,
                    status="unknown",
                    reason="DNS lookup did not answer",
                )
            if facts.has_mx is False:
                reason = f"No MX records found (did you mean {suggested_email}?)" if suggested_email else "No MX records found"
                return VerificationResult(
                    email=normalized,
                    syntax=True,
                    domain=True,
                    mx=False,
                    disposable=disposable,
                    role=role,
                    suggested_email=suggested_email,
                    status="invalid",
                    reason=reason,
                )
            if facts.has_mx is None or not facts.mx_hosts:
                return VerificationResult(
                    email=normalized,
                    syntax=True,
                    domain=True,
                    mx=None,
                    disposable=disposable,
                    role=role,
                    suggested_email=suggested_email,
                    status="unknown",
                    reason="Mail server could not be determined",
                )

            smtp = "unknown"
            catch_all: bool | None = None
            if settings.smtp_enabled:
                smtp = await probe_mailbox(normalized, facts.mx_hosts[0], settings.smtp_timeout_seconds)
                if smtp == "accepted" and settings.catch_all_enabled:
                    catch_all = await self._catch_all(domain, facts.mx_hosts[0])

            if typo_domain and domain != typo_domain:
                status = "risky" if smtp == "accepted" else "invalid"
                reason = f"Possible domain typo (did you mean {suggested_email}?)"
            elif smtp == "rejected":
                status, reason = "invalid", "Mailbox rejected the address"
            elif disposable:
                status, reason = "risky", "Disposable email provider"
            elif catch_all is True:
                status, reason = "risky", "Catch-all domain"
            elif role:
                status, reason = "risky", "Role-based address"
            elif smtp == "accepted":
                status, reason = "valid", "Mailbox accepted"
            else:
                status, reason = "unknown", "MX found; mailbox verification unavailable"

            return VerificationResult(
                email=normalized,
                syntax=True,
                domain=True,
                mx=True,
                disposable=disposable,
                role=role,
                smtp=smtp,
                catch_all=catch_all,
                spf=facts.has_spf,
                dmarc=facts.has_dmarc,
                provider=facts.provider,
                suggested_email=suggested_email,
                status=status,
                reason=reason,
            )


verification_service = VerificationService()
