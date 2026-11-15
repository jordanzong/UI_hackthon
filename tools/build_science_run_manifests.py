#!/usr/bin/env python3
"""Publish SPHEREx analysis_runs as static, per-run manifests for GitHub Pages.

Usage:
  python3 tools/build_science_run_manifests.py \
    --input-root /path/to/targets --output-dir ./science-runs

The input folder contains five <target>/analysis_runs/<band>_gap..._span..._vN/
directories produced by SPHEREx_auto.ipynb. This exporter copies only real
GIF/PNG outputs, reads ECSV positions and markers.json, and optionally extracts
GIF frames with Pillow. It never creates scientific detections or invented MJDs.
The frontend can display a missing-data state until the team publishes results.
"""
import argparse
import csv
import json
import re
import shlex
import shutil
from pathlib import Path

TARGETS = [
    ("WISE_0855", "wise-0855", "WISE 0855"),
    ("Barnards_Star", "barnards-star", "Barnard's Star"),
    ("Epsilon_Indi_B", "epsilon-indi-b", "Epsilon Indi B"),
    ("RW_Aurigae", "rw-aurigae", "RW Aurigae"),
    ("R_Draconis", "r-draconis", "R Draconis"),
]
BANDS = ["D1", "D2", "D3", "D4", "D5", "D6",
         "D1+D2+D3", "D4+D5+D6", "D1+D2+D3+D4+D5+D6"]
RUN_RX = re.compile(
    r"^(?P<bands>D[1-6](?:_D[1-6])*)_gap(?P<gap>\d+(?:\.\d+)?)_"
    r"span(?P<span>inf|\d+(?:\.\d+)?)_(?P<version>v[a-zA-Z0-9_.-]+)$")
SED_RX = re.compile(r"^source_(\d+)_(group_sed|sed_evolution)\.png$", re.I)
MAX_ASSET_BYTES = 45 * 1024 * 1024


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False)
                    + "\n", encoding="utf-8")


def safe_copy(source, destination):
    if not source.is_file():
        return None
    if source.stat().st_size > MAX_ASSET_BYTES:
        print("SKIP oversized asset:", source)
        return None
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, destination)
    return destination


def publish_sed_plot(source, destination):
    """Compress a genuine SED PNG for static delivery; never alter photometry."""
    if not source.is_file():
        return None
    if source.stat().st_size > MAX_ASSET_BYTES:
        print("SKIP oversized SED:", source)
        return None
    try:
        from PIL import Image
    except ImportError:
        return safe_copy(source, destination)
    try:
        webp_path = destination.with_suffix(".webp")
        webp_path.parent.mkdir(parents=True, exist_ok=True)
        with Image.open(source) as image:
            image.convert("RGB").save(webp_path, "WEBP", quality=85, method=4)
        return webp_path
    except (OSError, ValueError) as exc:
        print("WEBP conversion unavailable, keeping PNG:", source, exc)
        return safe_copy(source, destination)


def read_ecsv(path):
    """Read basic numeric source catalogs without mandatory astropy dependency."""
    if not path.is_file():
        return []
    lines = [ln.rstrip("\n") for ln in path.read_text(encoding="utf-8-sig").splitlines()
             if ln.strip() and not ln.lstrip().startswith("#")]
    if not lines:
        return []
    header = lines[0]
    comma = "," in header
    def split(line):
        return next(csv.reader([line])) if comma else shlex.split(line)
    names = split(header)
    if not {"source_id", "ra_deg", "dec_deg"}.issubset(names):
        print("SKIP catalog with unexpected columns:", path, names)
        return []
    result = []
    for ln in lines[1:]:
        try:
            fields = split(ln)
            if len(fields) != len(names):
                continue
            row = dict(zip(names, fields))
            ra, dec = float(row["ra_deg"]), float(row["dec_deg"])
            if not (0 <= ra < 360 and -90 <= dec <= 90):
                continue
            source_id = str(row["source_id"]).strip()
            if not source_id:
                continue
            item = {"source_id": source_id, "ra_deg": ra, "dec_deg": dec}
            for key in ("best_snr", "n_groups_detected"):
                if row.get(key):
                    try:
                        item[key] = float(row[key])
                    except ValueError:
                        pass
            result.append(item)
        except (ValueError, IndexError, csv.Error):
            continue
    return result


