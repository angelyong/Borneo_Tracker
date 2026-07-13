"""
Borneo Tracker — News Tracker collection step (AR-3, Plan A).  POC / Phase-1a.

Pulls REAL recent Borneo sustainability news, filters to a rolling N-day window,
tags each item by beat/territory/language, dedupes, and writes JSON. Two sources:

  1. PUBLISHER-NATIVE RSS  (news_sources.yml outlets marked verify: true) — pulled
     FIRST because these carry a real <description> (fuller than a headline), a real
     publisher link (no Google redirect), and often an image. General/national feeds
     are re-filtered here through the same beat-keyword + territory tagging.
  2. GOOGLE NEWS RSS  (keyless) — broad aggregate across the whitelist. Bodies here
     are only the headline (Google echoes the title), and links are Google redirects.

This is the collection half of the pipeline. The AI-rewrite step (digest_news.py,
Gemini) is separate — bodies here are the raw RSS snippet, clearly marked
(aiGenerated: false), so nothing is presented as our own writing yet.

Run:  python fetch_news.py --days 3 --per-query 6 --out <path.json>
      python fetch_news.py --no-publisher     # Google News only (old behaviour)
"""

import argparse
import datetime as dt
import html
import json
import re
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from collections import Counter

# --- Minimal config (subset of news_sources.yml; inlined to avoid a YAML dep) ---
BEATS = {
    "fire_haze":      {"label": "Fire & Haze",                "esg": "E", "sdg": ["SDG13", "SDG3"],
                       "en": "haze OR fire", "id": "karhutla OR kebakaran hutan"},
    "deforestation":  {"label": "Deforestation & Palm Oil",   "esg": "E", "sdg": ["SDG15", "SDG12"],
                       "en": "deforestation OR palm oil",      "id": "deforestasi OR kelapa sawit"},
    "floods_weather": {"label": "Floods & Extreme Weather",   "esg": "E", "sdg": ["SDG13", "SDG11"],
                       "en": "flood OR landslide",             "id": "banjir OR longsor"},
    "conservation":   {"label": "Conservation & Wildlife",    "esg": "E", "sdg": ["SDG15", "SDG14"],
                       "en": "orangutan OR wildlife",          "id": "orangutan OR satwa liar"},
    "policy_dev":     {"label": "Policy & Major Development",  "esg": "G", "sdg": ["SDG7", "SDG9"],
                       "en": "renewable energy OR carbon",     "id": "energi terbarukan OR IKN"},
    "governance":     {"label": "Governance & Institutions",  "esg": "G", "sdg": ["SDG16"],
                       "en": "environmental enforcement OR illegal logging",
                       "id": "penegakan hukum lingkungan OR moratorium sawit"},
}
TERRITORIES = [
    {"name": "Sabah",       "country": "Malaysia",  "lang": "en", "ceid": ("en-MY", "MY", "MY:en")},
    {"name": "Sarawak",     "country": "Malaysia",  "lang": "en", "ceid": ("en-MY", "MY", "MY:en")},
    {"name": "Brunei",      "country": "Brunei",    "lang": "en", "ceid": ("en-MY", "MY", "MY:en")},
    {"name": "Kalimantan",  "country": "Indonesia", "lang": "id", "ceid": ("id",    "ID", "ID:id")},
]

