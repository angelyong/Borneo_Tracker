"""
Borneo Tracker — News Tracker AI digest step (AR-3, Plan A).  Phase-1a.

Takes the raw items from fetch_news.py and, in ONE batched Gemini call:
  1. FILTER   — drop anything not genuinely Borneo-sustainability (removes the
                Google-News noise: unrelated fires, finance, other countries…).
  2. REWRITE  — rewrite each kept headline into clear ENGLISH.
  3. BODY     — write a short English body.  *** ANTI-HALLUCINATION ***: we only
                have the headline, so the body may ONLY restate the headline —
                no invented numbers, names, causes, or details.

We do NOT ask the AI to judge whether the news is TRUE (that is impossible for an
LLM). Credibility = trusted whitelist + corroboration count + human approval.

The key is read from the environment or .env (never printed). If no key is found
the script exits 0 (failure isolation — a missing key must not break anything).

Run:  python digest_news.py --in news_fetched.json --limit 24 --out src/data/mockNews.js
"""

import argparse
import json
import os
import re
import sys
import urllib.request
from pathlib import Path

BASE = "https://generativelanguage.googleapis.com/v1beta"
KEY_NAMES = ["GEMINI_API_KEY", "GOOGLE_API_KEY", "GEMINI_KEY"]


def load_key():
    for name in KEY_NAMES:
        if os.environ.get(name):
            return os.environ[name]
    envf = Path(".env")
    if envf.exists():
        for line in envf.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            if k.strip() in KEY_NAMES:
                return v.strip().strip('"').strip("'")
    return None


