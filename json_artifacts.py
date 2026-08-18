"""Cross-platform writer for published Borneo Tracker JSON artifacts.

The deployment manifest hashes file bytes, not parsed JSON.  On Windows the
default text writer translates ``\n`` to CRLF, while GitHub's Linux runner and
the production bundle use LF.  Keeping the published artifacts LF-only makes
the manifest a portable, verifiable claim across both environments.
"""

import json
from pathlib import Path
from typing import Any


def _without_volatile_generated_at(payload: Any) -> Any:
    """Only the artifact-level build clock is volatile; source dates remain data."""
    if not isinstance(payload, dict):
        return payload
    return {key: value for key, value in payload.items() if key != "generatedAt"}


def write_json_lf(path: Path, payload: Any, *, indent: int = 2) -> bool:
    """Serialize *payload* exactly like ``json.dumps(..., indent=2)`` with LF.

    No trailing newline is added because the historical published artifact
    contract did not include one.  ``newline='\n'`` is the important part: it
    prevents Windows from silently changing the bytes after hashing.
    """
    body = json.dumps(payload, indent=indent)
    # A daily run whose only delta is the generatedAt clock must preserve the
    # exact old bytes. Otherwise every refresh creates a needless new data
    # version and provenance entry despite unchanged substantive values.
    if path.exists():
        try:
            existing = json.loads(path.read_text(encoding="utf-8"))
            if _without_volatile_generated_at(existing) == _without_volatile_generated_at(payload):
                return False
        except (OSError, ValueError):
            pass
    path.write_text(body, encoding="utf-8", newline="\n")
    return True
