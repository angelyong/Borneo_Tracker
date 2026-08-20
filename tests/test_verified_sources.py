"""Contract and live smoke tests for newly verified public data sources.

The live tests intentionally use only keyless official endpoints. They verify
transport, schema and the exact filters used by the production ingestion code;
they do not assert that a publisher's latest value will never change.
"""

import csv
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import ingest_poc  # noqa: E402
import data_model  # noqa: E402
import compute_resilience  # noqa: E402
import validate_data  # noqa: E402
import ingest_districts  # noqa: E402
import check_required_secrets  # noqa: E402
import project_time  # noqa: E402

from datetime import date, datetime, timezone  # noqa: E402


class VerifiedSourceLiveTests(unittest.TestCase):
    def test_dosm_population_csv_has_state_totals(self):
        text = ingest_poc.get_text(
            "https://storage.dosm.gov.my/population/population_state.csv",
            timeout=180,
        )
        records = list(csv.DictReader(text.splitlines()))
        selected = [
            record for record in records
            if record.get("state") in {"Sabah", "Sarawak"}
            and record.get("sex") == "both"
            and record.get("age") == "overall"
            and record.get("ethnicity") == "overall"
        ]
        self.assertEqual({record["state"] for record in selected}, {"Sabah", "Sarawak"})
        self.assertTrue(all(float(record["population"]) > 0 for record in selected))
        self.assertIn("2022", {record["date"][:4] for record in selected})

    def test_dosm_amenities_api_has_scoreable_electricity_percent(self):
        records = ingest_poc.get_json(
            "https://api.data.gov.my/data-catalogue/?id=hh_access_amenities&limit=20000",
            timeout=120,
        )
        values = {
            record["state"]: float(record["electricity"])
            for record in records
            if record.get("state") in {"Sabah", "Sarawak"}
            and record.get("district") == "All Districts"
            and record.get("electricity") is not None
        }
        self.assertEqual(set(values), {"Sabah", "Sarawak"})
        self.assertTrue(all(0 <= value <= 100 for value in values.values()))

    def test_world_bank_brunei_population_and_internet(self):
        for indicator in ("SP.POP.TOTL", "IT.NET.USER.ZS"):
            payload = ingest_poc.get_json(
                "https://api.worldbank.org/v2/country/brn/indicator/"
                f"{indicator}?format=json&mrv=5",
                timeout=120,
            )
            observations = [row for row in (payload[1] or []) if row.get("value") is not None]
            self.assertTrue(observations, indicator)

    def test_firms_csv_records_can_be_spatially_partitioned(self):
        # CI must verify our parsing/bounding-box/geometry contract without
        # depending on NASA's transient network availability. The refresh-data
        # workflow remains the live-source check and retains the last good data
        # if FIRMS is unavailable.
        text = """latitude,longitude,acq_date
5.980,116.073,2026-08-21
1.550,110.350,2026-08-21
-0.500,117.150,2026-08-21
3.120,113.030,2026-08-21
"""
        records = [record for record in ingest_poc._firms_parse(text) if ingest_poc._in_borneo(record)]
        self.assertTrue(records)
        counts, unmatched = ingest_poc._firms_partition(records)
        self.assertGreaterEqual((len(records) - unmatched) / len(records), 0.95)
        self.assertTrue(any(name.startswith("Kalimantan ") for name in counts))


