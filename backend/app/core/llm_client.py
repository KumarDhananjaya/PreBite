"""Single place that talks to the Claude API (the only provider used).

Replaces the copy-pasted urllib blocks. Features:
  * Claude tool-use with a JSON schema -> no markdown-fence / prose parsing
  * retries with backoff on 429/5xx/529 and on network errors (incl. timeouts)
  * every failure is logged with status + body snippet (never the API key)
  * media sniffing by magic bytes (PDF vs JPEG/PNG/WebP), optional downscaling
  * truncation detection (stop_reason == "max_tokens") with automatic retry
Set the model via settings.claude_model / env; the default is only a fallback.
"""
from __future__ import annotations

import base64
import http.client
import io
import json
import logging
import re
import time
from dataclasses import dataclass
from typing import Any, Callable
from urllib import error, request

from app.core.config import get_settings

logger = logging.getLogger(__name__)

DEFAULT_CLAUDE_MODEL = "claude-sonnet-5-5"
ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
ANTHROPIC_VERSION = "2023-06-01"

PDF_MIME = "application/pdf"
MAX_IMAGE_BYTES = 3_750_000  # raw bytes; keeps base64 under Claude's 5 MB image limit
MAX_IMAGE_EDGE = 2576
MAX_OUTPUT_TOKENS_CAP = 16_000
MAX_ATTEMPTS = 3
RETRYABLE_STATUS = {408, 429, 500, 502, 503, 504, 529}


class LLMError(Exception):
    """A provider call failed in a way the caller may want to log or skip."""


# --------------------------------------------------------------------------- media


@dataclass(frozen=True)
class Media:
    name: str
    data: bytes
    mime: str

    @property
    def is_pdf(self) -> bool:
        return self.mime == PDF_MIME

    @property
    def b64(self) -> str:
        return base64.b64encode(self.data).decode("ascii")


def sniff_mime(data: bytes) -> str | None:
    """Identify PDF/JPEG/PNG/WebP from magic bytes (extensions can lie or be missing)."""
    if not data:
        return None
    if b"%PDF-" in data[:1024]:
        return PDF_MIME
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


def _shrink_image(data: bytes, mime: str) -> tuple[bytes, str]:
    """Downscale oversized images with Pillow if installed; otherwise return as-is."""
    try:
        from PIL import Image, ImageOps # type: ignore
    except ImportError:
        return data, mime
    try:
        resample = getattr(Image, "Resampling", Image).LANCZOS
        with Image.open(io.BytesIO(data)) as opened:
            img = ImageOps.exif_transpose(opened)
            width, height = img.size
            if len(data) <= MAX_IMAGE_BYTES and max(width, height) <= MAX_IMAGE_EDGE:
                return data, mime
            if img.mode in ("P", "LA", "RGBA"):
                rgba = img.convert("RGBA")
                background = Image.new("RGB", rgba.size, "white")
                background.paste(rgba, mask=rgba.split()[-1])
                img = background
            else:
                img = img.convert("RGB")
            scale = min(1.0, MAX_IMAGE_EDGE / max(width, height))
            quality = 90
            buf = io.BytesIO()
            for _ in range(6):
                size = (max(1, int(width * scale)), max(1, int(height * scale)))
                candidate = img.resize(size, resample) if scale < 1.0 else img
                buf = io.BytesIO()
                candidate.save(buf, "JPEG", quality=quality, optimize=True)
                if buf.tell() <= MAX_IMAGE_BYTES:
                    break
                scale *= 0.8
                quality = max(70, quality - 5)
            return buf.getvalue(), "image/jpeg"
    except Exception:
        logger.warning("Could not downscale image; sending original", exc_info=True)
        return data, mime


def prepare_media(file_name: str, data: bytes) -> Media | None:
    """Sniff the real type and make the file safe to send. None if unusable."""
    mime = sniff_mime(data)
    if mime is None:
        logger.warning("Unrecognised file type for %r (not PDF/JPEG/PNG/WebP)", file_name)
        return None
    if mime != PDF_MIME:
        data, mime = _shrink_image(data, mime)
        if len(data) > 5_000_000:
            logger.warning(
                "Image %r is %d bytes, over Claude's 5 MB limit; install Pillow to auto-downscale",
                file_name,
                len(data),
            )
            return None
    return Media(name=file_name, data=data, mime=mime)


