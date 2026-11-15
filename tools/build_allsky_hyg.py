#!/usr/bin/env python3
"""Download HYG v4.1, validate real all-sky stars, export compact static tiles.

HYG by David Nash / Astronexus, CC BY-SA 4.0, J2000 positions,
apparent V magnitude (NOT Gaia G magnitude). Original:
https://github.com/astronexus/HYG-Database/blob/main/hyg/CURRENT/hygdata_v41.csv

This dataset is a separate all-sky background; existing genuine Gaia DR3
source CSVs for five SPHEREx fields remain independent.
"""
from __future__ import annotations
import csv
import datetime as dt
import io
import json
import math
import pathlib
import urllib.request
from collections import defaultdict

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "catalogs" / "allsky"
SOURCE = ("https://raw.githubusercontent.com/astronexus/"
          "HYG-Database/main/hyg/CURRENT/hygdata_v41.csv")
ATTRIBUTION = ("HYG Database v4.1; David Nash/Astronexus; "
               "CC BY-SA 4.0")
BRIGHT_LIMIT = 6.5
FAINT_LIMIT = 11.5
RA_STEP_DEG = 30
DEC_STEP_DEG = 15


def dump(path: pathlib.Path, data: object):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n",
                    encoding="utf-8")


def main():
    req = urllib.request.Request(
        SOURCE, headers={"User-Agent": "SPHEREx-Sky-Atlas-HYG-Exporter/1.0",
                         "Accept": "text/csv"})
    with urllib.request.urlopen(req, timeout=180) as resp:
        if resp.status != 200:
            raise RuntimeError(f"HYG HTTP {resp.status}")
        raw = resp.read(42_000_000)
    if len(raw) < 2_000_000 or len(raw) > 41_900_000:
        raise ValueError(f"Unexpected HYG source payload size: {len(raw)} bytes")
    decoded = io.StringIO(raw.decode("utf-8-sig"))
    reader = csv.DictReader(decoded)
    expected = {"id", "ra", "dec", "mag", "dist", "proper"}
    if not expected.issubset(reader.fieldnames or []):
        raise ValueError(f"HYG schema changed: {reader.fieldnames}")
    bright, tiles = [], defaultdict(list)
    seen = set()
    valid = 0
    for row in reader:
        try:
            id_ = int(row["id"])
            ra_hours = float(row["ra"])
            dec = float(row["dec"])
            mag = float(row["mag"])
            dist = float(row["dist"])
            if id_ in seen or dist == 0 or not all(
                math.isfinite(v) for v in (ra_hours, dec, mag, dist)
            ):
                continue
            if not (0 <= ra_hours < 24 and -90 <= dec <= 90):
                continue
            seen.add(id_)
            valid += 1
            if mag > FAINT_LIMIT:
                continue
            ra = ra_hours * 15.0
            name = row.get("proper", "").strip()[:65]
            # Compact 5-tuple: unique HYG id, RA°, Dec°, visual Vmag, proper name.
            item = [id_, round(ra, 6), round(dec, 6), round(mag, 2), name]
            if mag <= BRIGHT_LIMIT:
                bright.append(item)
            else:
                ir = min(11, int(ra / RA_STEP_DEG))
                idec = min(11, int((dec + 90) / DEC_STEP_DEG))
                tiles[(ir, idec)].append(item)
        except (TypeError, ValueError, KeyError):
            continue

    if valid < 100_000 or len(bright) < 4000 or len(tiles) < 100:
        raise RuntimeError(
            f"Unexpectedly small catalog: {valid} valid, "
            f"{len(bright)} bright, {len(tiles)} tiles"
        )
    bright.sort(key=lambda v: (v[3], v[0]))
    dump(OUT / "bright.json", bright)
    manifest_tiles = []
    for (ir, idec), stars in sorted(tiles.items()):
        ident = f"r{ir:02d}_d{idec:02d}"
        file = f"tiles/{ident}.json"
        stars.sort(key=lambda v: (v[3], v[0]))
        dump(OUT / file, stars)
        manifest_tiles.append({
            "id": ident, "file": file, "count": len(stars),
            "ra_center_deg": ir * RA_STEP_DEG + RA_STEP_DEG / 2,
            "dec_center_deg": idec * DEC_STEP_DEG - 90 + DEC_STEP_DEG / 2,
        })
    manifest = {
        "catalog": "HYG Database v4.1",
        "kind": "all-sky stellar background",
        "license": "CC BY-SA 4.0",
        "attribution": ATTRIBUTION,
        "source_url": SOURCE,
        "source_epoch": "J2000.0 (HYG)",
        "magnitude_type": "visual V, not Gaia G",
        "retrieved_utc": dt.datetime.now(dt.timezone.utc).isoformat(),
        "tuple_fields": ["hyg_id", "ra_deg", "dec_deg", "vmag", "proper_name"],
        "source_valid_rows": valid,
        "bright_file": "bright.json",
        "bright_limit": BRIGHT_LIMIT,
        "bright_count": len(bright),
        "faint_limit": FAINT_LIMIT,
        "ra_tile_width_deg": RA_STEP_DEG,
        "dec_tile_height_deg": DEC_STEP_DEG,
        "tile_count": len(manifest_tiles),
        "tile_source_count": sum(len(v) for v in tiles.values()),
        "tiles": manifest_tiles,
    }
    dump(OUT / "manifest.json", manifest)
    print(
        f"HYG v4.1 valid={valid}; all-sky bright={len(bright)}; "
        f"tiled faint={manifest['tile_source_count']}; tiles={len(manifest_tiles)}"
    )
    print(f"Data: {OUT}")
    if len(bright) + manifest["tile_source_count"] < 90_000:
        raise RuntimeError("Too few exported HYG stars; do not publish this dataset.")


if __name__ == "__main__":
    main()
