import asyncio
from typing import Literal

SmtpStatus = Literal["accepted", "rejected", "unknown"]


async def _read_reply(reader: asyncio.StreamReader, timeout: float) -> int:
    code = 0
    while True:
        line = await asyncio.wait_for(reader.readline(), timeout=timeout)
        if len(line) < 3:
            return 0
        try:
            code = int(line[:3])
        except ValueError:
            return 0
        if len(line) < 4 or line[3:4] != b"-":
            return code


async def _send(writer: asyncio.StreamWriter, reader: asyncio.StreamReader, command: str, timeout: float) -> int:
    writer.write(command.encode("ascii") + b"\r\n")
    await asyncio.wait_for(writer.drain(), timeout=timeout)
    return await _read_reply(reader, timeout)


async def probe_mailbox(email: str, mx_host: str, timeout: float) -> SmtpStatus:
    writer: asyncio.StreamWriter | None = None
    try:
        reader, writer = await asyncio.wait_for(asyncio.open_connection(mx_host, 25), timeout=timeout)
        greeting = await _read_reply(reader, timeout)
        if greeting != 220:
            return "unknown"
        await _send(writer, reader, "EHLO verifier.invalid", timeout)
        await _send(writer, reader, "MAIL FROM:<>", timeout)
        code = await _send(writer, reader, f"RCPT TO:<{email}>", timeout)
        if code in {250, 251, 252}:
            return "accepted"
        if code in {550, 551, 552, 553, 554}:
            return "rejected"
        return "unknown"
    except (asyncio.TimeoutError, ConnectionError, OSError):
        return "unknown"
    finally:
        if writer is not None:
            try:
                writer.write(b"QUIT\r\n")
                await writer.drain()
            except (ConnectionError, OSError):
                pass
            writer.close()
            try:
                await writer.wait_closed()
            except (ConnectionError, OSError):
                pass
