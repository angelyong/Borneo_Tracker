"""Offline contract tests for public/data/resilience_model.json (Impact
Simulator IS-1A — see docs/IMPACT_SIMULATOR_SPEC.md §2).

These are hermetic: no sqlite DB and no network. `build_model()` only ever
consumes `compute()`'s own return value, so a small synthetic row set is
enough to exercise it — the one test that must see REAL numbers
(`test_baseline_matches_committed_resilience_json`) reads the committed
public/data/resilience.json directly instead of trying to regenerate it.
"""

import json
import math
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import compute_resilience as cr  # noqa: E402

RESILIENCE_JSON = ROOT / "public" / "data" / "resilience.json"

# Covers: a multi-indicator pillar (Sabah/Shelter), an indicator observed under
# one pillar in one territory and never in another (exercises the
# indicatorToPillar merge), a "cross-pillar wellbeing rate" BOUNDS entry
# (Poverty rate (absolute), which has no fixed data_model.hexagon_pillar()
# concept) actually observed on a row, a unit mismatch that must NOT score,
# and a territory with zero scorable rows (Kalimantan) to exercise the
# unscored-territory / null-baseline path.
SAMPLE_ROWS = [
    {"territory": "Sabah", "indicator": "Life expectancy", "value": 75.3, "unit": "years",
     "hexagon_pillar": "Healthcare", "confidence": "manual", "source": "Test A",
     "year": "2024", "last_updated": "2026-08-05"},
    {"territory": "Sabah", "indicator": "Electricity access", "value": 99.25, "unit": "%",
     "hexagon_pillar": "Energy", "confidence": "high", "source": "Test A",
     "year": "2024", "last_updated": "2026-08-05"},
    {"territory": "Sabah", "indicator": "Clean water access", "value": 80.5, "unit": "%",
     "hexagon_pillar": "Shelter", "confidence": "high", "source": "Test A",
     "year": "2022", "last_updated": "2026-08-05"},
    {"territory": "Sabah", "indicator": "Basic sanitation access", "value": 90.0, "unit": "%",
     "hexagon_pillar": "Shelter", "confidence": "high", "source": "Test A",
     "year": "2022", "last_updated": "2026-08-05"},
    {"territory": "Sabah", "indicator": "Paddy production per capita", "value": 28.6,
     "unit": "kg/capita", "hexagon_pillar": "Food", "confidence": "medium", "source": "Test A",
     "year": "2022", "last_updated": "2026-08-05"},
    # Unit mismatch — same indicator name as above, wrong unit -> must not score.
    {"territory": "Sabah", "indicator": "Paddy production per capita", "value": 4000,
     "unit": "tonnes", "hexagon_pillar": "Food", "confidence": "medium", "source": "Test A",
     "year": "2022", "last_updated": "2026-08-05"},
    {"territory": "Sarawak", "indicator": "Life expectancy", "value": 75.4, "unit": "years",
     "hexagon_pillar": "Healthcare", "confidence": "manual", "source": "Test A",
     "year": "2024", "last_updated": "2026-08-05"},
    {"territory": "Brunei", "indicator": "Poverty rate (absolute)", "value": 5.0, "unit": "%",
     "hexagon_pillar": "Shelter", "confidence": "high", "source": "Test A",
     "year": "2024", "last_updated": "2026-08-05"},
    # Kalimantan: no canonical rows at all this run.
]


def _load_committed_resilience_json():
    return json.loads(RESILIENCE_JSON.read_text(encoding="utf-8"))


def _assert_no_nan_or_inf(testcase, value, path="root"):
    if isinstance(value, float):
        testcase.assertFalse(math.isnan(value), f"NaN at {path}")
        testcase.assertFalse(math.isinf(value), f"Infinity at {path}")
    elif isinstance(value, dict):
        for key, sub in value.items():
            _assert_no_nan_or_inf(testcase, sub, f"{path}.{key}")
    elif isinstance(value, list):
        for index, sub in enumerate(value):
            _assert_no_nan_or_inf(testcase, sub, f"{path}[{index}]")


