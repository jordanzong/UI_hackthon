#!/usr/bin/env python3
"""Export science-ready per-target SPHEREx image previews and a UI manifest.

This does NOT perform SPHEREx calibration, ZODI subtraction, quality masking,
cross-epoch source association, or photometry. Feed it already validated results.

Usage:
  python tools/export_spherex_products.py --spec products/barnards-star.json \
      --output-root notebook-results

Requires: numpy, Pillow. For FITS or ECSV inputs, additionally requires astropy.
"""
from __future__ import annotations

import argparse
import json
import math
import re
import shutil
from pathlib import Path

ALLOWED_BANDS = {"all", "D1", "D2", "D3", "D4", "D5", "D6", "D5+D6"}
TARGET_SLUGS = {
    "WISE_0855": "wise-0855",
    "Barnards_Star": "barnards-star",
    "Epsilon_Indi_B": "epsilon-indi-b",
    "RW_Aurigae": "rw-aurigae",
    "R_Draconis": "r-draconis",
}


def source_path(value: str, spec_dir: Path) -> Path:
    p = Path(value).expanduser()
    return (p if p.is_absolute() else spec_dir / p).resolve()


def sanitize(name: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_-]+", "_", name).strip("_")[:90] or "image"


def is_fits(p: Path) -> bool:
    return p.name.lower().endswith((".fits", ".fits.gz", ".fit", ".fit.gz", ".fts"))


def fits_to_png(inp: Path, out: Path, mode: str, ext=None) -> None:
    import numpy as np
    from PIL import Image
    from astropy.io import fits

    with fits.open(inp, memmap=False) as hdul:
        if ext is not None:
            arr = hdul[ext].data
        else:
            arr = next(
                (h.data for h in hdul if getattr(h, "data", None) is not None
                 and np.squeeze(h.data).ndim == 2), None
            )
        if arr is None:
            raise ValueError(f"No 2D image HDU in {inp}")
        arr = np.asarray(arr, dtype=np.float64)
    arr = np.squeeze(arr)
    if arr.ndim != 2:
        raise ValueError(f"Preview requires 2D data, got {arr.shape}: {inp}")

    finite = np.isfinite(arr)
    vals = arr[finite]
    if not len(vals):
        raise ValueError(f"No finite pixels in {inp}")

    if mode == "difference":
        lim = float(np.percentile(np.abs(vals), 99))
        lim = lim if lim > 0 else 1.0
        out8 = np.clip(127.5 + arr * 127.5 / lim, 0, 255)
    else:
        lo, hi = np.percentile(vals, [1, 99])
        if not hi > lo:
            hi = lo + 1.0
        out8 = np.clip((arr - lo) * 255.0 / (hi - lo), 0, 255)

    rgba = np.zeros((*arr.shape, 4), dtype=np.uint8)
    rgba[:, :, :3] = np.nan_to_num(out8, nan=0.0).astype(np.uint8)[:, :, None]
    rgba[:, :, 3] = np.where(finite, 255, 0).astype(np.uint8)
    # No image flip or resampling: pixel (x, y) maps to PNG column x, row y.
    Image.fromarray(rgba, "RGBA").save(out, format="PNG")


def asset(value: str, *, prefix: str, kind: str, base: Path, out_dir: Path, ext=None) -> str:
    inp = source_path(value, base)
    if not inp.is_file():
        raise FileNotFoundError(f"Image/figure not found: {inp}")
    suffix = ".png" if is_fits(inp) else inp.suffix.lower()
    if suffix not in {".png", ".gif", ".webp", ".jpg", ".jpeg"}:
        raise ValueError(f"Unsupported asset extension: {inp}")
    dest = out_dir / "assets" / (sanitize(prefix) + suffix)
    dest.parent.mkdir(parents=True, exist_ok=True)
    if is_fits(inp):
        fits_to_png(inp, dest, kind, ext)
    else:
        shutil.copy2(inp, dest)
    return "assets/" + dest.name


def catalog_to_sources(path: str, base: Path) -> list[dict]:
    from astropy.table import Table
    t = Table.read(source_path(path, base))
    cols = set(t.colnames)
    if not {"ra_deg", "dec_deg"} <= cols:
        raise ValueError("Source table must include ra_deg and dec_deg")

    result = []
    for i, row in enumerate(t):
        try:
            ra, dec = float(row["ra_deg"]), float(row["dec_deg"])
            if not all(math.isfinite(v) for v in (ra, dec)):
                continue
        except (TypeError, ValueError):
            continue

        def val(key):
            if key not in cols:
                return None
            v = row[key]
            try:
                if hasattr(v, "mask") and v.mask:
                    return None
                return v.item() if hasattr(v, "item") else v
            except Exception:
                return str(v)

        obj = {
            "detection_id": str(val("detection_id") or val("source_id")
                                or val("candidate_id") or f"row_{i+1}"),
            "ra_deg": ra,
            "dec_deg": dec,
        }
        if val("global_source_id") is not None:
            obj["global_source_id"] = str(val("global_source_id"))
        if val("epoch_id") is not None:
            obj["epoch_id"] = str(val("epoch_id"))
        if val("quality_status") is not None:
            obj["quality_status"] = str(val("quality_status"))
        for col in ("flux_mjy", "flux_error_mjy", "snr", "chi2_reduced"):
            try:
                v = val(col)
                if v is not None and math.isfinite(float(v)):
                    obj[col] = float(v)
            except (TypeError, ValueError):
                pass
        # Raw detector x/y are intentionally not exported as PNG frame_positions.
        # They must be supplied in the final preview-pixel frame separately.
        result.append(obj)
    return result


