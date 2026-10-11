"""Small, dependency-free text helpers shared by the menu services."""
from __future__ import annotations

import math
import re
import unicodedata
from typing import Any

_WS_RE = re.compile(r"\s+")
_NUMBER_RE = re.compile(r"\d[\d.,]*")

_CONFIDENCE_WORDS = {
    "very high": 0.95,
    "high": 0.9,
    "medium": 0.6,
    "moderate": 0.6,
    "low": 0.3,
    "very low": 0.15,
}


def fold_text(text: str) -> str:
    """Lowercase and strip accents so 'Ragù' and 'ragu' compare equal."""
    decomposed = unicodedata.normalize("NFKD", text or "")
    return "".join(ch for ch in decomposed if not unicodedata.combining(ch)).lower()


def word_pattern(term: str) -> re.Pattern[str]:
    """Whole-word (not substring) pattern for an accent-folded term."""
    return re.compile(rf"(?<!\w){re.escape(fold_text(term))}(?!\w)")


def words_pattern(words: list[str] | tuple[str, ...]) -> re.Pattern[str]:
    """Whole-word alternation over several accent-folded terms."""
    alternation = "|".join(re.escape(fold_text(w)) for w in words)
    return re.compile(rf"(?<!\w)(?:{alternation})(?!\w)")


def normalize_text(value: Any) -> str | None:
    """Collapse whitespace. Accepts str and plain numbers; anything else -> None.

    Never raises, so a stray number or null inside an LLM response cannot
    discard a whole dish.
    """
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        value = str(value)
    if not isinstance(value, str):
        return None
    normalized = _WS_RE.sub(" ", value).strip()
    return normalized or None


def normalize_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    out: list[str] = []
    for entry in value:
        text = normalize_text(entry)
        if text:
            out.append(text)
    return out


def parse_price(raw: Any) -> float | None:
    """Parse '18.5', '18,50', '1.234,50', '1,234.50', '$12 / $15' (-> first price)."""
    if raw is None or isinstance(raw, bool):
        return None
    if isinstance(raw, (int, float)):
        value = float(raw)
    else:
        match = _NUMBER_RE.search(str(raw))
        if not match:
            return None
        token = match.group(0).rstrip(".,")
        if "," in token and "." in token:
            if token.rfind(",") > token.rfind("."):  # 1.234,50
                token = token.replace(".", "").replace(",", ".")
            else:  # 1,234.50
                token = token.replace(",", "")
        elif "," in token:
            head, _, tail = token.rpartition(",")
            if len(tail) <= 2 and "," not in head:  # 18,50
                token = f"{head}.{tail}"
            else:  # 1,500
                token = token.replace(",", "")
        elif token.count(".") > 1:  # 1.500.000
            token = token.replace(".", "")
        try:
            value = float(token)
        except ValueError:
            return None
    if not math.isfinite(value) or value < 0 or value > 100_000:
        return None
    return value


def coerce_confidence(raw: Any, default: float | None) -> float | None:
    """Return a float in [0, 1]. 0.0 is preserved (it is NOT 'missing').

    Accepts numbers, numeric strings ('0.7', '70%') and high/medium/low.
    Falls back to `default` for anything else.
    """
    if raw is None or isinstance(raw, bool):
        return default
    if isinstance(raw, str):
        text = raw.strip().lower()
        if text in _CONFIDENCE_WORDS:
            return _CONFIDENCE_WORDS[text]
        percent = text.endswith("%")
        try:
            value = float(text.rstrip("%"))
        except ValueError:
            return default
        if percent:
            value /= 100.0
    else:
        try:
            value = float(raw)
        except (TypeError, ValueError):
            return default
    if not math.isfinite(value):
        return default
    return max(0.0, min(1.0, value))