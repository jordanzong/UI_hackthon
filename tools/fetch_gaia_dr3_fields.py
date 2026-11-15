#!/usr/bin/env python3
"""Fetch verified Gaia DR3 CSVs for five SPHEREx research fields.

This script uses official Gaia DR3 TAP services from a networked runner.
It never synthesizes catalog entries. All returned rows must parse as valid
Gaia source_id, RA, Dec and Gmag within the requested cone.

Usage: python tools/fetch_gaia_dr3_fields.py
"""
import csv
import datetime as dt
import io
import json
import math
import os
import pathlib
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "catalogs" / "gaia"
TARGETS = [
    {"id": "WISE_0855", "slug": "wise-0855", "name": "WISE 0855", "ra_deg": 133.78948310, "dec_deg": -7.24294039},
    {"id": "Barnards_Star", "slug": "barnards-star", "name": "Barnard's Star", "ra_deg": 269.45207696, "dec_deg": 4.69336497},
    {"id": "Epsilon_Indi_B", "slug": "epsilon-indi-b", "name": "Epsilon Indi B", "ra_deg": 331.04414659, "dec_deg": -56.78284420},
    {"id": "RW_Aurigae", "slug": "rw-aurigae", "name": "RW Aurigae", "ra_deg": 76.95652603, "dec_deg": 30.40143817},
    {"id": "R_Draconis", "slug": "r-draconis", "name": "R Draconis", "ra_deg": 248.16761083, "dec_deg": 66.75497942},
]
RADIUS_DEG = float(os.getenv("GAIA_RADIUS_DEG", "0.20"))
MAG_LIMIT = float(os.getenv("GAIA_MAG_LIMIT", "18.5"))
MAX_ROWS = int(os.getenv("GAIA_MAX_ROWS", "2500"))
if not (0.01 <= RADIUS_DEG <= 1 and 8 <= MAG_LIMIT <= 21 and 10 <= MAX_ROWS <= 10000):
    raise ValueError("Unsafe cone, magnitude or row-count settings")

SERVICES = [
    ("ARI Gaia DR3", "https://gaia.ari.uni-heidelberg.de/tap/sync", "gaiadr3.gaia_source"),
    ("ESA Gaia Archive", "https://gea.esac.esa.int/tap-server/tap/sync", "gaiadr3.gaia_source"),
    ("MAST Gaia DR3", "https://mast.stsci.edu/vo-tap/api/v0.1/gaiadr3/sync", "dbo.gaia_source"),
]
COLUMNS = ["source_id", "ra", "dec", "phot_g_mean_mag"]


def sep_deg(ra1, dec1, ra2, dec2):
    x1, y1, x2, y2 = map(math.radians, (ra1, dec1, ra2, dec2))
    sin2 = math.sin((y2-y1)/2)**2 + math.cos(y1)*math.cos(y2)*math.sin((x2-x1)/2)**2
    return math.degrees(2*math.asin(math.sqrt(min(1.0, max(0.0, sin2)))))


def sql_for(target, table):
    return (
        f"SELECT TOP {MAX_ROWS} source_id, ra, dec, phot_g_mean_mag "
        f"FROM {table} "
        "WHERE 1=CONTAINS(POINT('ICRS',ra,dec), "
        f"CIRCLE('ICRS',{target['ra_deg']:.8f},{target['dec_deg']:.8f},{RADIUS_DEG:.5f})) "
        f"AND phot_g_mean_mag < {MAG_LIMIT:.2f} "
        "ORDER BY phot_g_mean_mag ASC"
    )


