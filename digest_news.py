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
import time
import urllib.error
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


def load_keys():
    """All configured Gemini keys, in order, deduped. Keys from DIFFERENT Google
    projects have SEPARATE quotas, so we fall back to the next one when one is rate-
    limited. (Keys from the SAME project share quota — no benefit.) Reads
    GEMINI_API_KEYS (comma-separated) and GEMINI_API_KEY / _2 / _3 / _4."""
    raw = []
    multi = env_val("GEMINI_API_KEYS")
    if multi:
        raw += multi.split(",")
    for name in ("GEMINI_API_KEY", "GEMINI_API_KEY_2", "GEMINI_API_KEY_3",
                 "GEMINI_API_KEY_4", "GOOGLE_API_KEY", "GEMINI_KEY"):
        v = env_val(name)
        if v:
            raw.append(v)
    out, seen = [], set()
    for k in (k.strip() for k in raw):
        if k and k not in seen:
            seen.add(k)
            out.append(k)
    return out


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


PROMPT = """You are a news editor for a Borneo sustainability news tracker. You are given a JSON list of news items from across Borneo: Sabah, Sarawak (Malaysia), Brunei, and Kalimantan (Indonesia). Each item has a "title". Many items also have "article" (the main text of the real article) or a shorter "snippet"; some have only the title.

For EACH item decide if it is genuinely about BORNEO SUSTAINABILITY, within these beats: fire & haze, deforestation & palm oil, floods & extreme weather, conservation & wildlife, sustainable policy / energy / development, or environmental governance.

Rules:
- DROP any item that is NOT Borneo sustainability: unrelated building/venue fires, general crime, sports, music/festivals, tourism promotion, celebrity, pure business/finance not tied to the environment, and any story that is actually about another country (e.g. a Turkish outlet's world news). When unsure, drop it.
- For KEPT items, produce a clear ENGLISH "title" and a "body" that reads like a real, complete news article:
    - If the item has "article": REPHRASE the whole article into our own English words — keep ALL the substantive information and roughly the original length; do NOT shorten it into a brief summary. REWORD everything in your own words (never copy sentences verbatim / near-verbatim). Write it as 2-4 short paragraphs separated by a blank line (\\n\\n). Skip navigation, "share this story", related-article lists, and comment boilerplate.
    - Else if it has "snippet": rephrase the snippet into 2-3 English sentences in your own words.
    - Else (title only): write 1-2 sentences that faithfully restate the headline.
- *** ANTI-HALLUCINATION ***: use ONLY facts present in THAT item's own article / snippet / title. Do NOT add or invent numbers, names, places, dates, causes, or outcomes. Translate Malay/Indonesian faithfully. Do NOT claim the news is verified or true.
- Return ONLY JSON: {"items": [{"id": "<same id>", "title": "<english title>", "body": "<english rephrase in our own words>"}]}. Omit every dropped item.

Items:
"""


def env_val(name):
    """Read a var from the environment or .env (never printed)."""
    if os.environ.get(name):
        return os.environ[name]
    envf = Path(".env")
    if envf.exists():
        for line in envf.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            if k.strip() == name:
                return v.strip().strip('"').strip("'")
    return None


def to_supabase_row(it):
    """Frontend camelCase item -> Supabase news_items row (snake_case). The LIVE
    pipeline inserts drafts only; a human approves via the dashboard, so status
    is always 'pending' here."""
    return {
        "id": it["id"],
        "title": it["title"],
        "body": it.get("body", ""),
        "image_url": it.get("imageUrl", ""),
        "beat": it.get("beat"),
        "beat_label": it.get("beatLabel"),
        "esg_pillar": it.get("esgPillar"),
        "sdg": it.get("sdg", []),
        "country": it.get("country"),
        "territories": it.get("territories", []),
        "sources": it.get("sources", []),
        "source_count": it.get("sourceCount", 1),
        "original_lang": it.get("originalLang"),
        "ai_generated": True,
        "status": "pending",
        "is_featured": False,
        "created_at": it.get("createdAt"),
        "published_at": None,
    }


