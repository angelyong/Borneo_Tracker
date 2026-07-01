# Database Setup Repair Plan

This plan explains how to fix the remaining database setup problem in the Borneo Tracker handoff.

The goal is to make this handoff requirement reliable:

```bash
python load_db.py
```

Expected result:

- `borneo_tracker.db` is created or refreshed.
- The SQLite database is readable.
- The `indicators` table exists.
- The table contains valid project data.
- The command fails clearly if the database cannot be safely published.

---

## 1. Current Problem

The database setup is not stable yet.

Current observed state:

- `borneo_tracker.db` is `0` bytes.
- `borneo_tracker.snapshot.db` exists but is damaged.
- `borneo_tracker.next.db` is readable and contains valid `indicators` rows.
- `borneo_tracker.snapshot.next.db` is readable and contains valid `indicators` rows.
- The temporary runtime database can become stale or empty.

This means the project can still export JSON through fallback logic, but the handoff requirement `python load_db.py -> borneo_tracker.db` is not reliably satisfied.

---

## 2. Root Cause

The problem is not caused by `data_model.py`.

The data model can currently produce valid rows:

- Total processed rows: `145`
- No missing `territory`
- No missing `indicator`

The real problem is in the database setup and publish flow.

### Root Cause A: Old damaged DB is merged back into new data

Current `load_db.py` reads old DB rows before building the new database.

If the old DB is damaged, it can return invalid rows such as:

- `territory = 1`
- `indicator = None`

That invalid row is merged into the new dataset and later causes:

```text
sqlite3.IntegrityError: NOT NULL constraint failed: indicators.indicator
```

### Root Cause B: Publish step leaves good `.next.db` files but bad official files

The current publish flow creates `.next.db` files, but the final replace into `borneo_tracker.db` / `borneo_tracker.snapshot.db` is not reliable in the current machine environment.

Observed result:

- `.next.db` files are valid.
- Official DB files are empty or damaged.

### Root Cause C: Setup failure is hidden by warnings and fallback

`load_db.py` can print warnings and continue even when the official database was not safely published.

`export_json.py` can also fall back to model-generated rows, which keeps the frontend usable but hides the fact that the DB setup is unhealthy.

---

## 3. Required Fixes

### Fix 1: Stop merging old DB rows by default

File:

- `load_db.py`

Change:

- Remove the default dependency on old `borneo_tracker.db` / `borneo_tracker.snapshot.db`.
- Build the database directly from:
  - `borneo_tracker_poc.csv`
  - `manual_overrides.csv`
  - derived rows from `data_model.py`

Expected impact:

- Prevents damaged old DB rows from polluting the new database.
- Makes `load_db.py` deterministic.
- Aligns with the handoff expectation that the committed CSV can rebuild the DB.

---

### Fix 2: Add database validation before publishing

File:

- `load_db.py`

Add validation after building the temporary database:

Required checks:

- `PRAGMA quick_check` returns `ok`.
- `indicators` table exists.
- `SELECT COUNT(*) FROM indicators` is greater than `0`.
- No invalid key rows:

```sql
SELECT COUNT(*)
FROM indicators
WHERE territory IS NULL
   OR indicator IS NULL;
```

Expected impact:

- Prevents damaged or empty databases from being published.
- Makes failures visible immediately.

---

### Fix 3: Make `load_db.py` fail clearly if publish fails

File:

- `load_db.py`

Change:

- If `borneo_tracker.db` cannot be safely updated, `load_db.py` should exit with a non-zero status.
- The error message should clearly explain likely causes:
  - DB file is open in DBeaver
  - DB Browser for SQLite is using it
  - VS Code SQLite extension is using it
  - antivirus / sync / indexing tool is blocking it

Expected impact:

- Prevents false success.
- Makes handoff verification honest.
- Causes `run_pipeline.py` to stop if DB setup fails, which is correct.

---

### Fix 4: Stop manually deleting SQLite journal files

File:

- `load_db.py`

Change:

- Remove manual deletion of `*-journal` files from the publish function.
- Let SQLite manage its own journal files.

Expected impact:

- Reduces risk of half-written or inconsistent SQLite files.
- Avoids masking real file-state problems.

---

### Fix 5: Make JSON export fallback explicit

File:

- `export_json.py`

Change:

- Default mode should read only:
  1. `borneo_tracker.db`
  2. `borneo_tracker.snapshot.db`

- Model fallback should require an explicit flag, for example:

```bash
python export_json.py --allow-model-fallback
```

Expected impact:

- Normal mode proves the frontend JSON is coming from the DB.
- Fallback mode remains available for preview or recovery.
- DB setup failures are no longer silently hidden.

---

## 4. One-Time Local Cleanup

Before or after applying the code fix, the current local DB files need to be cleaned up carefully.

Important:

- Do not delete `borneo_tracker.next.db`.
- Do not delete `borneo_tracker.snapshot.next.db`.

These two files are currently the known readable DB copies.

Recommended cleanup steps:

1. Close any program that may be using the DB:
   - DBeaver
   - DB Browser for SQLite
   - VS Code SQLite extension
   - File preview tools

2. Move broken official files aside:
   - `borneo_tracker.db`
   - `borneo_tracker.snapshot.db`

3. Use a known good `.next.db` file as a recovery source if needed.

4. Clear stale runtime DB from the system temp directory if it exists:
   - `borneo_tracker.runtime.db`

5. Re-run:

```bash
python load_db.py
```

---

## 5. Validation Checklist

After implementation, run these checks.

### Check 1: DB setup

```bash
python load_db.py
```

Expected:

- Exit code is `0`.
- `borneo_tracker.db` exists.
- No warning-only fake success.

### Check 2: SQLite integrity

Expected:

- `PRAGMA quick_check` returns `ok`.
- `indicators` table exists.
- Row count is greater than `0`.
- No rows have missing `territory` or `indicator`.

### Check 3: JSON export

```bash
python export_json.py
```

Expected:

- `public/data/indicators.json` is written.
- JSON contains all 4 dashboard territories.
- JSON contains `fire_hotspots`.
- JSON contains confidence fields.

### Check 4: Repeatability

Run twice:

```bash
python load_db.py
python export_json.py
python load_db.py
python export_json.py
```

Expected:

- Both runs succeed.
- No damaged DB is created.
- No stale runtime DB is used as the normal source.

---

## 6. Expected Impact

This change should not affect:

- Frontend routing
- `useIndicators.js`
- Overview Dashboard display logic
- ESG page display logic
- Regional Detail display logic
- The JSON file location used by the frontend

This change will affect:

- `load_db.py` becomes stricter.
- `run_pipeline.py` will stop if DB setup fails.
- `export_json.py` will no longer silently hide DB setup failure unless fallback is explicitly enabled.

This is the intended behavior because database setup is a core handoff requirement.

---

## 7. Final Recommended Decision

Proceed with the repair.

The safest implementation strategy is:

1. Fix `load_db.py` first.
2. Validate DB creation.
3. Fix `export_json.py` fallback behavior.
4. Run the full validation checklist.
5. Only then consider the database setup handoff item complete.