class ResilienceModelExportTests(unittest.TestCase):
    def setUp(self):
        self.scores = cr.compute(SAMPLE_ROWS)
        self.model = cr.build_model(self.scores)

    # 1. Required top-level fields ------------------------------------------------
    def test_required_top_level_fields(self):
        for field in ("schemaVersion", "generatedAt", "pillars", "bounds",
                      "indicatorToPillar", "scoring", "index", "baseline"):
            self.assertIn(field, self.model)
        self.assertEqual(self.model["schemaVersion"], cr.MODEL_SCHEMA_VERSION)
        self.assertIsInstance(self.model["schemaVersion"], int)
        self.assertEqual(self.model["generatedAt"], cr.TODAY)

    # 2. Six pillars in canonical order -------------------------------------------
    def test_pillars_canonical_order(self):
        self.assertEqual(
            self.model["pillars"],
            ["Food", "Energy", "Education", "Shelter", "Healthcare", "Entertainment"],
        )
        self.assertEqual(self.model["pillars"], cr.PILLARS)

    # 3. Exact BOUNDS export --------------------------------------------------------
    def test_bounds_export_matches_source_table_exactly(self):
        self.assertEqual(self.model["bounds"], cr.BOUNDS)
        for indicator, spec in self.model["bounds"].items():
            self.assertEqual(set(spec), {"unit", "best", "worst"})

    # 4. Mapping completeness -------------------------------------------------------
    def test_indicator_to_pillar_covers_every_scored_indicator(self):
        mapping = self.model["indicatorToPillar"]
        for value in mapping.values():
            self.assertIn(value, cr.PILLARS)
        # Every indicator that actually produced a baseline input must resolve.
        for territory_data in self.model["baseline"].values():
            for indicator, detail in territory_data["inputs"].items():
                self.assertIn(indicator, mapping, f"{indicator} scored but missing from indicatorToPillar")
                self.assertEqual(mapping[indicator], detail["pillar"])
        # Cross-checked against this run's actual observations: Sabah's four
        # scored indicators plus Poverty rate (absolute), observed on Brunei's
        # row despite having no data_model.hexagon_pillar() concept.
        self.assertEqual(mapping["Life expectancy"], "Healthcare")
        self.assertEqual(mapping["Electricity access"], "Energy")
        self.assertEqual(mapping["Clean water access"], "Shelter")
        self.assertEqual(mapping["Basic sanitation access"], "Shelter")
        self.assertEqual(mapping["Paddy production per capita"], "Food")
        self.assertEqual(mapping["Poverty rate (absolute)"], "Shelter")
        # A BOUNDS indicator with a real hexagon_pillar() concept but no row
        # this run still resolves via the static fallback.
        self.assertEqual(mapping["Adult literacy"], "Education")

    def test_indicator_to_pillar_never_disagrees_with_hexagon_pillar_concept(self):
        for indicator, pillar in self.model["indicatorToPillar"].items():
            concept_pillar = cr.hexagon_pillar(indicator)
            if concept_pillar:
                self.assertEqual(
                    pillar, concept_pillar,
                    f"{indicator}: observed pillar {pillar!r} disagrees with "
                    f"data_model.hexagon_pillar() {concept_pillar!r}",
                )

    # 5. All four territories --------------------------------------------------------
    def test_all_four_territories_present_in_baseline(self):
        self.assertEqual(set(self.model["baseline"]), set(cr.DASHBOARD_TERRITORIES))

    # 6. Baseline outputs matching resilience.json (the anti-drift gate) -------------
    def test_baseline_reuses_compute_output_verbatim(self):
        for territory, data in self.scores.items():
            entry = self.model["baseline"][territory]
            self.assertEqual(entry["pillarScores"], data["pillarScores"])
            self.assertEqual(entry["index"], data["index"])
            self.assertEqual(entry["indexStrict"], data["indexStrict"])
            self.assertEqual(entry["rag"], data["rag"])
            self.assertEqual(entry["ragStrict"], data["ragStrict"])
            self.assertEqual(entry["weakestPillar"], data["weakestPillar"])
            self.assertEqual(sorted(entry["scoredPillars"]), sorted(data["scoredPillars"]))
            self.assertEqual(sorted(entry["unscoredPillars"]), sorted(data["unscoredPillars"]))

    def test_baseline_matches_committed_resilience_json(self):
        """The real anti-lie gate: feed build_model() a `scores` reconstructed
        from the CURRENTLY COMMITTED public/data/resilience.json (same shape
        compute() returns) and assert the baseline it emits reproduces those
        exact index/indexStrict/pillarScores/rag/weakestPillar values, for all
        four territories. This is what protects the Simulator from silently
        showing different numbers than the real dashboard."""
        committed = _load_committed_resilience_json()
        committed_scores = committed["territories"]
        model = cr.build_model(committed_scores)

        self.assertEqual(set(model["baseline"]), set(cr.DASHBOARD_TERRITORIES))
        for territory in cr.DASHBOARD_TERRITORIES:
            committed_entry = committed_scores[territory]
            model_entry = model["baseline"][territory]
            self.assertEqual(model_entry["index"], committed_entry["index"], territory)
            self.assertEqual(model_entry["indexStrict"], committed_entry["indexStrict"], territory)
            self.assertEqual(model_entry["rag"], committed_entry["rag"], territory)
            self.assertEqual(model_entry["ragStrict"], committed_entry["ragStrict"], territory)
            self.assertEqual(model_entry["weakestPillar"], committed_entry["weakestPillar"], territory)
            self.assertEqual(model_entry["pillarScores"], committed_entry["pillarScores"], territory)

    # 7. Unit preservation -------------------------------------------------------------
    def test_baseline_inputs_preserve_original_units(self):
        sabah_inputs = self.model["baseline"]["Sabah"]["inputs"]
        self.assertEqual(sabah_inputs["Life expectancy"]["unit"], "years")
        self.assertEqual(sabah_inputs["Electricity access"]["unit"], "%")
        self.assertEqual(sabah_inputs["Paddy production per capita"]["unit"], "kg/capita")
        # The unit-mismatched duplicate row must not have overwritten the
        # scored one, and must not appear at all under a foreign unit.
        self.assertEqual(sabah_inputs["Paddy production per capita"]["value"], 28.6)

    def test_unit_mismatched_row_is_excluded_not_imputed(self):
        # SAMPLE_ROWS includes a second "Paddy production per capita" row in
        # tonnes; only the kg/capita one may surface.
        sabah_inputs = self.model["baseline"]["Sabah"]["inputs"]
        self.assertEqual(sabah_inputs["Paddy production per capita"]["unit"], "kg/capita")
        self.assertNotEqual(sabah_inputs["Paddy production per capita"]["value"], 4000)

    # 8. No NaN / Infinity ---------------------------------------------------------------
    def test_no_nan_or_infinity_anywhere_in_model(self):
        _assert_no_nan_or_inf(self, self.model)

    def test_model_is_json_serializable_round_trips_cleanly(self):
        encoded = json.dumps(self.model)
        decoded = json.loads(encoded)
        self.assertEqual(decoded["baseline"]["Sabah"]["index"], self.model["baseline"]["Sabah"]["index"])

    # 9. Deterministic output -------------------------------------------------------------
    def test_build_model_is_deterministic_for_the_same_input(self):
        first = cr.build_model(cr.compute(SAMPLE_ROWS))
        second = cr.build_model(cr.compute(SAMPLE_ROWS))
        self.assertEqual(json.dumps(first, sort_keys=True), json.dumps(second, sort_keys=True))

    # Unscored territory (Kalimantan has no rows this run) -------------------------------
    def test_unscored_territory_has_null_index_and_empty_inputs(self):
        kalimantan = self.model["baseline"]["Kalimantan"]
        self.assertEqual(kalimantan["inputs"], {})
        self.assertEqual(kalimantan["pillarScores"], {})
        self.assertIsNone(kalimantan["index"])
        self.assertIsNone(kalimantan["indexStrict"])
        self.assertIsNone(kalimantan["rag"])
        self.assertIsNone(kalimantan["weakestPillar"])
        self.assertEqual(sorted(kalimantan["unscoredPillars"]), sorted(cr.PILLARS))

    # write_json_lf integration -----------------------------------------------------------
    def test_write_json_lf_round_trips_the_model(self):
        from json_artifacts import write_json_lf

        scratch = ROOT / ".tmp_tests" / "test_resilience_model_export"
        scratch.mkdir(parents=True, exist_ok=True)
        output = scratch / "resilience_model.json"
        if output.exists():
            output.unlink()
        try:
            write_json_lf(output, self.model)
            raw = output.read_bytes()
            self.assertNotIn(b"\r\n", raw)
            self.assertEqual(json.loads(raw.decode("utf-8")), self.model)
        finally:
            if output.exists():
                output.unlink()


if __name__ == "__main__":
    unittest.main()
