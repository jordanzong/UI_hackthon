#!/usr/bin/env python3
"""Publish marked GIFs without changing measured photometry or Group frames."""
import argparse
import csv
import hashlib
import json
import re
import shlex
import zipfile
from collections import defaultdict
from pathlib import Path

TARGETS = ("WISE_0855", "Barnards_Star", "Epsilon_Indi_B", "RW_Aurigae")
GIF = re.compile(r"group_stacks.*marked.*\.gif$", re.I)

def sid(value):
    s = str(value).strip()
    return str(int(s)) if s.isdecimal() else s

def catalog_ids(data):
    rows = [x for x in data.decode("utf-8-sig").splitlines()
            if x.strip() and not x.lstrip().startswith("#")]
    if not rows:
        raise ValueError("Empty source_catalog.ecsv")
    comma = "," in rows[0]
    def fields(x):
        return next(csv.reader([x])) if comma else shlex.split(x)
    cols = fields(rows[0])
    if "source_id" not in cols:
        raise ValueError("Missing source_id in ECSV")
    k = cols.index("source_id")
    values = [sid(r[k]) for row in rows[1:] if len(r := fields(row)) == len(cols)]
    if len(values) != len(set(values)):
        raise ValueError("Duplicate source IDs in new ECSV")
    return set(values)

def candidates_from_json(data, known):
    found = json.loads(data.decode("utf-8-sig"))
    if isinstance(found, dict):
        found = found.get("markers", [])
    if not isinstance(found, list):
        raise ValueError("Invalid markers.json")
    out = []
    used = set()
    for m in found:
        if not isinstance(m, dict) or m.get("source_id") is None:
            continue
        key = sid(m["source_id"])
        types = m.get("types", [])
        if isinstance(types, str):
            types = [types]
        types = [t for t in types if t in ("mover", "variable", "known")] if isinstance(types, list) else []
        if not types:
            continue
        if key not in known or key in used:
            raise ValueError("Unmatched or duplicate marker source_id: " + key)
        used.add(key)
        item = {"source_id": key, "types": types}
        for f in ("pm", "pm_err", "pm_sig", "var_chi2", "var_amp",
                  "var_peak_sig", "n_groups", "blend", "ra", "dec"):
            v = m.get(f)
            if v is None or isinstance(v, (int, float, bool)):
                item[f] = v
        out.append(item)
    return out

def members_by_run(z):
    records = defaultdict(lambda: defaultdict(list))
    for m in z.infolist():
        if m.is_dir():
            continue
        segments = m.filename.replace("\\", "/").split("/")
        if "__MACOSX" in segments:
            continue
        for i, segment in enumerate(segments):
            if segment != "analysis_runs" or i < 1 or i + 2 >= len(segments):
                continue
            key = (segments[i-1], segments[i+1])
            if key[0] not in TARGETS:
                break
            filename = segments[-1]
            if GIF.fullmatch(filename):
                records[key]["gifs"].append(m)
            elif filename in ("source_catalog.ecsv", "markers.json"):
                records[key][filename].append(m)
            break
    return records

def update(archive, output, *, targets=TARGETS, per_target=9):
    root = Path(output).resolve()
    index_path = root / "index.json"
    index = json.loads(index_path.read_text(encoding="utf-8"))
    originals = {}
    for target in index["targets"]:
        tid = target["target_id"]
        if tid == "R_Draconis" and target["runs"]:
            raise ValueError("R Draconis photometry not approved for publication")
        if tid not in targets:
            continue
        if len(target["runs"]) != per_target:
            raise ValueError(f"{tid}: expected {per_target} runs")
        for item in target["runs"]:
            path = (root / item["manifest_url"]).resolve()
            if not path.is_relative_to(root) or not path.is_file():
                raise ValueError("Unsafe or missing run manifest")
            originals[(tid, item["run_id"])] = (path, item)
    if len(originals) != len(targets)*per_target:
        raise ValueError("Published analysis-run inventory incomplete")

    prepared = []
    with zipfile.ZipFile(archive) as z:
        incoming = members_by_run(z)
        for key, (path, item) in originals.items():
            parts = incoming[key]
            if not parts["gifs"]:
                raise ValueError("Missing marked GIF for " + repr(key))
            manifest = json.loads(path.read_text(encoding="utf-8"))
            band = item["band_id"]
            if (manifest["target_id"], manifest["run_id"], manifest["band_id"]) != (*key, band):
                raise ValueError("Manifest identity mismatch: " + repr(key))
            known = {sid(x["source_id"]) for x in manifest["sources"]}
            if len(known) != len(manifest["sources"]):
                raise ValueError("Duplicate published Source IDs")
            if parts["source_catalog.ecsv"]:
                source = min(parts["source_catalog.ecsv"], key=lambda x: len(x.filename))
                if catalog_ids(z.read(source)) != known:
                    raise ValueError("Catalog Source IDs differ for " + repr(key))
            gifs = sorted(parts["gifs"], key=lambda x: (
                Path(x.filename).name.lower() != "group_stacks_marked.gif",
                len(x.filename), x.filename))
            gif = gifs[0]
            if not 16 <= gif.file_size <= 45*1024*1024:
                raise ValueError("Invalid size marked GIF " + gif.filename)
            data = z.read(gif)
            if data[:6] not in (b"GIF87a", b"GIF89a"):
                raise ValueError("Invalid GIF file " + gif.filename)
            markers = None
            if parts["markers.json"]:
                entry = min(parts["markers.json"], key=lambda x: len(x.filename))
                markers = candidates_from_json(z.read(entry), known)
            p = manifest["bands"][band]
            p["blink_url"] = "media/group_stacks_marked.gif"
            p["gif_annotation"] = "algorithm-candidates" if markers else "marked-unclassified"
            p["notice"] = (
                "Updated real marked GIF for this exact target/run. Algorithm labels "
                "are unverified candidates; source/photometry coordinates unchanged."
            )
            if markers is not None:
                manifest["candidates"] = markers
                p["candidate_count"] = item["candidate_count"] = len(markers)
                by_id = {x["source_id"]: x for x in markers}
                for source in manifest["sources"]:
                    source.pop("candidate_types", None)
                    source.pop("candidate_status", None)
                    hit = by_id.get(sid(source["source_id"]))
                    if hit:
                        source["candidate_types"] = hit["types"]
                        source["candidate_status"] = "algorithm_candidate_unverified"
                manifest["files_present"]["markers_json"] = True
            prepared.append((key, path, manifest, data))

    # All targets/runs and IDs validated above; no partial commits on failure.
    for key, path, manifest, data in prepared:
        gif_path = path.parent / "media" / "group_stacks_marked.gif"
        gif_path.parent.mkdir(parents=True, exist_ok=True)
        gif_path.write_bytes(data)
        path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2,
                                   allow_nan=False)+"\n", encoding="utf-8")
        print("PUBLISHED", key, "GIF sha256", hashlib.sha256(data).hexdigest()[:16])
    index_path.write_text(json.dumps(index, ensure_ascii=False, indent=2,
                                     allow_nan=False)+"\n", encoding="utf-8")
    return len(prepared)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--archive", type=Path, required=True)
    parser.add_argument("--published-dir", type=Path, default=Path("science-runs"))
    args = parser.parse_args()
    n = update(args.archive, args.published_dir)
    print("Verified marked GIF updates:", n, "; original SED and Group images unchanged.")
