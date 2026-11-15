#!/usr/bin/env python3
"""Only delete redundant, unreferenced source-number GIFs after verification.

A marked GIF was created from the corresponding original. Validate the
animation dimensions and exact frame counts first, for all published runs.
Do not alter any science measurements, SED plots, group frames or manifests.
"""
import argparse
import json
from pathlib import Path
from PIL import Image

TARGETS = ("WISE_0855", "Barnards_Star", "Epsilon_Indi_B", "RW_Aurigae")
MARKED = "group_stacks_marked.gif"
ORIGINAL = "group_stacks_sources_epsf.gif"

def verify_gif(path):
    with Image.open(path) as im:
        if im.format != "GIF":
            raise ValueError("Not a valid GIF: " + str(path))
        dimensions = im.size
        frames = im.n_frames
        if frames < 1:
            raise ValueError("No GIF frames: " + str(path))
        for i in range(frames):
            im.seek(i)
            im.load()
        return dimensions, frames

def dedupe(root, *, targets=TARGETS, runs_per_target=9, apply=False):
    root = Path(root).resolve()
    idx = json.loads((root / "index.json").read_text(encoding="utf-8"))
    to_delete = []
    counts = {}
    for target in idx["targets"]:
        tid = target["target_id"]
        if tid == "R_Draconis":
            if target["runs"]:
                raise ValueError("R Draconis still has unapproved photometry")
            continue
        if tid not in targets:
            continue
        if len(target["runs"]) != runs_per_target:
            raise ValueError(f"{tid}: expected {runs_per_target} runs")
        counts[tid] = len(target["runs"])
        for run in target["runs"]:
            path = (root / run["manifest_url"]).resolve()
            if not path.is_relative_to(root) or not path.is_file():
                raise ValueError("Invalid published Run manifest path")
            m = json.loads(path.read_text(encoding="utf-8"))
            band = run["band_id"]
            if (m["target_id"], m["run_id"], m["band_id"]) != (
                    tid, run["run_id"], band):
                raise ValueError("Target / run / band mismatch: " + str(path))
            if m["bands"][band]["blink_url"] != "media/" + MARKED:
                raise ValueError("Run is not linked to marked GIF: " + str(path))
            if ORIGINAL in json.dumps(m):
                raise ValueError("Run still references original GIF: " + str(path))
            marked = path.parent / "media" / MARKED
            original = path.parent / "media" / ORIGINAL
            if not marked.is_file():
                raise ValueError("Missing marked GIF: " + str(marked))
            marked_geometry = verify_gif(marked)
            if original.is_file():
                original_geometry = verify_gif(original)
                if original_geometry != marked_geometry:
                    raise ValueError(
                        f"Original / marked geometry mismatch: {tid}/{run['run_id']}; "
                        f"{original_geometry} != {marked_geometry}")
                to_delete.append(original)
    if len(counts) != len(targets):
        raise ValueError("Incomplete target inventory: " + repr(counts))
    if apply:
        for original in to_delete:
            original.unlink()
    print(f"Validated {sum(counts.values())} marked GIFs. "
          f"{'Deleted' if apply else 'Ready to delete'} "
          f"{len(to_delete)} redundant originals.")
    return len(to_delete)

if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--science-dir", type=Path, default=Path("science-runs"))
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()
    dedupe(args.science_dir, apply=args.apply)