def query_csv(service, target):
    name, url, table = service
    params = urllib.parse.urlencode({
        "REQUEST": "doQuery", "LANG": "ADQL",
        "FORMAT": "csv", "QUERY": sql_for(target, table),
        "MAXREC": str(MAX_ROWS),
    }).encode()
    req = urllib.request.Request(
        url, data=params, method="POST",
        headers={"Content-Type": "application/x-www-form-urlencoded",
                 "Accept": "text/csv, text/plain;q=0.9",
                 "User-Agent": "SPHEREx-Science-Atlas-Gaia-Cache/1.0"},
    )
    with urllib.request.urlopen(req, timeout=90) as response:
        if response.status != 200:
            raise RuntimeError(f"HTTP {response.status}")
        raw = response.read(4_000_000)
    text = raw.decode("utf-8-sig", errors="replace")
    if not text.strip() or text.lstrip().startswith("<"):
        raise ValueError("Empty or XML/HTML error returned instead of CSV")
    rows = list(csv.DictReader(io.StringIO(text)))
    if not rows or not all(key in (rows[0] or {}) for key in COLUMNS):
        raise ValueError("CSV empty or required Gaia column(s) missing")
    accepted = []
    seen = set()
    for row in rows:
        try:
            source = str(row["source_id"]).strip()
            ra, dec, mag = (float(row[col]) for col in COLUMNS[1:])
            if not source or source in seen or not all(map(math.isfinite, (ra, dec, mag))):
                continue
            if not 0 <= ra < 360 or not -90 <= dec <= 90 or mag >= MAG_LIMIT:
                continue
            if sep_deg(target["ra_deg"], target["dec_deg"], ra, dec) > RADIUS_DEG + 1e-4:
                continue
            seen.add(source)
            accepted.append([source, f"{ra:.9f}", f"{dec:.9f}", f"{mag:.5f}"])
        except (TypeError, ValueError, KeyError):
            continue
    if not accepted:
        raise ValueError("No valid Gaia DR3 rows within target cone")
    return accepted


def fetch_target(target):
    failures = []
    for service in SERVICES:
        for attempt in range(2):
            try:
                print(f"{target['slug']} — {service[0]} attempt {attempt+1}", flush=True)
                rows = query_csv(service, target)
                print(f"{target['slug']}: {len(rows)} VERIFIED rows via {service[0]}", flush=True)
                return rows, service[0]
            except Exception as exc:
                failures.append(f"{service[0]} #{attempt+1}: {type(exc).__name__}: {str(exc)[:180]}")
                print(f"  failed: {failures[-1]}", flush=True)
                if attempt == 0:
                    time.sleep(2)
    raise RuntimeError("; ".join(failures))


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    manifest = {
        "catalog": "Gaia DR3",
        "coordinate_frame": "ICRS",
        "position_epoch": "J2016.0 (Gaia DR3 catalog epoch; no proper-motion propagation)",
        "retrieved_utc": dt.datetime.now(dt.timezone.utc).isoformat(),
        "radius_deg": RADIUS_DEG,
        "g_mag_lt": MAG_LIMIT,
        "max_rows": MAX_ROWS,
        "fields": [],
    }
    failures = {}
    for target in TARGETS:
        try:
            rows, provider = fetch_target(target)
            filename = target["slug"] + ".csv"
            path = OUTPUT / filename
            with path.open("w", encoding="utf-8", newline="") as file:
                writer = csv.writer(file)
                writer.writerow(COLUMNS)
                writer.writerows(rows)
            manifest["fields"].append({
                "target_id": target["id"],
                "name": target["name"],
                "file": filename,
                "center": {"ra_deg": target["ra_deg"], "dec_deg": target["dec_deg"]},
                "radius_deg": RADIUS_DEG,
                "mag_limit": MAG_LIMIT,
                "row_count": len(rows),
                "truncated": len(rows) >= MAX_ROWS,
                "provider": provider,
            })
        except Exception as exc:
            failures[target["id"]] = str(exc)
            print(f"ERROR {target['slug']}: {exc}", file=sys.stderr, flush=True)
    (OUTPUT / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if failures:
        print(f"Failed targets: {json.dumps(failures, indent=2)}", file=sys.stderr)
        # Keep successful CSVs, but do not claim complete coverage.
        # A runner can commit partial verified results and fail the job for attention.
    print(f"Saved {len(manifest['fields'])}/{len(TARGETS)} Gaia DR3 fields", flush=True)
    return int(bool(failures))


if __name__ == "__main__":
    sys.exit(main())