# --- Publisher-native RSS layer --------------------------------------------
# Verified live 2026-07-14 (see news_sources.yml for the notes). These are
# general (all-topic) feeds, so every item is re-tagged through the beat-keyword
# filter below and dropped if out of scope. `national: True` feeds cover more than
# Borneo, so they are kept only when the text names a Borneo territory.
PUBLISHER_FEEDS = [
    {"name": "The Borneo Post",   "url": "https://www.theborneopost.com/feed/",
     "lang": "en", "default_territory": "Sarawak",   "national": False},
    {"name": "ANTARA Kaltim",     "url": "https://kaltim.antaranews.com/rss/terkini.xml",
     "lang": "id", "default_territory": "Kalimantan", "national": False},
    {"name": "ANTARA Kalbar",     "url": "https://kalbar.antaranews.com/rss/terkini.xml",
     "lang": "id", "default_territory": "Kalimantan", "national": False},
    {"name": "ANTARA Kalteng",    "url": "https://kalteng.antaranews.com/rss/terkini.xml",
     "lang": "id", "default_territory": "Kalimantan", "national": False},
    {"name": "ANTARA Kalsel",     "url": "https://kalsel.antaranews.com/rss/terkini.xml",
     "lang": "id", "default_territory": "Kalimantan", "national": False},
    {"name": "ANTARA Kaltara",    "url": "https://kaltara.antaranews.com/rss/terkini.xml",
     "lang": "id", "default_territory": "Kalimantan", "national": False},
    {"name": "Mongabay Indonesia", "url": "https://www.mongabay.co.id/feed/",
     "lang": "id", "default_territory": "Kalimantan", "national": True},
    {"name": "Mongabay",           "url": "https://news.mongabay.com/feed/",
     "lang": "en", "default_territory": "Kalimantan", "national": True},
]

# Ordered beat keyword map (first match wins). Lowercase substring match; the
# Gemini relevance step in digest_news.py is the second gate that drops the
# false-positives this permissive filter lets through.
BEAT_KEYWORDS = [
    ("fire_haze",      ["haze", "hotspot", "peat fire", "air quality", "wildfire", "forest fire",
                        "karhutla", "kebakaran hutan", "kebakaran lahan", "kabut asap", "titik api",
                        "titik panas", "jerebu", "kabut", " asap"]),
    ("deforestation",  ["deforestation", "palm oil", "forest clearing", "illegal logging", "logging",
                        "plantation", "peatland", "deforestasi", "kelapa sawit", "pembalakan",
                        "penebangan hutan", "penggundulan hutan", "perkebunan sawit", "alih fungsi hutan"]),
    ("floods_weather", ["flood", "landslide", "drought", "storm", "extreme weather",
                        "banjir", "tanah longsor", "longsor", "tanah runtuh", "kemarau",
                        "cuaca ekstrem", "kekeringan"]),
    ("conservation",   ["orangutan", "wildlife", "conservation", "elephant", "national park",
                        "biodiversity", "endangered", "rainforest", "species", "orang utan",
                        "satwa liar", "satwa", "konservasi", "taman nasional", "keanekaragaman hayati",
                        "hutan lindung", "pemuliharaan", "gajah"]),
    ("policy_dev",     ["renewable energy", "carbon", "solar", "hydropower", "sustainability",
                        "net zero", "ikn nusantara", "ikn", "green energy",
                        "energi terbarukan", "tenaga boleh baharu", "perdagangan karbon",
                        "energi surya", "kelestarian", "mampan"]),
    ("governance",     ["environmental policy", "enforcement", "land permit", "corruption",
                        "moratorium", "environmental law", "penegakan hukum", "izin lahan",
                        "kebijakan lingkungan", "tata kelola", "rasuah", "penguatkuasaan"]),
]

TERR_COUNTRY = {"Sabah": "Malaysia", "Sarawak": "Malaysia",
                "Brunei": "Brunei", "Kalimantan": "Indonesia"}

BROWSER_UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
              "(KHTML, like Gecko) Chrome/126.0 Safari/537.36")
NS = {"media": "http://search.yahoo.com/mrss/",
      "content": "http://purl.org/rss/1.0/modules/content/"}


def slugify(text):
    s = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return s[:70] or "item"


def strip_html(text):
    return html.unescape(re.sub(r"<[^>]+>", "", text or "")).strip()


def fetch_rss(query, ceid, days):
    hl, gl, ceid_str = ceid
    q = f"{query} when:{days}d"
    url = (f"https://news.google.com/rss/search?q={urllib.parse.quote(q)}"
           f"&hl={hl}&gl={gl}&ceid={ceid_str}")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    data = urllib.request.urlopen(req, timeout=25).read()
    return ET.fromstring(data).findall(".//item")


