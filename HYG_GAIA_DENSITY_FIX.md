# HYG tile reliability and FOV 2° star density

This is a separate development branch based on `feature/allsky-default-stars`; it does not alter the upstream teammate's main branch.

## Original reproduction

The user saw `全天星表載入問題：r04_d08: HTTP 503` while later viewing FOV=50°, and much fewer stars in FOV=2° than in the older Gaia-only display.

Source investigation revealed two independent issues:

1. `allsky-stars.js` stored any failing HYG tile in a permanent `failed` set. A single transient HTTP 503 prevented that tile from loading until the page was reloaded. Its last error message was shown globally, including while viewing a different region or at large FOV when that tile was not being used.
2. HYG V≤11.5 is much shallower than Gaia DR3. The original Gaia static CSV covered only a 0.2° radius cone at each of five science targets; in FOV=2° the default Gaia cutoff was G<14, so stars were concentrated in the middle rather than across the visible image.

The source `catalogs/allsky/tiles/r04_d08.json` **exists** in the repository with 929 real stars; the HTTP 503 was a serving failure, not a missing file.

## Implemented

- HYG regional tile downloads: max two concurrent requests, three attempts with exponential backoff; a retry uses no-store to avoid stale failure cache.
- A single failed tile no longer permanently disables the entire layer. Added **Retry HYG** in the science catalog area for exhausted attempts.
- HYG status now refers to the current sky region. If FOV>30°, no tile is active, so an earlier 503 is no longer presented as a current failure. All-sky bright stars remain visible.
- At FOV=2° the Gaia display limit now reaches G=15.5 in Auto mode (not G=14).
- A separate validated wide-field Gaia DR3 export workflow requests **radius 2.1°, G<15.5, max 10,000 sources per target**, for WISE 0855, Barnard's Star, Epsilon Indi B, RW Aurigae and R Draconis. These are original Gaia measurements, not synthetic replacements.
- The Sky Atlas can merge wide + original narrow + online sources by Gaia `source_id` and marks truncated/partial coverage explicitly; if a wide CSV covers the research target, FOV≤3° prioritizes real static sources over browser TAP that has been CORS-blocked.
- UI exposes `window.SkyAtlas.getGaiaCatalogStatus().wide_count` and `window.SkyAtlas.getAllSkyCatalogStatus().active_failed_tiles`.

## Expected coverage and what is NOT guaranteed

A 2.1° radius cone may cover most of a FOV=2° view near its original science target, depending on aspect ratio and view center. It is **not** Gaia all-sky or guaranteed complete coverage when the view is off-center. At FOV=50°, the background is HYG bright stars only (V≤6.5), not full Gaia. Gaia astrometry is J2016.0; the HYG visual catalog is J2000, and they are deliberately separate source collections.

## Verified wide-field CSV acquisition (completed)

The second GitHub Actions run was successful:
https://github.com/jordanzong/UI_hackthon/actions/runs/43703811090

Actual files are in `catalogs/gaia-wide/`:

| Target | Real Gaia DR3 rows | Coverage status |
|---|---:|---|
| WISE 0855 | 10,000 | Hit TOP 10,000 limit |
| Barnard's Star | 10,000 | Hit TOP 10,000 limit |
| Epsilon Indi B | 6,334 | Within query limit |
| RW Aurigae | 10,000 | Hit TOP 10,000 limit |
| R Draconis | 6,062 | Within query limit |
| **Total** | **42,396** | Five cone fields |

The query uses `radius=2.1°`, `phot_g_mean_mag < 15.5`, `TOP 10000` per target and Gaia DR3 J2016.0 coordinates. The three capped fields are **partial** even though all returned rows were validated. The exporter does not create synthetic stars. The older 4,998-row narrow caches remain available independently.

The first Actions run actually downloaded all five CSVs but its push failed because the branch changed concurrently. The workflow now rebases its data commit before pushing; the second run committed all CSVs successfully.

## Manual verification after GitHub Pages deployment

1. Set Pages branch to `feature/allsky-stability-density` and hard-refresh the web page.
2. At any FOV=50°, HYG status must refer to 8,920 globally available bright stars; an old tile HTTP 503 must not appear as the current view error.
3. Navigate to a field near RA 135°, Dec +37.5°, FOV=2°. If any HYG tile temporarily returns 503, it should retry up to three times. Use **Retry HYG** if exhausted.
4. Select WISE 0855, FOV=2°. After wide Gaia export is committed, the panel should show the wider catalog, with visible stars distributed beyond the original 0.2° center circle.
5. Inspect `window.SkyAtlas.getGaiaCatalogStatus()` and `window.SkyAtlas.getAllSkyCatalogStatus()` in browser console. Check Network entries for all-sky tiles and `catalogs/gaia-wide/wise-0855.csv` (HTTP 200).
6. Turn Gaia OFF: HYG all-sky stars should still work. Turn HYG OFF: Gaia should display independently within cached coverage.
7. Confirm FOV remains within **2°–180°**, and SPHEREx Source / SED / Viewer have not changed.
8. At a location far from the five cached science fields, the star background must continue to use real HYG data.

## Tests performed

GitHub source readback and JavaScript syntax check; simulated HYG `HTTP 503` followed by a successful second request (tile loaded, current-view status cleared); test that status at FOV=50° does not show an old tile failure. Full deployed desktop/mobile E2E still needs checking.