def upsert_supabase(rows, base_url, service_key):
    """Insert new drafts into news_items via PostgREST. resolution=ignore-duplicates
    means an id that already exists is skipped — so re-runs never duplicate AND never
    reset an already-reviewed (published/rejected) row. Returns the HTTP status code."""
    endpoint = base_url.rstrip("/") + "/rest/v1/news_items"
    body = json.dumps(rows, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(endpoint, data=body, method="POST", headers={
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=ignore-duplicates,return=minimal",
    })
    with urllib.request.urlopen(req, timeout=60) as resp:
        return resp.status


# --- Usage controls (don't burn the Gemini quota) ----------------------------
CACHE_FILE = Path(".news_cache.json")


def load_cache():
    """id -> {title, body}  (a digested item) or the string 'dropped' (off-topic).
    Lets re-runs reuse prior results instead of re-calling Gemini."""
    try:
        return json.loads(CACHE_FILE.read_text(encoding="utf-8"))
    except Exception:  # noqa: BLE001
        return {}


def save_cache(cache):
    if len(cache) > 3000:                       # keep it from growing forever
        cache = dict(list(cache.items())[-3000:])
    try:
        CACHE_FILE.write_text(json.dumps(cache, ensure_ascii=False), encoding="utf-8")
    except Exception:  # noqa: BLE001
        pass


def existing_supabase_ids(base_url, service_key, ids):
    """Which of `ids` already exist in news_items — so we skip re-digesting them.
    One cheap REST call, never touches Gemini."""
    if not ids:
        return set()
    endpoint = base_url.rstrip("/") + "/rest/v1/news_items?select=id&limit=10000"
    req = urllib.request.Request(endpoint, headers={
        "apikey": service_key, "Authorization": f"Bearer {service_key}"})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            have = {r["id"] for r in json.load(resp)}
        return {i for i in ids if i in have}
    except Exception:  # noqa: BLE001
        return set()


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
    ap.add_argument("--local", action="store_true",
                    help="write the mockNews.js seed instead of Supabase, even if keys are set")
    ap.add_argument("--max-input", type=int, default=48,
                    help="cap items considered per run")
    ap.add_argument("--max-calls", type=int, default=25,
                    help="HARD cap on Gemini calls per run (safety against runaway usage)")
    ap.add_argument("--model", default="",
                    help="force a specific Gemini model (default: auto-pick the newest flash)")
    args = ap.parse_args()

    keys = load_keys()
    if not keys:
        print("No Gemini key in env or .env (looked for GEMINI_API_KEY). Skipping digest.", file=sys.stderr)
        return 0
    key_idx = {"i": 0}

    def current_key():
        return keys[key_idx["i"]]

    if len(keys) > 1:
        print(f"  {len(keys)} Gemini keys loaded — will fall back to the next on a rate-limit.")

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
        full_text = (r.get("full_text") or "").strip()
        is_native = "news.google.com" not in url
        if full_text:
            item["article"] = full_text[:3500]      # real article text -> a fuller summary
        elif is_native and body and body != r["title"]:
            item["snippet"] = body[:500]
        compact.append(item)

    # Prioritise items that have real article text (they get the fuller rephrase),
    # then cap the input so the number of AI calls stays under the free-tier limit.
    compact.sort(key=lambda x: 0 if "article" in x else 1)
    compact = compact[:args.max_input]

    # --- Usage controls: only digest items we haven't already handled ---
    # (a) Skip ids already stored in Supabase (production) — one cheap REST call.
    supa_url = env_val("SUPABASE_URL")
    supa_key = env_val("SUPABASE_SERVICE_KEY")
    if supa_url and supa_key and not args.local:
        already = existing_supabase_ids(supa_url, supa_key, [c["id"] for c in compact])
        if already:
            compact = [c for c in compact if c["id"] not in already]
            print(f"  skip: {len(already)} items already in Supabase (no AI call).")

    # (b) Reuse the local cache (prior digests / prior 'dropped' verdicts).
    cache = load_cache()
    kept, to_digest, n_reused = [], [], 0
    for c in compact:
        cached = cache.get(c["id"])
        if cached == "dropped":
            continue
        if isinstance(cached, dict):
            kept.append({"id": c["id"], **cached})
            n_reused += 1
        else:
            to_digest.append(c)
    if n_reused:
        print(f"  cache: reused {n_reused} previously-digested items (no AI call).")

    model = args.model or pick_model(current_key())
    print(f"Using model: {model}  |  {len(to_digest)} new items to digest "
          f"(hard cap {args.max_calls} calls)...")

    calls = {"n": 0}

    def digest_chunk(chunk):
        calls["n"] += 1
        payload = {
            "contents": [{"parts": [{"text": PROMPT + json.dumps(chunk, ensure_ascii=False)}]}],
            "generationConfig": {"responseMimeType": "application/json",
                                 "temperature": 0.2, "maxOutputTokens": 8192},
        }
        resp = http_json(f"{BASE}/models/{model}:generateContent?key={current_key()}", payload)
        text = resp["candidates"][0]["content"]["parts"][0]["text"]
        try:
            return json.loads(text).get("items", [])
        except json.JSONDecodeError:
            m = re.search(r"\{.*\}", text, re.DOTALL)
            return json.loads(m.group(0)).get("items", []) if m else []

    # HARD call budget + KEY-ROTATION + pacing. Full-article items -> small chunks
    # (long output); headline-only -> a few big calls. On 429/503 we switch to the
    # next key (a different project = its own quota), then fall back to a short wait.
    def run_batches(items, size, label):
        for j in range(0, len(items), size):
            if calls["n"] >= args.max_calls:
                print(f"  ! hit --max-calls={args.max_calls}; leaving the rest for next run.",
                      file=sys.stderr)
                return
            batch = items[j:j + size]
            got = None
            for attempt in range(len(keys) + 1):
                try:
                    got = digest_chunk(batch)
                    break
                except urllib.error.HTTPError as e:
                    if e.code in (429, 503):
                        if key_idx["i"] + 1 < len(keys):
                            key_idx["i"] += 1
                            print(f"  … {label}: HTTP {e.code}; switching to key #{key_idx['i'] + 1}",
                                  file=sys.stderr)
                            continue
                        if attempt < len(keys):
                            print(f"  … {label}: HTTP {e.code} on all keys; backing off 30s",
                                  file=sys.stderr)
                            time.sleep(30)
                            continue
                    print(f"  ! {label}: HTTP {e.code}", file=sys.stderr)
                    break
                except Exception as e:  # noqa: BLE001 — one bad batch must not lose the rest
                    print(f"  ! {label}: {type(e).__name__}", file=sys.stderr)
                    break
            if got is None:
                continue
            kept.extend(got)
            returned = {r["id"]: r for r in got if r.get("id")}
            for it in batch:                      # cache the result, or mark 'dropped'
                r = returned.get(it["id"])
                cache[it["id"]] = {"title": r["title"], "body": r["body"]} if r else "dropped"
            time.sleep(4.5)                        # pace under ~15 requests/min

    run_batches([c for c in to_digest if "article" in c], 4, "full")
    run_batches([c for c in to_digest if "article" not in c], 25, "short")
    save_cache(cache)

    print(f"Gemini calls this run: {calls['n']} (cap {args.max_calls}). Kept {len(kept)} items total.")

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

    # --- LIVE path: upsert drafts to Supabase, a human approves via the dashboard ---
    supa_url = env_val("SUPABASE_URL")
    supa_key = env_val("SUPABASE_SERVICE_KEY")
    if supa_url and supa_key and not args.local:
        rows = [to_supabase_row(it) for it in digested]
        try:
            code = upsert_supabase(rows, supa_url, supa_key)
        except Exception as e:  # noqa: BLE001
            print(f"Supabase upsert failed: {type(e).__name__}: {e}", file=sys.stderr)
            return 1
        print(f"Upserted {len(rows)} drafts (status=pending) to Supabase news_items [HTTP {code}].")
        print("Approve them in the Supabase Table Editor (set status=published).")
        return 0

    # --- LOCAL/demo path: write the mockNews.js seed ---
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
