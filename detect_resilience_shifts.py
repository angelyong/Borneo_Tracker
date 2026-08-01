"""
Borneo Tracker — resilience shift watch (loop engineering).

WHY THIS EXISTS
    validate_data.py is the HARD gate: it fails the refresh when data is BROKEN
    (record counts collapse, generatedAt goes backwards). But the Resilience Index
    can move a lot WITHIN perfectly valid data — a pillar drops, a RAG band flips,
    the weakest pillar changes — and today that lands SILENTLY: the dashboard quietly
    tells a different story and nobody is told. That is an open loop that never
    closes. This watch closes it: after each refresh it diffs the new resilience.json
    against the previous committed one and surfaces the NOTABLE shifts loudly
    (GitHub Actions run summary + ::warning:: annotations).

    It is INFORMATIONAL and never fails the run — a real-world drop is legitimate;
    the point is that a human eyeballs the dashboard when the story moves. The hard
    gate stays validate_data.py.

USAGE
    python detect_resilience_shifts.py   (run by .github/workflows/resilience-watch.yml)
"""

import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).parent
RESILIENCE = "public/data/resilience.json"

# A move at/above these (0-100 scale) is worth a human's eye.
INDEX_SHIFT = 5.0
PILLAR_SHIFT = 8.0


def git_show_json(ref):
    result = subprocess.run(
        ["git", "show", f"{ref}:{RESILIENCE}"], cwd=str(ROOT), capture_output=True
    )
    if result.returncode != 0:
        return None
    try:
        return json.loads(result.stdout.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError):
        return None


def last_two_versions():
    """The two most recent COMMITTED resilience.json versions as (cur, prev).
    Either may be None (first run / unreadable)."""
    result = subprocess.run(
        ["git", "log", "-2", "--format=%H", "--", RESILIENCE],
        cwd=str(ROOT), capture_output=True,
    )
    hashes = result.stdout.decode().split()
    cur = git_show_json(hashes[0]) if len(hashes) >= 1 else None
    prev = git_show_json(hashes[1]) if len(hashes) >= 2 else None
    return cur, prev


def compare(prev, cur):
    """Pure diff of two resilience.json dicts. Returns (lines, warnings, notable):
    `lines` feed the run summary; `warnings` is a list of (title, message) for
    ::warning:: annotations; `notable` is the count of flagged shifts."""
    lines, warnings, notable = [], [], 0

    def flag(line, title, msg):
        nonlocal notable
        notable += 1
        lines.append(line)
        warnings.append((title, msg))

    cur_gen, prev_gen = cur.get("generatedAt"), prev.get("generatedAt")
    if cur_gen and prev_gen and cur_gen == prev_gen:
        flag(
            f"- ⚠ **stale**: generatedAt did not advance (still {cur_gen})",
            "Resilience data did not advance",
            f"generatedAt is still {cur_gen} — the refresh may not have produced new data.",
        )

    ct = cur.get("territories") or {}
    pt = prev.get("territories") or {}
    for terr in sorted(ct):
        c, p = ct[terr], pt.get(terr)
        if not p:
            lines.append(f"- ℹ **{terr}**: new territory")
            continue

        ci, pi = c.get("index"), p.get("index")
        if isinstance(ci, (int, float)) and isinstance(pi, (int, float)) and abs(ci - pi) >= INDEX_SHIFT:
            flag(
                f"- ⚠ **{terr}** Resilience Index {pi} → {ci} (**{ci - pi:+.1f}**)",
                f"{terr} Resilience Index moved", f"{pi} → {ci} ({ci - pi:+.1f})",
            )
        if c.get("rag") != p.get("rag"):
            flag(
                f"- ⚠ **{terr}** RAG band {p.get('rag')} → {c.get('rag')}",
                f"{terr} RAG band changed", f"{p.get('rag')} → {c.get('rag')}",
            )
        if c.get("weakestPillar") != p.get("weakestPillar"):
            flag(
                f"- ⚠ **{terr}** weakest pillar {p.get('weakestPillar')} → {c.get('weakestPillar')}",
                f"{terr} weakest pillar changed",
                f"{p.get('weakestPillar')} → {c.get('weakestPillar')}",
            )

        cs = c.get("pillarScores") or {}
        ps = p.get("pillarScores") or {}
        for pillar in sorted(cs):
            a, b = cs.get(pillar), ps.get(pillar)
            if isinstance(a, (int, float)) and isinstance(b, (int, float)) and abs(a - b) >= PILLAR_SHIFT:
                flag(
                    f"  - {terr} · {pillar}: {b} → {a} (**{a - b:+.1f}**)",
                    f"{terr} — {pillar} pillar moved", f"{b} → {a} ({a - b:+.1f})",
                )

    return lines, warnings, notable


def emit_summary(text):
    print(text)
    summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary_path:
        try:
            with open(summary_path, "a", encoding="utf-8") as handle:
                handle.write(text + "\n")
        except OSError:
            pass


def main():
    # stdout may be a non-UTF-8 console (e.g. Windows cp1252); keep the Unicode
    # summary/annotations from crashing the run. GITHUB_STEP_SUMMARY is always UTF-8.
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass
    cur, prev = last_two_versions()
    if cur is None:
        emit_summary("resilience.json not found / unreadable — nothing to check.")
        return 0
    if prev is None:
        emit_summary("## Resilience shift watch\n\nNo prior committed resilience.json to compare (first run).")
        return 0

    lines, warnings, notable = compare(prev, cur)
    header = [
        "## Resilience shift watch", "",
        f"comparing `{prev.get('generatedAt')}` → `{cur.get('generatedAt')}`", "",
    ]
    if notable:
        header += [f"**{notable} notable shift(s) — eyeball the dashboard.**", ""]
    else:
        lines = [
            f"✅ No notable shifts (index moves < {INDEX_SHIFT:.0f}, "
            f"pillar moves < {PILLAR_SHIFT:.0f}, no RAG/weakest changes)."
        ]
    emit_summary("\n".join(header + lines))
    for title, msg in warnings:
        print(f"::warning title={title}::{msg}")
    return 0  # informational — the hard gate is validate_data.py


if __name__ == "__main__":
    sys.exit(main())
