"""Search for dish-specific reference photos; never substitute category stock."""
from __future__ import annotations

import html
import ipaddress
import json
import logging
import re
import time
from collections import OrderedDict
from threading import Lock
from urllib import request, parse

from app.core.config import get_settings
from app.core.text_utils import fold_text, normalize_text

logger = logging.getLogger(__name__)
_CACHE: OrderedDict = OrderedDict()
_CACHE_LOCK = Lock()
_STOP_WORDS = {"a", "an", "the", "and", "with", "of", "alla", "al", "e", "di", "de", "la", "le", "au",
               "dish", "special", "chef", "house", "signature", "menu", "plate", "item"}


def is_unsplash_image(value: str | None) -> bool:
    host = parse.urlparse(value or "").hostname or ""
    return host == "unsplash.com" or host.endswith(".unsplash.com")


def _public_https(value) -> bool:
    if not isinstance(value, str):
        return False
    try:
        url = parse.urlparse(value)
        host = url.hostname or ""
        if url.scheme != "https" or not host or url.username or url.password or url.port not in (None, 443):
            return False
        if host == "localhost" or host.endswith((".localhost", ".local")) or "." not in host:
            return False
        try:
            return ipaddress.ip_address(host).is_global
        except ValueError:
            return True
    except ValueError:
        return False


def _tokens(value: str) -> set[str]:
    return set(re.findall(r"[^\W_]+", fold_text(value))) - _STOP_WORDS


def _relevant(dish_name: str, title: str) -> bool:
    # Accept a related dish; prefer fuller name matches when ranking results.
    words = _tokens(dish_name)
    return bool(words & _tokens(title))


def _google_images(dish_name: str, cuisine: str, api_key: str) -> list[dict[str, str]]:
    params = parse.urlencode({"engine": "google_images", "q": f'{dish_name} {cuisine} plated food',
                              "api_key": api_key, "safe": "active", "hl": "en", "tbs": "itp:photo"})
    req = request.Request(f"https://serpapi.com/search.json?{params}", headers={"Accept": "application/json"})
    with request.urlopen(req, timeout=6) as response:
        data = json.load(response)
    images = []
    seen = set()
    results = [result for result in data.get("images_results", [])[:30] if isinstance(result, dict)]
    results.sort(key=lambda result: -len(_tokens(dish_name) & _tokens(normalize_text(result.get("title")) or "")))
    for result in results:
        if not isinstance(result, dict):
            continue
        url, source = result.get("original"), result.get("link")
        title = normalize_text(result.get("title")) or ""
        if (not _public_https(url) or not _public_https(source) or is_unsplash_image(url)
                or url in seen):
            continue
        width, height = result.get("original_width"), result.get("original_height")
        if isinstance(width, (int, float)) and isinstance(height, (int, float)) and min(width, height) < 250:
            continue
        seen.add(url)
        images.append({"url": url, "source_url": source, "title": title, "artist": "",
                       "license": "See source for usage rights", "source": normalize_text(result.get("source")) or "Web source",
                       "provider": "google_images"})
        if len(images) == 3:
            break
    return images


def _commons_images(dish_name: str) -> list[dict[str, str]]:
    params = parse.urlencode({
        "action": "query", "format": "json", "generator": "search",
        "gsrsearch": '(' + ' OR '.join(sorted(_tokens(dish_name))) + ') filetype:bitmap',
        "gsrnamespace": 6, "gsrlimit": 10, "prop": "imageinfo",
        "iiprop": "url|mime|extmetadata", "iiurlwidth": 960,
    })
    req = request.Request(f"https://commons.wikimedia.org/w/api.php?{params}",
        headers={"User-Agent": "PreBite/0.1 (dish reference image lookup)", "Accept": "application/json"})
    with request.urlopen(req, timeout=6) as response:
        data = json.load(response)
    images = []
    pages = data.get("query", {}).get("pages", {}).values()
    for page in sorted(pages, key=lambda p: (-len(_tokens(dish_name) & _tokens(p.get("title", ""))), p.get("index", 0))):
        info = (page.get("imageinfo") or [{}])[0]
        url, source = info.get("thumburl") or info.get("url", ""), info.get("descriptionurl", "")
        title = page.get("title", "").removeprefix("File:")
        if (not _public_https(url) or parse.urlparse(url).hostname != "upload.wikimedia.org"
                or not _public_https(source) or parse.urlparse(source).hostname != "commons.wikimedia.org"
                or info.get("mime") not in {"image/jpeg", "image/png", "image/webp"}
                or not _relevant(dish_name, title)):
            continue
        metadata = info.get("extmetadata", {})
        def plain(key: str) -> str:
            return html.unescape(re.sub(r"<[^>]*>", "", metadata.get(key, {}).get("value", ""))).strip()
        license_name = plain("LicenseShortName")
        if not license_name:
            continue
        images.append({"url": url, "source_url": source, "title": title,
                       "artist": plain("Artist"), "license": license_name,
                       "source": "Wikimedia Commons", "provider": "wikimedia"})
        if len(images) == 3:
            break
    return images


def find_dish_images(dish_name: str, cuisine: str | None = None) -> list[dict[str, str]]:
    name = (normalize_text(dish_name) or "")[:160]
    context = (normalize_text(cuisine) or "")[:80]
    if context.casefold() in {"unknown", "unspecified", "general"}:
        context = ""
    if not _tokens(name):
        return []
    api_key = get_settings().serpapi_api_key
    cache_key = (fold_text(name), fold_text(context), api_key)
    with _CACHE_LOCK:
        cached = _CACHE.get(cache_key)
        if cached and cached[0] > time.monotonic():
            _CACHE.move_to_end(cache_key)
            return [dict(image) for image in cached[1]]
    images = []
    if api_key:
        try:
            images = _google_images(name, context, api_key)
        except Exception:
            # Do not log exceptions/request URLs: they can contain the API key.
            logger.warning("Google image lookup unavailable for %r", name)
    if not images:
        try:
            images = _commons_images(name)
        except Exception:
            logger.warning("Wikimedia image lookup unavailable for %r", name)
    with _CACHE_LOCK:
        _CACHE[cache_key] = (time.monotonic() + (21600 if images else 60), [dict(image) for image in images])
        _CACHE.move_to_end(cache_key)
        while len(_CACHE) > 256:
            _CACHE.popitem(last=False)
    return images
