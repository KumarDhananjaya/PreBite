"""Find real web images rather than asking the LLM to invent image URLs."""
from __future__ import annotations

import html
import json
import logging
import re
from urllib import request, parse

logger = logging.getLogger(__name__)


def find_dish_images(dish_name: str) -> list[dict[str, str]]:
    if not dish_name.strip():
        return []
    params = parse.urlencode({
        "action": "query", "format": "json", "generator": "search",
        "gsrsearch": f'"{dish_name[:160]}" filetype:bitmap',
        "gsrnamespace": 6, "gsrlimit": 3, "prop": "imageinfo",
        "iiprop": "url|mime|extmetadata", "iiurlwidth": 960,
    })
    req = request.Request(
        f"https://commons.wikimedia.org/w/api.php?{params}",
        headers={"User-Agent": "PreBite/0.1 (dish reference image lookup)", "Accept": "application/json"},
    )
    try:
        with request.urlopen(req, timeout=6) as response:
            data = json.load(response)
        images = []
        pages = data.get("query", {}).get("pages", {}).values()
        for page in sorted(pages, key=lambda p: p.get("index", 0)):
            info = (page.get("imageinfo") or [{}])[0]
            url = info.get("thumburl") or info.get("url", "")
            source = info.get("descriptionurl", "")
            if (parse.urlparse(url).scheme != "https"
                    or parse.urlparse(url).hostname != "upload.wikimedia.org"
                    or parse.urlparse(source).hostname != "commons.wikimedia.org"
                    or info.get("mime") not in {"image/jpeg", "image/png", "image/webp"}):
                continue
            metadata = info.get("extmetadata", {})
            def plain(key: str) -> str:
                return html.unescape(re.sub(r"<[^>]*>", "", metadata.get(key, {}).get("value", ""))).strip()
            license_name = plain("LicenseShortName")
            if not license_name:
                continue
            images.append({"url": url, "source_url": source,
                           "title": page.get("title", "").removeprefix("File:"),
                           "artist": plain("Artist"), "license": license_name})
        return images
    except Exception:
        logger.warning("Web image lookup failed for %r", dish_name, exc_info=True)
        return []