class PipelineSemanticsTests(unittest.TestCase):
    def test_project_date_uses_malaysia_calendar_at_utc_boundary(self):
        instant = datetime(2026, 8, 1, 18, 24, tzinfo=timezone.utc)
        self.assertEqual(project_time.project_today(instant), date(2026, 8, 2))
        self.assertEqual(project_time.project_today_iso(instant), "2026-08-02")
        with self.assertRaises(ValueError):
            project_time.project_today(datetime(2026, 8, 1, 18, 24))

    def test_artifact_freshness_uses_project_date_and_rejects_real_future(self):
        instant = datetime(2026, 8, 1, 18, 24, tzinfo=timezone.utc)
        malaysia_today = project_time.project_today(instant)

        current = validate_data.Report()
        validate_data.check_artifact_freshness(
            current, "fixture", {"generatedAt": "2026-08-02"}, today=malaysia_today
        )
        self.assertEqual(current.failed, 0)

        future = validate_data.Report()
        validate_data.check_artifact_freshness(
            future, "fixture", {"generatedAt": "2026-08-03"}, today=malaysia_today
        )
        self.assertEqual(future.failed, 1)

    def test_domestic_electrification_fallback_is_scoreable(self):
        score = compute_resilience.score_value(
            "Domestic electrification ratio", "%", 99.4
        )
        self.assertIsNotNone(score)
        self.assertGreater(score, 98)

    def test_validation_detects_excessive_stale_rows(self):
        report = validate_data.Report()
        rows = [
            {"source": "fresh"},
            {"source": "STALE — retained from previous successful run"},
        ]
        validate_data.check_stale_ratio(report, "fixture", "stale ceiling", rows)
        self.assertEqual(report.failed, 1)

    def test_stale_freshness_boundary_and_invalid_date(self):
        today = date(2026, 8, 2)
        for last_updated, expected_failures in (
            ("2026-06-19", 0),  # 44 days
            ("2026-06-17", 1),  # 46 days
            ("not-a-date", 1),
            ("", 1),
        ):
            with self.subTest(last_updated=last_updated):
                report = validate_data.Report()
                validate_data.check_stale_freshness(
                    report,
                    "fixture",
                    [{"territory": "Sabah", "indicator": "Population",
                      "source": "STALE — fixture", "last_updated": last_updated}],
                    today=today,
                )
                self.assertEqual(report.failed, expected_failures)

    def test_artifact_freshness_boundary(self):
        today = date(2026, 8, 2)
        for generated_at, expected_failures in (
            ("2026-06-19", 0),  # 44 days
            ("2026-06-17", 1),  # 46 days
            ("bad-date", 1),
            ("2026-08-03", 1),  # future timestamps are also invalid
        ):
            with self.subTest(generated_at=generated_at):
                report = validate_data.Report()
                validate_data.check_artifact_freshness(
                    report, "fixture", {"generatedAt": generated_at}, today=today
                )
                self.assertEqual(report.failed, expected_failures)

    def test_volatile_live_rows_are_not_retained(self):
        current = []
        previous = [
            {"territory": "Sabah", "indicator": indicator, "year": "2026",
             "value": "1", "unit": "count", "source": "fixture",
             "data_level": "state", "last_updated": "2026-08-01"}
            for indicator in ingest_poc.VOLATILE_INDICATORS
        ]
        retained = ingest_poc.retain_last_good(current, previous)
        self.assertEqual(retained, 0)
        self.assertEqual(current, [])

    def test_repeated_stale_retention_preserves_last_success_date(self):
        previous = [{
            "territory": "Kalimantan Barat", "indicator": "Poverty rate (P0)",
            "year": "2025", "value": "6.1", "unit": "%",
            "source": "STALE — prior outage", "data_level": "province",
            "last_updated": "2026-07-20",
        }]
        current = []
        ingest_poc.retain_last_good(current, previous)
        self.assertEqual(current[0]["last_updated"], "2026-07-20")

    def test_district_legacy_date_uses_artifact_generation_date(self):
        legacy = {"year": "2022", "last_updated": "2022"}
        self.assertEqual(
            ingest_districts.last_success_date(legacy, "2026-07-10T05:00:00Z"),
            "2026-07-10",
        )

    def test_required_secret_preflight(self):
        complete = {name: "configured" for name in check_required_secrets.REQUIRED_SECRETS}
        self.assertEqual(check_required_secrets.missing_required(complete), [])
        for missing_name in check_required_secrets.REQUIRED_SECRETS:
            with self.subTest(missing_name=missing_name):
                env = dict(complete)
                env[missing_name] = ""
                self.assertEqual(check_required_secrets.missing_required(env), [missing_name])

    def test_source_outage_retains_last_good_and_marks_stale(self):
        current = [{
            "territory": "Sabah", "indicator": "Population", "year": "2026",
            "value": "1", "unit": "people", "source": "fresh", "data_level": "state",
        }]
        previous = [
            dict(current[0]),
            {
                "territory": "Kalimantan Barat", "indicator": "Poverty rate (P0)",
                "year": "2025", "value": "6.1", "unit": "%", "source": "BPS",
                "data_level": "province",
            },
        ]
        retained = ingest_poc.retain_last_good(current, previous)
        self.assertEqual(retained, 1)
        stale = next(row for row in current if row["territory"] == "Kalimantan Barat")
        self.assertTrue(stale["source"].startswith("STALE —"))

    def test_reviewed_esdm_snapshot_is_complete_and_weighted(self):
        rows = []
        ingest_poc.pull_verified_reference_data(rows)
        provinces = [
            row for row in rows
            if row["territory"].startswith("Kalimantan ")
            and row["indicator"] == "Electrification ratio"
        ]
        aggregate = [
            row for row in rows
            if row["territory"] == "Kalimantan"
            and row["indicator"] == "Electrification ratio"
        ]
        self.assertEqual(len(provinces), 5)
        self.assertEqual(len(aggregate), 1)
        self.assertAlmostEqual(float(aggregate[0]["value"]), 99.65, places=2)
        self.assertIn("household-weighted", aggregate[0]["source"])

        population = next(
            row for row in rows
            if row["territory"] == "Kalimantan" and row["indicator"] == "Population"
        )
        self.assertEqual(float(population["value"]), 17_951_300)
        self.assertEqual(population["year"], "2025")

    def test_food_per_capita_uses_latest_population_and_discloses_years(self):
        rows = [
            data_model.build_processed_row({
                "territory": "Sabah", "indicator": "Crop production (paddy)",
                "year": "2022", "value": "1000", "unit": "tonnes",
                "source": "fixture", "data_level": "state",
            }),
            data_model.build_processed_row({
                "territory": "Sabah", "indicator": "Population",
                "year": "2022", "value": "100000", "unit": "people",
                "source": "fixture 2022", "data_level": "state",
            }),
            data_model.build_processed_row({
                "territory": "Sabah", "indicator": "Population",
                "year": "2026", "value": "200000", "unit": "people",
                "source": "fixture 2026", "data_level": "state",
            }),
        ]
        derived = data_model.build_percapita_food_rows(rows)
        sabah = next(row for row in derived if row["territory"] == "Sabah")
        self.assertEqual(sabah["value"], 5.0)
        self.assertIn("2022", sabah["source"])
        self.assertIn("2026", sabah["source"])
        self.assertIn("current resident", sabah["source"])


if __name__ == "__main__":
    unittest.main()