def convert(spec: dict, *, spec_dir: Path, output_root: Path) -> Path:
    target_id = str(spec.get("target_id", ""))
    if target_id not in TARGET_SLUGS:
        raise ValueError(f"Unknown target_id {target_id!r}; use one of {list(TARGET_SLUGS)}")
    bands = spec.get("bands", {})
    if not isinstance(bands, dict):
        raise ValueError("bands must be an object")

    out_dir = output_root / TARGET_SLUGS[target_id]
    out_dir.mkdir(parents=True, exist_ok=True)
    manifest = {"target_id": target_id, "bands": {}}
    if "center" in spec:
        manifest["center"] = spec["center"]
    if "notice" in spec:
        manifest["notice"] = str(spec["notice"])

    for band, prod in bands.items():
        if band not in ALLOWED_BANDS:
            raise ValueError(f"Invalid band {band}; supported: {sorted(ALLOWED_BANDS)}")
        if not isinstance(prod, dict):
            raise ValueError(f"{band}: expected object")

        result = {"kind": prod.get("kind", "combined" if "+" in band else "single-band")}
        if "label" in prod:
            result["label"] = str(prod["label"])
        if "notice" in prod:
            result["notice"] = str(prod["notice"])

        frames = []
        for j, entry in enumerate(prod.get("frames", []), start=1):
            f = dict(entry)
            val = f.pop("image_file", None)
            hdu = f.pop("hdu", None)
            if val:
                f["image_url"] = asset(str(val), prefix=f"{band}_frame_{j:03d}",
                                       kind="image", base=spec_dir, out_dir=out_dir, ext=hdu)
            elif not f.get("image_url"):
                raise ValueError(f"{band}: frame {j} requires image_file or image_url")
            f["frame_id"] = str(f.get("frame_id") or f"group_{j}")
            f["label"] = str(f.get("label") or f["frame_id"])
            frames.append(f)
        if frames:
            result["frames"] = frames

        diff = prod.get("difference")
        if isinstance(diff, dict):
            diff = dict(diff)
            val = diff.pop("image_file", None)
            hdu = diff.pop("hdu", None)
            if val:
                diff["image_url"] = asset(str(val), prefix=f"{band}_difference",
                                          kind="difference", base=spec_dir,
                                          out_dir=out_dir, ext=hdu)
            if diff.get("image_url"):
                result["difference"] = diff

        for key in ("blink", "overview", "diagnostic"):
            val = prod.get(key + "_file")
            if val:
                result[key + "_url"] = asset(str(val), prefix=f"{band}_{key}",
                                              kind="image", base=spec_dir, out_dir=out_dir)
            elif prod.get(key + "_url"):
                result[key + "_url"] = str(prod[key + "_url"])

        seds = []
        for j, source in enumerate(prod.get("seds", []), start=1):
            out = {"source_id": str(source.get("source_id", j)), "plots": {}}
            for mode, filename in source.get("plots", {}).items():
                if mode not in {"groups", "overlay"}:
                    raise ValueError(f"Unknown SED plot mode: {mode}")
                out["plots"][mode] = asset(str(filename), prefix=f"{band}_sed_{j:03d}_{mode}",
                                            kind="image", base=spec_dir, out_dir=out_dir)
            if out["plots"]:
                seds.append(out)
        if seds:
            result["seds"] = seds

        manifest["bands"][band] = result

    if spec.get("sources_file"):
        manifest["sources"] = catalog_to_sources(str(spec["sources_file"]), spec_dir)
    if isinstance(spec.get("sources"), list):
        manifest["sources"] = spec["sources"]

    file = out_dir / "manifest.json"
    file.write_text(json.dumps(manifest, indent=2, ensure_ascii=False, allow_nan=False),
                    encoding="utf-8")
    return file


def main():
    cli = argparse.ArgumentParser(description=__doc__,
                                  formatter_class=argparse.RawDescriptionHelpFormatter)
    cli.add_argument("--spec", type=Path, required=True, help="Input target product spec JSON")
    cli.add_argument("--output-root", type=Path, default=Path("notebook-results"),
                     help="Output directory under the static website (default: notebook-results)")
    args = cli.parse_args()
    path = args.spec.expanduser().resolve()
    spec = json.loads(path.read_text(encoding="utf-8"))
    generated = convert(spec, spec_dir=path.parent, output_root=args.output_root.resolve())
    print("Generated:", generated)
    print("Deploy this manifest and its assets/ folder to GitHub Pages.")
    print("Note: this script creates previews ONLY and does not validate science calibration.")


if __name__ == "__main__":
    main()
