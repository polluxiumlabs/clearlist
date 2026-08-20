from functools import lru_cache
from pathlib import Path


@lru_cache(maxsize=1)
def disposable_domains() -> frozenset[str]:
    source = Path(__file__).resolve().parents[2] / "disposable_domains.txt"
    return frozenset(
        line.strip().lower()
        for line in source.read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.startswith("#")
    )


def is_disposable(domain: str) -> bool:
    return domain.lower() in disposable_domains()