# --------------------------------------------------------------------------- JSON


def extract_json(text: str | None) -> Any:
    """Parse JSON from model text: plain, fenced, or surrounded by prose."""
    if not text:
        return None
    cleaned = text.strip()
    fence = re.search(r"```(?:json)?\s*(.*?)```", cleaned, re.DOTALL | re.IGNORECASE)
    if fence:
        cleaned = fence.group(1).strip()
    try:
        return json.loads(cleaned)
    except ValueError:
        pass
    start = re.search(r"[\[{]", cleaned)
    if not start:
        return None
    try:
        obj, _ = json.JSONDecoder().raw_decode(cleaned[start.start():])
        return obj
    except ValueError:
        return None


# --------------------------------------------------------------------------- HTTP


def _safe_body(exc: error.HTTPError) -> str:
    try:
        return exc.read().decode("utf-8", "replace")[:500]
    except Exception:
        return "<unreadable body>"


def _retry_delay(exc: error.HTTPError | None, attempt: int) -> float:
    if exc is not None:
        retry_after = exc.headers.get("Retry-After") if exc.headers else None
        if retry_after:
            try:
                return min(float(retry_after), 30.0)
            except ValueError:
                pass
    return min(2.0 ** attempt, 20.0)


def _post_json(url: str, headers: dict[str, str], payload: dict[str, Any], timeout: float, label: str) -> dict[str, Any]:
    body = json.dumps(payload).encode("utf-8")
    for attempt in range(1, MAX_ATTEMPTS + 1):
        req = request.Request(url, data=body, headers=headers, method="POST")
        delay = 1.0
        try:
            with request.urlopen(req, timeout=timeout) as response:
                decoded = json.loads(response.read().decode("utf-8"))
            if not isinstance(decoded, dict):
                raise LLMError(f"{label}: unexpected response shape")
            return decoded
        except error.HTTPError as exc:  # must precede URLError/OSError
            logger.warning("%s HTTP %s (attempt %d/%d): %s", label, exc.code, attempt, MAX_ATTEMPTS, _safe_body(exc))
            if exc.code not in RETRYABLE_STATUS or attempt == MAX_ATTEMPTS:
                raise LLMError(f"{label} HTTP {exc.code}") from exc
            delay = _retry_delay(exc, attempt)
        except (error.URLError, http.client.HTTPException, OSError) as exc:
            # OSError covers TimeoutError, ConnectionResetError, etc.
            logger.warning("%s network error (attempt %d/%d): %r", label, attempt, MAX_ATTEMPTS, exc)
            if attempt == MAX_ATTEMPTS:
                raise LLMError(f"{label} network error: {exc!r}") from exc
            delay = min(2.0 ** attempt, 20.0)
        except ValueError as exc:  # bad JSON / bad utf-8 in the HTTP body
            raise LLMError(f"{label}: invalid response body") from exc
        time.sleep(delay)
    raise LLMError(f"{label}: exhausted retries")  # pragma: no cover


# --------------------------------------------------------------------------- Claude


def _claude_headers(api_key: str) -> dict[str, str]:
    return {
        "Content-Type": "application/json",
        "x-api-key": api_key,
        "anthropic-version": ANTHROPIC_VERSION,
    }


def _claude_content(prompt: str, media: Media | None) -> list[dict[str, Any]]:
    content: list[dict[str, Any]] = []
    if media is not None:
        block_type = "document" if media.is_pdf else "image"
        content.append({"type": block_type, "source": {"type": "base64", "media_type": media.mime, "data": media.b64}})
    content.append({"type": "text", "text": prompt})
    return content