def parse_pubdate(text):
    if not text:
        return None
    text = text.strip()
    for fmt in ("%a, %d %b %Y %H:%M:%S %z",      # RFC822 with numeric offset (publisher feeds)
                "%a, %d %b %Y %H:%M:%S %Z",      # named zone
                "%a, %d %b %Y %H:%M:%S GMT"):
        try:
            d = dt.datetime.strptime(text, fmt)
            return d if d.tzinfo else d.replace(tzinfo=dt.timezone.utc)
        except (ValueError, TypeError):
            continue
    return None


def detect_beat(text):
    """Return (beat_id, meta) for the first matching beat, or (None, None)."""
    t = text.lower()
    for beat_id, kws in BEAT_KEYWORDS:
        if any(kw in t for kw in kws):
            return beat_id, BEATS[beat_id]
    return None, None


def detect_territories(text):
    """Specific Borneo territories named in the text (may be empty)."""
    t = text.lower()
    found = []
    if "sarawak" in t:
        found.append("Sarawak")
    if "sabah" in t:
        found.append("Sabah")
    if "brunei" in t:
        found.append("Brunei")
    if re.search(r"kalimantan|kaltim|kalbar|kalteng|kalsel|kaltara", t):
        found.append("Kalimantan")
    return found


def extract_image(item):
    """First usable image URL from media:content / media:thumbnail / enclosure / <img>."""
    for tag in ("media:content", "media:thumbnail"):
        el = item.find(tag, NS)
        if el is not None and (el.get("url") or "").startswith("http"):
            return el.get("url")
    enc = item.find("enclosure")
    if enc is not None:
        url = enc.get("url") or ""
        typ = enc.get("type") or "image"
        if url.startswith("http") and "image" in typ:
            return url
    blob = (item.findtext("content:encoded", default="", namespaces=NS) or "") \
        + (item.findtext("description") or "")
    m = re.search(r'<img[^>]+src=["\'](https?://[^"\']+)["\']', blob)
    return m.group(1) if m else ""


def fetch_publisher_raw(url):
    req = urllib.request.Request(url, headers={
        "User-Agent": BROWSER_UA,
        "Accept": "application/rss+xml, application/xml, text/xml, */*",
        "Accept-Language": "en,id;q=0.8",
    })
    data = urllib.request.urlopen(req, timeout=25).read()
    return ET.fromstring(data).findall(".//item")