def read_markers(path):
    if not path.is_file():
        return []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (ValueError, OSError) as e:
        print("SKIP invalid markers.json:", path, e)
        return []
    if not isinstance(data, list):
        return []
    selected = []
    for marker in data:
        if not isinstance(marker, dict) or "source_id" not in marker:
            continue
        types = marker.get("types", [])
        if not isinstance(types, list):
            types = []
        types = [t for t in types if t in ("mover", "variable", "known")]
        if not types:
            continue
        item = {"source_id": str(marker["source_id"]), "types": types}
        for key in ("pm", "pm_err", "pm_sig", "var_chi2", "var_amp",
                    "var_peak_sig", "n_groups", "blend", "ra", "dec"):
            val = marker.get(key)
            if val is None or isinstance(val, (int, float, bool)):
                item[key] = val
        selected.append(item)
    return selected


def fits_group_metadata(path):
    """FITS group MJDs must come from actual headers, never directory guesses."""
    if not path.is_file():
        return []
    try:
        from astropy.io import fits
    except ImportError:
        print("Optional astropy unavailable; no MJD/group counts from FITS:", path)
        return []
    result = []
    with fits.open(path, memmap=True) as hdus:
        for hdu in hdus:
            match = re.fullmatch(r"STACK(\d+)", str(hdu.name))
            if not match:
                continue
            h = hdu.header
            start, end = h.get("MJDSTART"), h.get("MJDEND")
            entry = {"group_id": int(match.group(1))}
            if start is not None and end is not None:
                entry["mjd"] = (float(start) + float(end)) / 2
                entry["start_mjd"], entry["end_mjd"] = float(start), float(end)
            if h.get("NINPUT") is not None:
                entry["stack_inputs"] = int(h["NINPUT"])
            result.append(entry)
    return sorted(result, key=lambda x: x["group_id"])


def gif_frames(gif, output):
    """Optionally render marked GIF frames to actual PNGs (Pillow required)."""
    try:
        from PIL import Image
    except ImportError:
        print("Optional Pillow unavailable; GIF stays playable without epoch PNGs.")
        return []
    frames = []
    with Image.open(gif) as img:
        count = min(getattr(img, "n_frames", 1), 300)
        for i in range(count):
            img.seek(i)
            out = output / "media" / "group_frames" / f"group_{i+1:03d}.png"
            out.parent.mkdir(parents=True, exist_ok=True)
            img.convert("RGBA").save(out, format="PNG", optimize=True)
            frames.append("media/group_frames/" + out.name)
    return frames


def export_run(run_dir, dest, target_id, band_id, match, extract_gif):
    dest.mkdir(parents=True, exist_ok=True)
    metadata = fits_group_metadata(run_dir / "time_grouped_stacks.fits")
    group_meta = {int(g["group_id"]): g for g in metadata}
    gifs = sorted(run_dir.glob("group_stacks*.gif"))
    # The classifier-marked GIF must win over older source-number-only GIFs.
    gifs.sort(key=lambda p: (0 if ("marked" in p.stem or "movers_variables" in p.stem)
                             else 1 if "sources_epsf" in p.stem else 2, p.name))
    gif_url = None
    frame_paths = []
    if gifs:
        gif = gifs[0]
        is_marked = ("marked" in gif.stem or "movers_variables" in gif.stem)
        published_name = "group_stacks_marked.gif" if is_marked else gif.name
        copied = safe_copy(gif, dest / "media" / published_name)
        if copied:
            gif_url = "media/" + copied.name
            if extract_gif:
                frame_paths = gif_frames(gif, dest)
    if not frame_paths:
        folder = run_dir / "group_stack_frames"
        if folder.is_dir():
            for src in sorted(folder.glob("*.png")):
                if not re.search(r"group[_-]?\d+", src.stem, re.I):
                    continue
                dest_name = dest / "media" / "group_frames" / src.name
                if safe_copy(src, dest_name):
                    frame_paths.append("media/group_frames/" + src.name)
    frames = []
    for i, filename in enumerate(frame_paths, start=1):
        entry = {"frame_id": f"group_{i}", "label": f"Group {i}",
                 "image_url": filename}
        entry.update({k: v for k, v in group_meta.get(i, {}).items()
                      if k not in ("group_id",)})
        frames.append(entry)

    sources = read_ecsv(run_dir / "source_catalog.ecsv")
    markers = read_markers(run_dir / "markers.json")
    markers_by_id = {m["source_id"]: m for m in markers}
    for src in sources:
        candidate = markers_by_id.get(src["source_id"])
        if candidate:
            src["candidate_types"] = candidate["types"]
            src["candidate_status"] = "algorithm_candidate_unverified"
    plots = {}
    plot_dir = run_dir / "sed_plots"
    if plot_dir.is_dir():
        for img in sorted(plot_dir.iterdir()):
            match_sed = SED_RX.fullmatch(img.name)
            if not match_sed:
                continue
            sid = str(int(match_sed.group(1)))
            plot_type = "groups" if match_sed.group(2).lower() == "group_sed" else "evolution"
            out = dest / "media" / "sed_plots" / img.name
            published = publish_sed_plot(img, out)
            if published:
                plots.setdefault(sid, {})[plot_type] = "media/sed_plots/" + published.name
    seds = [{"source_id": sid, "plots": types}
            for sid, types in sorted(plots.items(), key=lambda x: int(x[0]))]

    product = {
        "kind": "analysis-run",
        "label": run_dir.name,
        "frames": frames,
        "blink_url": gif_url,
        "gif_annotation": ("algorithm-candidates" if gif_url and
                           "marked" in gif_url and markers else
                           "marked-unclassified" if gif_url and
                           "marked" in gif_url else
                           "source-numbers" if gif_url else "none"),
        "sed_photometry_scope": "all-six-bands",
        "seds": seds,
        "source_count": len(sources),
        "candidate_count": len(markers),
        "notice": ("Marked GIF frames and SED plots are from this exact analysis run. "
                   "Candidate mover/variable classes are algorithm flags, not verified "
                   "astrophysical identifications. Image overlays are baked into GIF; "
                   "no pixel-accurate clickable source boxes are assumed.")
    }
    manifest = {
        "schema_version": "spherex-analysis-run/v1",
        "target_id": target_id,
        "run_id": run_dir.name,
        "band_id": band_id,
        "parameters": {
            "gap_days": float(match["gap"]),
            "span_days": None if match["span"] == "inf" else float(match["span"]),
            "version": match["version"]
        },
        "bands": {band_id: product},
        "sources": sources,
        "candidates": markers,
        "group_metadata": metadata,
        "files_present": {
            "source_catalog_ecsv": (run_dir / "source_catalog.ecsv").is_file(),
            "photometry_ecsv": (run_dir / "allbands_epsf_photometry.ecsv").is_file(),
            "time_grouped_stacks_fits": (run_dir / "time_grouped_stacks.fits").is_file(),
            "markers_json": (run_dir / "markers.json").is_file()
        }
    }
    write_json(dest / "manifest.json", manifest)
    return {"run_id": run_dir.name, "band_id": band_id,
            "manifest_url": f"{run_dir.name}/manifest.json",
            "group_count": len(frames) or len(metadata),
            "source_count": len(sources), "candidate_count": len(markers),
            "has_gif": bool(gif_url), "sed_count": len(seds),
            "parameters": manifest["parameters"]}