def call_claude_structured(
    *,
    prompt: str,
    tool_name: str,
    tool_description: str,
    schema: dict[str, Any],
    media: Media | None = None,
    max_tokens: int = 2000,
    timeout: float = 30,
) -> dict[str, Any] | None:
    settings = get_settings()
    api_key = settings.anthropic_api_key
    if not api_key:
        return None
    tool_prompt = f"{prompt}\n\nSubmit your answer by calling the `{tool_name}` tool."
    tokens = max_tokens
    for _ in range(3):
        payload = {
            "model": settings.claude_model or DEFAULT_CLAUDE_MODEL,
            "max_tokens": tokens,
            "tools": [{"name": tool_name, "description": tool_description, "input_schema": schema}],
            "tool_choice": {"type": "auto"},
            "messages": [{"role": "user", "content": _claude_content(tool_prompt, media)}],
        }
        decoded = _post_json(ANTHROPIC_URL, _claude_headers(api_key), payload, timeout, "claude")
        if decoded.get("stop_reason") == "max_tokens":
            if tokens >= MAX_OUTPUT_TOKENS_CAP:
                logger.error("claude output truncated at the %d token cap; result discarded", tokens)
                return None
            tokens = min(tokens * 2, MAX_OUTPUT_TOKENS_CAP)
            logger.warning("claude output truncated; retrying with max_tokens=%d", tokens)
            continue
        for block in decoded.get("content") or []:
            if (
                isinstance(block, dict)
                and block.get("type") == "tool_use"
                and block.get("name") == tool_name
                and isinstance(block.get("input"), dict)
            ):
                return block["input"]
        # The model answered in text instead of calling the tool: recover JSON from it.
        text = "".join(
            b.get("text") or "" for b in decoded.get("content") or [] if isinstance(b, dict) and b.get("type") == "text"
        )
        parsed = extract_json(text)
        if isinstance(parsed, dict):
            return parsed
        if isinstance(parsed, list):
            return {"dishes": parsed}
        logger.warning("claude returned no %s tool_use block or JSON text (stop_reason=%s)", tool_name, decoded.get("stop_reason"))
        return None
    return None


def call_claude_text(*, prompt: str, media: Media | None = None, max_tokens: int = 1000, timeout: float = 30) -> str | None:
    settings = get_settings()
    api_key = settings.anthropic_api_key
    if not api_key:
        return None
    payload = {
        "model": settings.claude_model or DEFAULT_CLAUDE_MODEL,
        "max_tokens": max_tokens,
        "messages": [{"role": "user", "content": _claude_content(prompt, media)}],
    }
    decoded = _post_json(ANTHROPIC_URL, _claude_headers(api_key), payload, timeout, "claude")
    if decoded.get("stop_reason") == "max_tokens":
        logger.warning("claude text output was truncated at %d tokens", max_tokens)
    text = "".join(
        b.get("text") or "" for b in decoded.get("content") or [] if isinstance(b, dict) and b.get("type") == "text"
    ).strip()
    return text or None


# --------------------------------------------------------------------------- runners (Claude only)


def run_structured(
    *,
    prompt: str,
    tool_name: str,
    schema: dict[str, Any],
    tool_description: str = "Return the structured result.",
    media: Media | None = None,
    max_tokens: int = 2000,
    timeout: float = 30,
    temperature: float | None = None,  # accepted for compatibility; not sent (some models reject it)
    accept: Callable[[dict[str, Any]], bool] | None = None,
) -> tuple[dict[str, Any] | None, str | None]:
    """Ask Claude for structured output. Returns (data, "claude") or (None, None).

    `accept` lets the caller reject a response (e.g. zero usable dishes).
    """
    try:
        data = call_claude_structured(
            prompt=prompt, tool_name=tool_name, tool_description=tool_description, schema=schema,
            media=media, max_tokens=max_tokens, timeout=timeout,
        )
    except LLMError as exc:
        logger.warning("claude call failed: %s", exc)
        return None, None
    except Exception:
        logger.exception("claude call crashed unexpectedly")
        return None, None
    if not isinstance(data, dict):
        return None, None
    if accept is not None:
        try:
            ok = accept(data)
        except Exception:
            logger.exception("accept() raised for claude result")
            ok = False
        if not ok:
            logger.info("claude result rejected by accept()")
            return None, None
    return data, "claude"


def run_text(*, prompt: str, media: Media | None = None, max_tokens: int = 1000, timeout: float = 30) -> str | None:
    """Plain-text completion (OCR) via Claude."""
    try:
        return call_claude_text(prompt=prompt, media=media, max_tokens=max_tokens, timeout=timeout)
    except LLMError as exc:
        logger.warning("claude text call failed: %s", exc)
    except Exception:
        logger.exception("claude text call crashed unexpectedly")
    return None