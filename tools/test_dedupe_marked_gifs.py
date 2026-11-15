#!/usr/bin/env python3
"""Synthetic fixtures to test GIF deduplication without touching science data."""
import json
import tempfile
import unittest
from pathlib import Path
from PIL import Image
from dedupe_marked_gifs import dedupe

def make_gif(path, size=(4, 4), frames=2):
    path.parent.mkdir(parents=True, exist_ok=True)
    imgs = [Image.new("RGB", size, (i * 80, 10, 30)) for i in range(frames)]
    imgs[0].save(path, format="GIF", save_all=True,
                 append_images=imgs[1:], duration=100, loop=0)

class DedupeTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name) / "science-runs"
        self.run = self.root / "wise-0855" / "D1_gap10_spaninf_v1"
        self.run.mkdir(parents=True)
        self.idx = {"targets": [
            {"target_id": "WISE_0855", "runs": [{
                "run_id": "D1_gap10_spaninf_v1", "band_id": "D1",
                "manifest_url": "wise-0855/D1_gap10_spaninf_v1/manifest.json"}]},
            {"target_id": "R_Draconis", "runs": []}]}
        self.manifest = {
            "target_id": "WISE_0855", "run_id": "D1_gap10_spaninf_v1",
            "band_id": "D1", "bands": {"D1": {
                "blink_url": "media/group_stacks_marked.gif",
                "seds": [{"source_id": "1", "plots": {"evolution": "sed.webp"}}]}}}
        (self.root / "index.json").write_text(json.dumps(self.idx))
        (self.run / "manifest.json").write_text(json.dumps(self.manifest))
        self.old = self.run / "media" / "group_stacks_sources_epsf.gif"
        self.new = self.run / "media" / "group_stacks_marked.gif"

    def test_dry_run_retains_original_and_apply_deletes_only_original(self):
        make_gif(self.old)
        make_gif(self.new)
        self.assertEqual(dedupe(self.root, targets=("WISE_0855",), runs_per_target=1), 1)
        self.assertTrue(self.old.exists())
        self.assertEqual(dedupe(self.root, targets=("WISE_0855",), runs_per_target=1, apply=True), 1)
        self.assertFalse(self.old.exists())
        self.assertTrue(self.new.exists())
        self.assertEqual(json.loads((self.run / "manifest.json").read_text()), self.manifest)

    def test_reject_frame_count_difference_without_delete(self):
        make_gif(self.old, frames=2)
        make_gif(self.new, frames=3)
        with self.assertRaisesRegex(ValueError, "geometry mismatch"):
            dedupe(self.root, targets=("WISE_0855",), runs_per_target=1, apply=True)
        self.assertTrue(self.old.exists())

    def test_reject_dimension_difference_without_delete(self):
        make_gif(self.old, size=(4, 4))
        make_gif(self.new, size=(5, 5))
        with self.assertRaisesRegex(ValueError, "geometry mismatch"):
            dedupe(self.root, targets=("WISE_0855",), runs_per_target=1, apply=True)
        self.assertTrue(self.old.exists())

    def test_reject_missing_marked_without_delete(self):
        make_gif(self.old)
        with self.assertRaisesRegex(ValueError, "Missing marked GIF"):
            dedupe(self.root, targets=("WISE_0855",), runs_per_target=1, apply=True)
        self.assertTrue(self.old.exists())

if __name__ == "__main__":
    unittest.main()
