# Gaia TAP failure versus five cached Gaia CSV files

This branch addresses the screenshot where both ESA and MAST display **browser network/CORS blocked or service unreachable**. That message applies to external browser TAP requests; it does not itself indicate a failed same-origin CSV download.

## Verified data and deployment

Five real Gaia DR3 CSV files remain in `catalogs/gaia/` with 4,998 records across WISE 0855, Barnard's Star, Epsilon Indi B, RW Aurigae and R Draconis. The catalog acquisition GitHub Actions job completed successfully.

The static caches cover **five cones of radius 0.2° only**, at Gaia DR3 epoch J2016.0 with `G < 18.5`. The 2,500-row Barnard's Star CSV is incomplete (query result hit TOP cap). They are not a complete Gaia sky catalog.

## Improvements

1. The catalog panel now has a **Gaia CSV target picker** populated from the real manifest. Select a target and click **Go** to center near that cache, at FOV=2°.
2. The manifest loads at page startup, instead of waiting for a view inside a narrow target cone.
3. The panel clearly states whether the cache is loading, the current view is outside the cached fields, a CSV is being loaded, or a cached field has real points.
4. If a CSV **completely covers the current view and requested magnitude limit** (and has not hit TOP row cap), the atlas uses its contents without sending unnecessary direct browser TAP queries. This avoids CORS errors when offline data are sufficient.
5. Outside complete cached coverage, live ESA/MAST attempts are retained; any browser network/CORS error is still reported.
6. A complete local cache suppresses the alarming red failure state while points are displayed; diagnostics remain available if no local fallback exists.

## How to verify

1. Deploy branch `feature/gaia-cache-status` from the Fork's GitHub Pages settings.
2. Force-refresh with Ctrl+Shift+R.
3. Open Section 06; you should see **Gaia CSV：前往已快取天區**, a five-target selection menu, and status text. If not, the older branch/page is running.
4. Select WISE 0855 and click Go. The sky should center near (133.789483°, −7.242940°) at FOV 2°.
5. Watch for "WISE 0855: 432 筆真實 Gaia 星點". Note that 432 is the entire downloaded 0.2° cone; only sources inside the visible canvas are drawn.
6. In DevTools → Console, inspect:
   ```javascript
   window.SkyAtlas.getGaiaCatalogStatus()
   ```
   The `static_count` should be 432, `static_target` should be `WISE_0855`, and `static_manifest_loaded` true.
7. In DevTools → Network verify `catalogs/gaia/manifest.json` and `catalogs/gaia/wise-0855.csv` respond HTTP 200.
8. Use FOV between 2° and 12°: a nearby 0.2° Gaia CSV cone can appear as a **small partial subset**, not coverage of the whole 2°–12° field. For FOV >12°, the atlas uses its built-in bright stars and DSOs; live Gaia TAP is not queried.
9. Test Barnard's Star. Its 2,500 rows are a **truncated subset** and live TAP may still be attempted to supplement it.

If a cached field still fails, share the `getGaiaCatalogStatus()` object and any HTTP error for the manifest or CSV. A static file error is different from the ESA/MAST CORS problem.

**QA:** JavaScript parses, real manifest and files exist on GitHub, and coverage logic was tested against each field's radius, magnitude cutoff and truncation metadata. Browser end-to-end tests are still pending.


**FOV rule (2026-11-15):** The Sky Atlas allows 2°–180° only. All manual entries, links, target buttons and navigation are clamped/validated accordingly; a 0.2° **catalog footprint** is NOT a 0.2° user FOV. The static CSV may be drawn within a larger 2°–12° view, with explicit partial-coverage messaging.
