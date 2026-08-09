import json
import tempfile
import unittest
from pathlib import Path
from json_artifacts import write_json_lf

class JsonArtifactTests(unittest.TestCase):
    def test_volatile_clock_is_a_byte_preserving_noop(self):
        with tempfile.TemporaryDirectory() as td:
            path=Path(td)/"artifact.json"
            self.assertTrue(write_json_lf(path,{"generatedAt":"2026-08-01","rows":[{"sourceDate":"2020"}]}))
            before=path.read_bytes()
            self.assertFalse(write_json_lf(path,{"generatedAt":"2026-08-02","rows":[{"sourceDate":"2020"}]}))
            self.assertEqual(before,path.read_bytes())
    def test_substantive_change_writes_new_bytes(self):
        with tempfile.TemporaryDirectory() as td:
            path=Path(td)/"artifact.json"; write_json_lf(path,{"generatedAt":"a","rows":[1]})
            self.assertTrue(write_json_lf(path,{"generatedAt":"b","rows":[2]}))
            self.assertEqual(json.loads(path.read_text())["rows"],[2])
if __name__=="__main__": unittest.main()