def http_json(url, payload=None, timeout=120):
    if payload is None:
        req = urllib.request.Request(url)
    else:
        req = urllib.request.Request(
            url, data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.load(resp)


def pick_model(key):
    data = http_json(f"{BASE}/models?key={key}", timeout=30)
    cand = [m["name"].split("/")[-1] for m in data.get("models", [])
            if "generateContent" in m.get("supportedGenerationMethods", [])]
    flash = [n for n in cand if "flash" in n and not any(x in n for x in ("lite", "thinking", "vision", "tts", "image", "audio"))]
    pool = flash or [n for n in cand if "flash" in n] or cand
    if not pool:
        raise RuntimeError("No generateContent-capable model available for this key.")

    def ver(n):
        m = re.search(r"(\d+\.\d+|\d+)", n)
        return float(m.group(1)) if m else 0.0

    pool.sort(key=ver, reverse=True)
    return pool[0]


PROMPT = """You are an editor for a Borneo sustainability news tracker. You are given a JSON list of news items collected across Borneo: Sabah, Sarawak (Malaysia), Brunei, and Kalimantan (Indonesia). Each item has a "title" (headline). SOME items also have a "snippet": the opening of the real article, taken from the publisher's own RSS feed. Most items have NO snippet — only a headline.

For EACH item decide if it is genuinely about BORNEO SUSTAINABILITY, within these beats: fire & haze, deforestation & palm oil, floods & extreme weather, conservation & wildlife, sustainable policy / energy / development, or environmental governance.

Rules:
- DROP any item that is NOT Borneo sustainability: unrelated building/venue fires, general crime, sports, music/festivals, tourism promotion, celebrity, health/education human-interest, pure business/finance not tied to the environment, and any story that is actually about another country (e.g. a Turkish outlet's world news). When unsure, drop it.
- For KEPT items: rewrite the headline into clear, concise ENGLISH (translate if it is Malay/Indonesian).
- Write a 1-3 sentence English "body".
- *** CRITICAL ANTI-HALLUCINATION RULE ***: the body may ONLY restate facts that appear in THAT item's own "title" and "snippet".
    - If the item HAS a snippet: you may summarize the snippet into fluent English (translating if needed). Use only what the snippet and headline actually say.
    - If the item has NO snippet: you only have the headline, so the body must be a faithful English paraphrase of the headline alone.
    - In BOTH cases: DO NOT invent any facts, numbers, names, places, dates, causes, or outcomes that are not present in the provided title/snippet. Never fabricate. Do NOT claim the news is verified or true.
- Return ONLY JSON: {"items": [{"id": "<same id>", "title": "<english title>", "body": "<english, faithful to title/snippet>"}]}. Omit every dropped item.

Items:
"""


def main():
    # Windows consoles default to cp1252 and choke on '→'/Indonesian text; force UTF-8.
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except (AttributeError, ValueError):
        pass
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="infile", default="news_fetched.json")
    ap.add_argument("--limit", type=int, default=24)
    ap.add_argument("--out", default="src/data/mockNews.js")
    args = ap.parse_args()

    key = load_key()
    if not key:
        print("No Gemini key in env or .env (looked for GEMINI_API_KEY). Skipping digest.", file=sys.stderr)
        return 0

    raw = json.load(open(args.infile, encoding="utf-8"))
    by_id = {r["id"]: r for r in raw}

    # Build the compact list sent to Gemini. Publisher-native items carry a fuller
    # RSS "description" in their body (Google News items only echo the headline), so
    # pass that through as a "snippet" the model may faithfully summarize. We detect
    # native items by their real (non-Google) source URL.
    compact = []
    for r in raw:
        item = {"id": r["id"], "title": r["title"], "beat": r["beat"],
                "territory": r["territories"][0], "lang": r["originalLang"]}
        url = (r.get("sources") or [{}])[0].get("url", "")
        body = (r.get("body") or "").strip()
        is_native = "news.google.com" not in url
        if is_native and body and body != r["title"]:
            item["snippet"] = body[:500]
        compact.append(item)

    model = pick_model(key)
    print(f"Using model: {model}  |  sending {len(compact)} headlines to Gemini...")

    payload = {
        "contents": [{"parts": [{"text": PROMPT + json.dumps(compact, ensure_ascii=False)}]}],
        "generationConfig": {"responseMimeType": "application/json", "temperature": 0.2},
    }
    resp = http_json(f"{BASE}/models/{model}:generateContent?key={key}", payload)
    text = resp["candidates"][0]["content"]["parts"][0]["text"]
    try:
        kept = json.loads(text).get("items", [])
    except json.JSONDecodeError:
        m = re.search(r"\{.*\}", text, re.DOTALL)
        kept = json.loads(m.group(0)).get("items", []) if m else []

    print(f"Gemini kept {len(kept)} / {len(raw)} items (dropped {len(raw) - len(kept)} as off-topic/noise).")

    # Merge AI title/body back onto the fetched item (keep the fetch's tags/sources).
    # dict(base) carries the fetch's imageUrl straight through — RSS images survive
    # digestion; only title/body/aiGenerated are overwritten.
    digested = []
    for it in kept:
        base = by_id.get(it["id"])
        if not base or not it.get("title"):
            continue
        base = dict(base)
        base["title"] = it["title"].strip()
        base["body"] = (it.get("body") or it["title"]).strip()
        base["imageUrl"] = base.get("imageUrl", "")  # explicit passthrough of any RSS image
        base["aiGenerated"] = True
        digested.append(base)

    digested.sort(key=lambda x: x["sources"][0]["publishedAt"], reverse=True)
    digested = digested[:args.limit]

    # Seed the app: publish the newest 6, leave the rest as pending drafts.
    for i, it in enumerate(digested):
        if i < 6:
            it["status"] = "published"
            it["publishedAt"] = it["sources"][0]["publishedAt"]
        else:
            it["status"] = "pending"
            it["publishedAt"] = None
        it["isFeatured"] = False

    # Feature the newest PUBLISHED item that has a real image (the hero card then
    # shows a real publisher photo); fall back to the newest item if none has one.
    feature_idx = next((i for i, it in enumerate(digested[:6]) if it.get("imageUrl")), 0)
    if digested:
        digested[feature_idx]["isFeatured"] = True

    header = (
        "// REAL Borneo news (last few days), fetched by fetch_news.py and AI-digested\n"
        "// by digest_news.py (Gemini): filtered to in-scope + rewritten in English.\n"
        "// Bodies restate only the headline, or faithfully summarize the publisher's\n"
        "// own RSS snippet when one exists (anti-hallucination); open the source for more.\n"
        "// Images/links (when present) come from the publisher's native RSS feed.\n"
        "// Regenerate: python fetch_news.py --days 3 && python digest_news.py\n\n"
    )
    with open(args.out, "w", encoding="utf-8") as f:
        f.write(header + "export const mockNewsArticles = " +
                json.dumps(digested, ensure_ascii=False, indent=2) + ";\n")
    print(f"Wrote {len(digested)} digested items -> {args.out}")

    # Show a few before/after examples for review.
    print("\n--- sample before -> after ---")
    for it in digested[:4]:
        print("BEFORE:", by_id[it["id"]]["title"][:80])
        print("AFTER :", it["title"][:80])
        print("BODY  :", it["body"][:120])
        print()
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:  # noqa: BLE001
        print(f"digest failed: {type(e).__name__}: {e}", file=sys.stderr)
        sys.exit(1)
