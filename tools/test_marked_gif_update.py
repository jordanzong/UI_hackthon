#!/usr/bin/env python3
"""Safety-fixture tests; no synthetic result is published."""
import json
import tempfile
import unittest
import zipfile
from pathlib import Path
from update_marked_gifs import update

GIF = (b"GIF89a\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00\xff\xff\xff"
       b"!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00"
       b"\x00\x02\x02D\x01\x00;")

class TestMarkedUpdate(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name)
        self.out = self.root / "science-runs"
        self.run = self.out / "wise-0855" / "D1_gap10_spaninf_v1"
        self.run.mkdir(parents=True)
        self.manifest = {
            "target_id": "WISE_0855", "run_id": "D1_gap10_spaninf_v1",
            "band_id": "D1", "sources": [{"source_id": "1", "ra_deg": 1.2, "dec_deg": 3.4}],
            "candidates": [], "files_present": {"markers_json": False},
            "bands": {"D1": {"blink_url": "media/group_stacks_sources_epsf.gif",
                            "source_count": 1, "candidate_count": 0,
                            "seds": [{"source_id": "1", "plots": {"evolution": "sed.webp"}}]}}
        }
        self.index = {"targets": [
            {"target_id": "WISE_0855", "runs": [{"run_id": "D1_gap10_spaninf_v1",
              "band_id": "D1", "candidate_count": 0,
              "manifest_url": "wise-0855/D1_gap10_spaninf_v1/manifest.json"}]},
            {"target_id": "R_Draconis", "runs": []}]}
        (self.run / "manifest.json").write_text(json.dumps(self.manifest))
        (self.out / "index.json").write_text(json.dumps(self.index))
        self.archive = self.root / "archive.zip"

    def write_zip(self, include_gif=True, source="1"):
        with zipfile.ZipFile(self.archive, "w") as z:
            root = "output/WISE_0855/analysis_runs/D1_gap10_spaninf_v1/"
            if include_gif:
                z.writestr(root + "group_stacks_marked.gif", GIF)
            z.writestr(root + "source_catalog.ecsv", f"source_id ra_deg dec_deg\n{source} 1.2 3.4\n")
            z.writestr(root + "markers.json", '[{"source_id":1,"types":["mover"]}]')

    def test_preserves_photometry_and_updates_labels(self):
        self.write_zip()
        self.assertEqual(update(self.archive, self.out, targets=("WISE_0855",), per_target=1), 1)
        m = json.loads((self.run / "manifest.json").read_text())
        self.assertEqual(m["bands"]["D1"]["blink_url"], "media/group_stacks_marked.gif")
        self.assertEqual(m["bands"]["D1"]["gif_annotation"], "algorithm-candidates")
        self.assertEqual(m["sources"][0]["candidate_types"], ["mover"])
        self.assertEqual(m["bands"]["D1"]["seds"], self.manifest["bands"]["D1"]["seds"])
        self.assertEqual(m["sources"][0]["ra_deg"], 1.2)

    def test_rejects_missing_marked_gif(self):
        self.write_zip(include_gif=False)
        with self.assertRaisesRegex(ValueError, "Missing marked GIF"):
            update(self.archive, self.out, targets=("WISE_0855",), per_target=1)
        self.assertFalse((self.run / "media/group_stacks_marked.gif").exists())

    def test_rejects_changed_source_ids(self):
        self.write_zip(source="2")
        with self.assertRaisesRegex(ValueError, "Catalog Source IDs differ"):
            update(self.archive, self.out, targets=("WISE_0855",), per_target=1)
        self.assertFalse((self.run / "media/group_stacks_marked.gif").exists())

if __name__ == "__main__":
    unittest.main()