def collect_publisher(days, cutoff, per_feed, seen):
    """Pull, tag, and filter the confirmed-live publisher feeds. Returns item dicts."""
    out = []
    now = dt.datetime.now(dt.timezone.utc)
    for feed in PUBLISHER_FEEDS:
        try:
            raw = fetch_publisher_raw(feed["url"])
        except Exception as e:  # noqa: BLE001 — one bad feed must not kill the run
            print(f"  ! publisher {feed['name']!r}: {type(e).__name__}", file=sys.stderr)
            continue

        kept = 0
        for it in raw:
            if kept >= per_feed:
                break
            title = strip_html(it.findtext("title") or "")
            link = (it.findtext("link") or "").strip()
            if not title or not link.startswith("http"):
                continue
            desc = strip_html(it.findtext("description") or "")
            # WordPress feeds sometimes put the real body in content:encoded.
            if len(desc) < 40:
                ce = strip_html(it.findtext("content:encoded", default="", namespaces=NS))
                if len(ce) > len(desc):
                    desc = ce
            haystack = f"{title}. {desc}"

            beat_id, beat = detect_beat(haystack)
            if not beat:
                continue  # off-topic for our beats

            terrs = detect_territories(haystack)
            if feed["national"] and not terrs and "borneo" not in haystack.lower():
                continue  # national feed, story is not about Borneo
            if not terrs:
                terrs = [feed["default_territory"]]
            country = TERR_COUNTRY.get(terrs[0], "Indonesia")

            key = title.lower()[:60]
            if key in seen:
                continue
            published = parse_pubdate(it.findtext("pubDate"))
            if published and published < cutoff:
                continue
            seen.add(key)
            kept += 1

            snippet = desc[:600].strip()
            published_iso = (published or now).isoformat()
            out.append({
                "id": slugify(title),
                "title": title,
                # Real publisher snippet (fuller than the headline). Marked raw until digest.
                "body": snippet or title,
                "imageUrl": extract_image(it),
                "beat": beat_id,
                "beatLabel": beat["label"],
                "esgPillar": beat["esg"],
                "sdg": beat["sdg"],
                "country": country,
                "territories": terrs,
                "sources": [{"name": feed["name"], "url": link, "publishedAt": published_iso}],
                "sourceCount": 1,
                "originalLang": feed["lang"],
                "aiGenerated": False,
                "status": "pending",
                "createdAt": now.isoformat(),
                "publishedAt": None,
                "isFeatured": False,
            })
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=3)
    ap.add_argument("--per-query", type=int, default=6, help="max items kept per Google query")
    ap.add_argument("--per-feed", type=int, default=8, help="max in-scope items kept per publisher feed")
    ap.add_argument("--publisher", action=argparse.BooleanOptionalAction, default=True,
                    help="also pull confirmed-live publisher RSS feeds (default on)")
    ap.add_argument("--out", default="news_fetched.json")
    args = ap.parse_args()

    cutoff = dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=args.days)
    seen = set()
    items = []

    # 1) Publisher-native feeds FIRST — richer bodies + real links + images win dedupe.
    n_pub = 0
    if args.publisher:
        pub = collect_publisher(args.days, cutoff, args.per_feed, seen)
        items.extend(pub)
        n_pub = len(pub)
        print(f"Publisher RSS: {n_pub} in-scope items from {len(PUBLISHER_FEEDS)} feeds.")

    # 2) Google News RSS — broad aggregate; headline-only bodies, redirect links.
    for beat_id, beat in BEATS.items():
        for terr in TERRITORIES:
            kw = beat[terr["lang"]]
            query = f'{terr["name"]} ({kw})'
            try:
                raw = fetch_rss(query, terr["ceid"], args.days)
            except Exception as e:  # noqa: BLE001 — one bad query must not kill the run
                print(f"  ! {query!r}: {type(e).__name__}", file=sys.stderr)
                continue

            kept = 0
            for it in raw:
                if kept >= args.per_query:
                    break
                title = strip_html(it.findtext("title") or "")
                link = it.findtext("link") or ""
                if not title or not link:
                    continue
                key = title.lower()[:60]
                if key in seen:
                    continue
                published = parse_pubdate(it.findtext("pubDate"))
                if published and published < cutoff:
                    continue
                seen.add(key)
                kept += 1
                src_el = it.find("source")
                source_name = strip_html(src_el.text) if src_el is not None else "Google News"
                published_iso = (published or dt.datetime.now(dt.timezone.utc)).isoformat()
                items.append({
                    "id": slugify(title),
                    "title": title,
                    "body": strip_html(it.findtext("description") or "") or title,
                    "imageUrl": "",
                    "beat": beat_id,
                    "beatLabel": beat["label"],
                    "esgPillar": beat["esg"],
                    "sdg": beat["sdg"],
                    "country": terr["country"],
                    "territories": [terr["name"]],
                    "sources": [{"name": source_name, "url": link, "publishedAt": published_iso}],
                    "sourceCount": 1,
                    "originalLang": terr["lang"],
                    "aiGenerated": False,          # raw snippet — NOT yet AI-rewritten
                    "status": "pending",           # real pipeline output starts as a draft
                    "createdAt": dt.datetime.now(dt.timezone.utc).isoformat(),
                    "publishedAt": None,
                    "isFeatured": False,
                })

    items.sort(key=lambda x: x["sources"][0]["publishedAt"], reverse=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2)

    # Summary
    n_img = sum(1 for i in items if i["imageUrl"])
    n_rich = sum(1 for i in items if len(i["body"]) > len(i["title"]) + 20)
    print(f"Fetched {len(items)} unique items (last {args.days}d; {n_pub} publisher + "
          f"{len(items) - n_pub} google) -> {args.out}")
    print(f"  with image:   {n_img}")
    print(f"  fuller body:  {n_rich}  (body materially longer than headline)")
    print("  by territory:", dict(Counter(i["territories"][0] for i in items)))
    print("  by beat:     ", dict(Counter(i["beat"] for i in items)))
    days = Counter(i["sources"][0]["publishedAt"][:10] for i in items)
    print("  by day:      ", dict(sorted(days.items(), reverse=True)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
