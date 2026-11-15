# Sky Atlas usability improvements (independent of science data)

Branch: `feature/sky-atlas-usability`, based on `feature/multi-target-science-products`.

## Implemented

- **Search by astronomical name / identifier** in a new left-rail Sky Search section. Results are built only from already embedded catalog records (bright stars, deep-sky objects, constellation centers, preset view targets), the five science target *reference coordinates*, and currently loaded Gaia DR3 / SPHEREx IDs. No fake stars or remote name-lookup claims.
- **Click a result to focus** the sky with a sensible FOV; built-in stars/DSOs and loaded sources also populate the selection panel. On phones the sky panel collapses after selection.
- **Gaia view depth**: Auto (existing), Bright (about 3 magnitudes brighter), Deep (up to 2.5 magnitudes fainter; max G=20). Only used at field-of-view ≤ 12°, with a per-query 3000-star cap. The UI does not imply this is a complete Gaia catalog. Offline CSV import remains supported.
- **Stale Gaia-query guard**: responses from an old depth request cannot overwrite a new setting, and completed results from a previous sky region are cached but not rendered over a moved view.
- **Shareable RA/Dec/FOV link**: Copy link captures sky center and angular field. Opening that link in the same page restores the view. This is view navigation only, not FITS download.
- **Respect DSO layer visibility when hit testing**: A deep-sky object hidden by the layer toggle is no longer selectable.

## Manual verification checklist

1. Open `index.html` via GitHub Pages or `python -m http.server 8000`, not `file://`.
2. Search `Sirius`: click result, verify selection shows RA/Dec and centers on the star.
3. Search `M31` or `Andromeda`: deep-sky result should be centered.
4. Search `GJ 699`: science target reference should center near RA 269.45°, Dec +4.69°. Reference coordinate is not a confirmed SPHEREx detection.
5. Search `WISE 0855`, `Epsilon Indi B`, etc. (requires the Notebook Results script loaded).
6. Search `Gaia DR3 123456...` only after a Gaia CSV/TAP catalog has populated real IDs.
7. Hide **Deep-sky objects** and click at a known DSO location: it must not be selected as a DSO while hidden.
8. Zoom to < 12° and toggle Gaia **Auto → Bright → Deep**. Verify data loading and that failures are reported rather than invented. An external TAP service may be blocked by CORS/rate limits.
9. Pan while Gaia is loading; the old field should not be displayed as though it belongs to the new center.
10. Click **Copy view link**, paste into a new tab and verify RA/Dec/FOV restoration. If clipboard access is blocked, an ordinary URL appears for manual copying.
11. Repeat on mobile, including the auto-collapse after target search.
12. Confirm existing SCIENCE / SPHEREx Viewer / Epoch / SED interactions still work.

## APIs

```javascript
window.SkyAtlas.searchObjects("M31", 15);
window.SkyAtlas.focusObject(window.SkyAtlas.searchObjects("Sirius", 1)[0]);
window.SkyAtlas.setGaiaDepth("deep"); // "auto" | "bright" | "deep"
window.SkyAtlas.getGaiaDepth();
window.SkyAtlas.getView();

window.SkyAtlasTools.search("Andromeda");
window.SkyAtlasTools.getViewLink();
```

## Boundaries

- This iteration makes the star atlas easier to navigate; it does **not** add new stars beyond the existing embedded catalog and Gaia queries.
- Gaia TAP can fail, be rate-limited, or return a capped subset. It is not an all-sky/offline star catalog; manual Gaia CSV remains a fallback.
- The Milky Way drawing remains schematic; it is not a calibrated sky survey background.
- Sources from any FITS/SED pipeline are **not** created or remeasured by these controls.
- Full browser E2E testing and deployment QA remain necessary before upstream merge.
