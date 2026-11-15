#!/usr/bin/env python3
"""Synthetic fixture tests only; do not publish fixture data as real science."""
import base64
import json
import tempfile
import unittest
from pathlib import Path

from build_science_run_manifests import build, BANDS

PNG_1PX = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aNksAAAAASUVORK5CYII=")
GIF_1PX = base64.b64decode("R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==")


class ScienceRunExportTest(unittest.TestCase):
    def test_scoped_manifest_and_missing_targets(self):
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            root = base / "targets"
            run = root / "Barnards_Star" / "analysis_runs" / "D1_gap10_spaninf_v1"
            run.mkdir(parents=True)
            (run / "source_catalog.ecsv").write_text(
                "# %ECSV 1.0\nsource_id ra_deg dec_deg best_snr n_groups_detected\n"
                "1 269.4520 4.6933 14.1 3\n", encoding="utf-8")
            (run / "markers.json").write_text(
                json.dumps([{"source_id": 1, "types": ["mover"], "pm": 6.7,
                             "pm_sig": 5.9, "n_groups": 4}]))
            (run / "group_stacks_marked.gif").write_bytes(GIF_1PX)
            (run / "sed_plots").mkdir()
            (run / "sed_plots" / "source_001_group_sed.png").write_bytes(PNG_1PX)
            (run / "sed_plots" / "source_001_sed_evolution.png").write_bytes(PNG_1PX)
            out = base / "publish"
            index = build(root, out, extract_gif=False)
            self.assertEqual(len(index["targets"]), 5)
            self.assertEqual(len(index["bands"]), 9)
            barnard = next(t for t in index["targets"] if t["target_id"] == "Barnards_Star")
            self.assertEqual(len(barnard["runs"]), 1)
            self.assertEqual(barnard["runs"][0]["band_id"], "D1")
            self.assertEqual(barnard["runs"][0]["run_id"], "D1_gap10_spaninf_v1")
            self.assertEqual(barnard["runs"][0]["sed_count"], 1)
            self.assertEqual(sum(len(t["runs"]) for t in index["targets"]), 1)
            manifest = json.loads((out / barnard["runs"][0]["manifest_url"]).read_text())
            self.assertEqual(manifest["target_id"], "Barnards_Star")
            self.assertEqual(manifest["run_id"], "D1_gap10_spaninf_v1")
            self.assertEqual(manifest["sources"][0]["candidate_types"], ["mover"])
            self.assertEqual(manifest["sources"][0]["candidate_status"],
                             "algorithm_candidate_unverified")
            self.assertEqual(manifest["bands"]["D1"]["blink_url"],
                             "media/group_stacks_marked.gif")
            plots = manifest["bands"]["D1"]["seds"][0]["plots"]
            self.assertIn("groups", plots)
            self.assertIn("evolution", plots)
            self.assertTrue((out / "barnards-star" / "D1_gap10_spaninf_v1" /
                             "media" / "sed_plots" / "source_001_group_sed.png").is_file())
            self.assertEqual(next(t for t in index["targets"]
                                  if t["target_id"] == "WISE_0855")["runs"], [])

    def test_multiple_run_parameters_no_cross_contamination(self):
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            target = base / "targets" / "WISE_0855" / "analysis_runs"
            for run_id in ["D1_gap10_spaninf_v1", "D1_gap2_span5_v2",
                           "D1_D2_D3_gap10_spaninf_v1"]:
                run = target / run_id
                run.mkdir(parents=True)
                (run / "source_catalog.ecsv").write_text(
                    "source_id,ra_deg,dec_deg\n1,133.789,-7.24\n", encoding="utf-8")
            idx = build(base / "targets", base / "publish", extract_gif=False)
            runs = next(t for t in idx["targets"] if t["target_id"] == "WISE_0855")["runs"]
            self.assertEqual(len(runs), 3)
            self.assertEqual(sum(x["band_id"] == "D1" for x in runs), 2)
            self.assertEqual(sum(x["band_id"] == "D1+D2+D3" for x in runs), 1)
            self.assertTrue(all(x["manifest_url"].startswith("wise-0855/")
                                for x in runs))


    def test_png_only_import_excludes_existing_gif(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "input"
            run = root / "Epsilon_Indi_B" / "analysis_runs" / "D2_gap10_spaninf_v1"
            (run / "group_stack_frames").mkdir(parents=True)
            (run / "sed_plots").mkdir()
            (run / "group_stacks_sources_epsf.gif").write_bytes(GIF_1PX)
            (run / "group_stacks_sources_epsf.png").write_bytes(PNG_1PX)
            (run / "time_grouping_diagnostic.png").write_bytes(PNG_1PX)
            for number in (3, 1, 2):
                (run / "group_stack_frames" / f"group_{number:02d}_sources_epsf.png").write_bytes(PNG_1PX)
            (run / "source_catalog.ecsv").write_text(
                "source_id ra_deg dec_deg\n1 331.04 -56.78\n", encoding="utf-8")
            (run / "sed_plots" / "source_001_group_sed.png").write_bytes(PNG_1PX)
            out = Path(tmp) / "published"
            index = build(root, out, extract_gif=False, include_gif=False)
            entry = next(t for t in index["targets"] if t["target_id"] == "Epsilon_Indi_B")
            self.assertEqual(len(entry["runs"]), 1)
            self.assertFalse(entry["runs"][0]["has_gif"])
            self.assertTrue(entry["runs"][0]["has_frames"])
            self.assertTrue(entry["runs"][0]["has_overview"])
            base = out / "epsilon-indi-b" / "D2_gap10_spaninf_v1"
            data = json.loads((base / "manifest.json").read_text())
            product = data["bands"]["D2"]
            self.assertIsNone(product["blink_url"])
            self.assertEqual([f["frame_id"] for f in product["frames"]],
                             ["group_1", "group_2", "group_3"])
            self.assertEqual(product["overview_url"], "media/group_stacks_sources_epsf.png")
            self.assertEqual(product["diagnostic_url"], "media/time_grouping_diagnostic.png")
            self.assertFalse(list(base.rglob("*.gif")))


if __name__ == "__main__":
    unittest.main()
