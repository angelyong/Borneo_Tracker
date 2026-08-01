"""Fail CI before ingestion when a required refresh credential is absent.

Only secret *names* are printed. Values are never logged.
"""

import os
import sys


REQUIRED_SECRETS = ("BPS_API_KEY", "GFW_API_KEY", "WAQI_TOKEN", "GDL_API_TOKEN")


def missing_required(env=None):
    env = os.environ if env is None else env
    return [name for name in REQUIRED_SECRETS if not str(env.get(name, "")).strip()]


def main():
    missing = missing_required()
    if missing:
        for name in missing:
            print(f"::error::Missing required GitHub Actions secret: {name}")
        return 1
    print("Required refresh secrets are configured (values not displayed).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
