# Real all-sky stars in Sky Atlas (HYG v4.1)

## Purpose

The public sky map supports **FOV 2°–180°**. Previously, only a small hard-coded bright-star list was visible globally; the five committed Gaia DR3 CSVs cover just **0.2° radius** around five SPHEREx targets, and ESA/MAST browser TAP queries can fail.

This branch adds a **real, permanently served all-sky star background** using the HYG v4.1 database. This background is not labelled "Gaia DR3". The five original Gaia CSVs and online Gaia fallback remain unchanged.

## Downloaded and verified datasets

Source: [Astronexus HYG Database v4.1](https://github.com/astronexus/HYG-Database), original `hyg/CURRENT/hygdata_v41.csv`.
License: [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/), attribution to David Nash / Astronexus. Original source file is about 34 MB; our processed derivative files carry this attribution and are also offered under CC BY-SA 4.0.

HYG records have **J2000.0 RA/Dec** and apparent **V-band magnitude**; they must **not** be presented as Gaia G-band photometry. The HYG compilation combines Hipparcos, Yale Bright Star, and Gliese catalog sources.

The GitHub Actions build succeeded: https://github.com/jordanzong/UI_hackthon/actions/runs/43700013354

| Dataset | Real star records | Purpose |
|---|---:|---|
| `catalogs/allsky/bright.json` | 8,920 stars with V ≤ 6.5 | Whole-sky base layer; loaded once |
| 144 files in `catalogs/allsky/tiles/` | 108,067 stars with 6.5 < V ≤ 11.5 | Regional detail; lazily loaded for smaller FOV |
| **Total shown-capable** | **116,987** | Real all-sky background |
| Remaining HYG valid rows not exported | 2,638 | Fainter than the display limit |

`catalogs/allsky/manifest.json` contains the exact version, provenance, licensing, retrieval time, magnitude thresholds, tile centers, and counts.

## Rendering behavior

- FOV **30°–180°**: draw 8,920 whole-sky bright stars (V ≤ 6.5), plus the existing explicit named stars, constellation lines, DSOs, and any other enabled independent layers.
- FOV **24°–30°**: add tiled stars to V ≤ 8.
- FOV **12°–24°**: tiled stars to V ≤ 9.2.
- FOV **5°–12°**: tiled stars to V ≤ 10.3.
- FOV **2°–5°**: tiled stars to V ≤ 11.5.

Tiled stars are divided by 30° of RA and 15° of Dec. The browser downloads **only the tiles intersecting or near the visible view** (bounded concurrent fetches), rather than all 108k faint stars at startup. Tiles are cached in memory for the session. The always-present 8,920-star base file is ~327 KB before HTTP compression.

In the Layer panel there is now a distinct checkbox **「全天 HYG 真實恆星 / All-sky HYG stars」**. When the layer is on, HYG stars can be clicked: Source details identify them by the proper name or HYG ID, and explicitly label their photometry `V`. Proper names and loaded HYG IDs can be searched.

Gaia DR3 remains separate: local Gaia CSVs and TAP stars have Gaia source IDs and `G` magnitudes. A star can be represented in both catalogs; this implementation **does not claim precise crossmatching** between HYG J2000 and Gaia J2016 coordinates. The SPHEREx Source Catalog remains an independent layer as well.

## Preview and QA

1. Deploy `feature/allsky-default-stars` in your Fork's GitHub Pages settings, then hard-refresh.
2. Under Section 06, look for **HYG 全天亮星 8920 筆** and the small credit/license note.
3. With FOV 180°, move to arbitrary RA/Dec away from all five Gaia CSV fields: real HYG bright stars should still be visible.
4. Zoom to FOV 20°, then 2°: confirm tiled faint-star count/status increases and stars appear outside the five Gaia cone locations.
5. Click a newly displayed HYG star: details should show **HYG · V [magnitude]**, not Gaia G.
6. Toggle the HYG layer off and on; stars should disappear/reappear independently of Gaia.
7. Search `Sirius` and `HYG 32263` after HYG is loaded; both should resolve to a real named star.
8. Navigate to WISE 0855 or Barnard's Star: the Gaia DR3 local CSV should still load separately as before.
9. Inspect DevTools Network for `catalogs/allsky/manifest.json`, `bright.json`, and regional `tiles/*.json` (HTTP 200).
10. Test mobile panning/zooming; the browser should not have to load all 144 tiles simultaneously.

## Limitations

- **Full sky coverage does not mean complete Gaia DR3 coverage.** Gaia DR3 has over 1.8 billion published sources and cannot reasonably be embedded in a static browser page. The HYG catalog provides a moderate-density all-sky default, not all faint stars.
- **No physical SPHEREx detections are inferred.** HYG points represent catalogue stars; they are not SPHEREx ePSF measurement sources or infrared fluxes.
- **Proper-motion propagation is not applied** to HYG J2000 positions. For high-PM target comparisons (e.g. Barnard's Star, WISE 0855), use proper motion and an observation epoch before precision source matching.
- **Site performance and browser layout** still require real desktop/mobile browser verification before merging upstream. Syntax, source-count consistency and mocked tile-load flows have been checked.
