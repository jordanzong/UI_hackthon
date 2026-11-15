# Automatic Gaia DR3 and SPHEREx Source Catalogs

The public-facing Sky Atlas no longer asks visitors to upload a Gaia CSV or SPHEREx CSV/JSON. Import controls are retained only under **Advanced: import custom catalogs (developer testing)**.

## What loads automatically

**Gaia DR3:**
- The map already queries Gaia TAP in the browser when Gaia is enabled and the view's FOV is **at most 12 degrees**.
- The toolbar provides **Refresh Gaia**, and Sky Atlas tools provide Auto/Bright/Deep density presets.
- The sky still has the embedded bright-star catalog when online Gaia is unavailable or the FOV exceeds 12 degrees.
- Gaia network requests remain subject to CORS, rate limits and the 3,000-star-per-query limit; this is not the complete Gaia DR3 catalog and cannot be guaranteed offline.

**SPHEREx:**
- Changing the notebook Science Target automatically updates the SPHEREx layer from that target's verified `sources` array.
- When a target manifest loads, the sky source layer is refreshed immediately with those sources.
- Switching targets empties the previous target's Source overlay rather than mixing unrelated field detections.
- When no Source Catalog exists, the status explicitly says **No verified Source Catalog for selected target**. It does not create detections from target reference coordinates, SED plots, or download counts.

### How teammates provide catalog data

Place validated data in the existing per-target product file:

```text
notebook-results/
  wise-0855/manifest.json
  barnards-star/manifest.json
  epsilon-indi-b/manifest.json
  rw-aurigae/manifest.json
  r-draconis/manifest.json
```

The existing `tools/export_spherex_products.py` accepts a validated `sources_file` in ECSV format and embeds the resulting source records under `sources` in `manifest.json`. Full product instructions are in [MULTI_TARGET_SCIENCE_EXPORT.md](MULTI_TARGET_SCIENCE_EXPORT.md).

Required minimum per source: **RA and Dec in decimal degrees**. Useful optional fields include a real `source_id` or `detection_id`, `quality_status`, `epoch_id`, `wavelength_um`, `snr`, and `chi2_reduced`. Only genuinely calibrated `flux_mjy` data should use that name. Do not confuse detector image pixels with sky coordinates; sky overlays use RA/Dec while Viewer image markers need separate validated `frame_positions`.

The manifest's `target_id` must match the selected target and the team should not use cross-epoch source IDs until association has been verified.

## Runtime flow

```text
Sky Atlas opens
  ├── built-in bright stars appear at all views
  └── Gaia DR3 auto-loads if Gaia is on and FOV ≤ 12°
Science Target selected
  ├── clear any old target's SPHEREx Source overlay
  ├── read notebook-results/<target-slug>/manifest.json
  │    ├── real sources[] supplied → draw SPHEREx source markers
  │    └── absent sources[] / HTTP 404 → show an explicit unavailable state
  └── keep WISE 0855 SED / Epsilon Indi B visualizations from their already saved data
```

## Manual verification

1. Open the `feature/auto-catalog-loading` branch via local HTTP or GitHub Pages.
2. At FOV > 12°, verify existing bright stars display, Gaia says to zoom in, and no CSV is required.
3. Zoom to FOV ≤ 12°, and check Gaia query status and stars. If the TAP endpoint blocks browser access, expect a failure message; this is not a fallback to invented stars.
4. Check section 06: the main area shows **automatic catalog status** and **Refresh Gaia**. Import buttons are only visible after expanding **Advanced**.
5. Select Epsilon Indi B, WISE 0855 and Barnard's Star. In the absence of manifests with verified `sources`, the source overlay should be empty and show a missing-data message.
6. Test by loading a real `manifest.json` with valid source positions, then verify the source count, selection, and sky marker positions.
7. Switch targets: markers from the previous target must disappear. Switching back should reload its stored manifest.
8. Verify existing SCIENCE / Viewer / Epoch / SED and Sky Search remain operational.

Browser end-to-end and live TAP behavior need verification before merging.

## Programmatic API

```javascript
window.SPHERExCatalog.getState();
// {count, target_id, origin}
window.SPHERExNotebookResults.selectTarget('WISE_0855');
await window.SPHERExNotebookResults.loadManifest(
  './notebook-results/wise-0855/manifest.json', 'WISE_0855'
);
```

The existing `SPHERExCatalog.setSources()` and import controls are still available to the team as developer overrides. Switching Science Target restores that target's manifest-driven catalog.
