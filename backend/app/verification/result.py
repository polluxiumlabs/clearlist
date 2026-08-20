from typing import Literal

from pydantic import BaseModel


class VerificationResult(BaseModel):
    email: str
    syntax: bool
    domain: bool | None = None
    mx: bool | None = None
    disposable: bool = False
    role: bool = False
    smtp: Literal["accepted", "rejected", "unknown"] = "unknown"
    catch_all: bool | None = None
    status: Literal["valid", "invalid", "risky", "unknown"]
    reason: str
