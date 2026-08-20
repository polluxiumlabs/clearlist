from .domain import DomainFacts


def has_mail_exchange(facts: DomainFacts) -> bool | None:
    return facts.has_mx
