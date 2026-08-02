"""Cross-platform writer for published Borneo Tracker JSON artifacts.

The deployment manifest hashes file bytes, not parsed JSON.  On Windows the
default text writer translates ``\n`` to CRLF, while GitHub's Linux runner and
the production bundle use LF.  Keeping the published artifacts LF-only makes
the manifest a portable, verifiable claim across both environments.
"""

import json
from pathlib import Path
from typing import Any


def write_json_lf(path: Path, payload: Any, *, indent: int = 2) -> None:
    """Serialize *payload* exactly like ``json.dumps(..., indent=2)`` with LF.

    No trailing newline is added because the historical published artifact
    contract did not include one.  ``newline='\n'`` is the important part: it
    prevents Windows from silently changing the bytes after hashing.
    """
    path.write_text(json.dumps(payload, indent=indent), encoding="utf-8", newline="\n")
