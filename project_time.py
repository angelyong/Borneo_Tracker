"""Project calendar helpers for Borneo Tracker.

Dashboard data is published on the Malaysia civil calendar (UTC+08:00).  A
fixed offset is intentional: Malaysia does not observe daylight-saving time,
and this keeps bare-Python/Windows environments independent of the optional
IANA ``tzdata`` package.
"""

from datetime import datetime, timedelta, timezone


PROJECT_TIMEZONE = timezone(timedelta(hours=8), name="Asia/Kuala_Lumpur")


def project_now(instant=None):
    """Return an aware datetime on the Malaysia project calendar.

    ``instant`` is injectable for deterministic tests and must itself be
    timezone-aware so that an ambiguous local time can never enter the data
    pipeline.
    """
    if instant is None:
        return datetime.now(PROJECT_TIMEZONE)
    if instant.tzinfo is None or instant.utcoffset() is None:
        raise ValueError("instant must be a timezone-aware datetime")
    return instant.astimezone(PROJECT_TIMEZONE)


def project_today(instant=None):
    """Return the Malaysia project date, optionally for an injected instant."""
    return project_now(instant).date()


def project_today_iso(instant=None):
    """Return the Malaysia project date as ``YYYY-MM-DD``."""
    return project_today(instant).isoformat()
