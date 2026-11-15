# Gaia DR3 Static CSV Cache — Five SPHEREx Fields

This branch contains **actual Gaia DR3 source catalogs** exported via an independently executed GitHub Actions job. The data were not manually fabricated or sampled from random stars.

## Acquisition

- Source: **ARI Gaia DR3 TAP** (`gaiadr3.gaia_source`)
- Workflow: `.github/workflows/build-gaia-csv.yml`
- Script: `tools/fetch_gaia_dr3_fields.py`
- First successful job: https://github.com/jordanzong/UI_hackthon/actions/runs/43696459291
- Retrieved (UTC): 2026-11-15 08:51:42
- Query: 0.20° radius cone, `phot_g_mean_mag < 18.5`, `TOP 2500` per field
- Fields: `source_id, ra, dec, phot_g_mean_mag`
- Position reference: Gaia DR3 ICRS/J2016.0 (proper motion **not** propagated to SPHEREx 2025/26 dates)

| Target | File | Rows | Status |
|---|---|---:|---|
| WISE 0855 | `wise-0855.csv` | 432 | Within row limit |
| Barnard's Star | `barnards-star.csv` | 2,500 | **Truncated** at TOP 2500 |
| Epsilon Indi B | `epsilon-indi-b.csv` | 271 | Within row limit |
| RW Aurigae | `rw-aurigae.csv` | 1,559 | Within row limit |
| R Draconis | `r-draconis.csv` | 236 | Within row limit |
| **Total** | | **4,998** | |

All actual data files live under `catalogs/gaia/`; `manifest.json` records the retrieval time, centers, coverage radius, magnitude limit, service, count and truncation status.

## How the UI uses these files

1. On a Gaia-enabled view with **FOV ≤ 1°**, the Sky Atlas lazily retrieves `catalogs/gaia/manifest.json` from the same GitHub Pages origin.
2. When a downloaded target cone intersects the view, it downloads that target's CSV and validates coordinates and magnitude against the saved manifest.
3. Local Gaia stars are rendered alongside live Gaia stars, deduplicated by `source_id`. They are selectable and searchable.
4. Online Gaia TAP continues to serve other regions / deeper views. If both live TAP services fail, the downloaded local stars **remain on-screen** near their covered target.
5. Gaia stars outside the cached target cones are **not** provided by these CSVs. Large all-sky views continue to use embedded bright stars and optional live Gaia requests.

The browser does not need to upload any CSV. The files are served from the same domain as the UI to avoid *cross-origin fetching for the static cache*. You must preview the branch on GitHub Pages or local HTTP, not by opening `index.html` via `file://`.

### Run again to refresh

In your repository's **Actions** tab, choose **Build Gaia DR3 Offline Catalogs** and select **Run workflow** on `feature/gaia-static-catalogs`. The workflow fetches sources from ARI, ESA, then MAST if the previous provider is unavailable, checks every row and commits only validated results. When a field fails, it does not invent a CSV for that field and reports failure.

## QA

- Choose `feature/gaia-static-catalogs` in the fork's GitHub Pages deploy settings.
- Navigate to **WISE 0855**, center RA 133.789483°, Dec −7.242940°, FOV 0.1°.
- Open browser console, inspect `window.SkyAtlas.getGaiaCatalogStatus()`. The `static_target` should read `WISE_0855` and `static_count` should be at most 432.
- Try Barnard's Star, Epsilon Indi B, RW Aurigae and R Draconis similarly.
- Verify Gaia DR3 checkbox remains ON, Gaia points can be selected, and CSV file requests return 200.
- Test with browser network offline **after files have been cached**; network-free first visits are not guaranteed without an offline service worker.
- Move well away from a target: the previously downloaded Gaia sources must not stay drawn for the wrong field.
- Verify SCIENCE, image Viewer, SED and Source overlays remain functional.

**Important science limitations:** Gaia G magnitude is optical and does not measure SPHEREx infrared flux. Catalog J2016.0 RA/Dec should not be compared as high-precision epoch-2025 positions for high proper-motion stars without propagating Gaia astrometry. The Barnard's Star cone is explicitly limited by the row cap; treat it as a **bright subset**.