def build(input_root, output_root, extract_gif):
    # Allow both .../targets and .../<parent>/targets as input.
    source_root = input_root / "targets" if (input_root / "targets").is_dir() else input_root
    output_root.mkdir(parents=True, exist_ok=True)
    index = {"schema_version": "spherex-science-runs-index/v1",
             "bands": BANDS,
             "targets": []}
    for target_id, slug, name in TARGETS:
        runs = []
        run_root = source_root / target_id / "analysis_runs"
        if run_root.is_dir():
            for candidate in sorted(run_root.iterdir()):
                if not candidate.is_dir():
                    continue
                parsed = RUN_RX.fullmatch(candidate.name)
                if not parsed:
                    print("SKIP unrecognized Analysis Run:", candidate)
                    continue
                numbers = parsed["bands"].split("_")
                band_id = "+".join(numbers)
                if len(numbers) != len(set(numbers)) or numbers != sorted(numbers):
                    print("SKIP unordered/duplicate band IDs:", candidate.name)
                    continue
                # Allow experimental combinations (e.g., D5+D6) without
                # inventing extra standard-band menu entries.
                run = export_run(candidate, output_root / slug / candidate.name,
                                 target_id, band_id, parsed, extract_gif)
                run["manifest_url"] = f"{slug}/{run['manifest_url']}"
                runs.append(run)
        status = ("ready" if runs else
                  "photometry_under_revision" if target_id == "R_Draconis" else
                  "awaiting_export")
        index["targets"].append({
            "target_id": target_id, "name": name, "slug": slug,
            "runs": runs, "publication_status": status
        })
        print(f"{name}: {len(runs)} analysis runs")
    write_json(output_root / "index.json", index)
    print(f"Published {sum(len(t['runs']) for t in index['targets'])} runs to {output_root}")
    return index


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input-root", required=True, type=Path,
                        help="folder containing WISE_0855/, Barnards_Star/, etc. (or targets/)")
    parser.add_argument("--output-dir", default="science-runs", type=Path,
                        help="GitHub Pages output directory; normally ./science-runs")
    parser.add_argument("--no-gif-frames", action="store_true",
                        help="don't extract PNG epoch images from marked GIFs")
    args = parser.parse_args()
    if not args.input_root.is_dir():
        parser.error("input-root folder not found")
    build(args.input_root.resolve(), args.output_dir.resolve(), not args.no_gif_frames)


if __name__ == "__main__":
    main()
