# SPHEREx UI consolidation — 2026-11-15

## Navigation
The sky atlas control panel uses unified numbered sections:
1. **Coordinates + selected sky object** (previous 01 + 03)
2. **Sky search + genuine built-in presets** (previous 02 + 04)
3. **Science Results** (previous 05 Notebook Results + Analysis Runs)
4. **Sky layers**
5. **Automatic real Gaia/HYG/SPHEREx catalog controls**

Science Results reads only `science-runs/index.json` and the referenced per-run manifests and media. Target reference coordinates are not detections. Source IDs are strictly local to a run.

## Removed obsolete material
The former embedded DR1 WISE 0855 example, hard-coded notebook SED/GIF previews, old Notebook Results panel/module, demonstration/test HTML pages, and example product JSON are deleted from the deployed repository. The old data are intentionally **not** silently substituted for missing run assets.

**Preserved:** all genuine `science-runs/` analysis products, 36 ready runs for WISE_0855, Barnards_Star, Epsilon_Indi_B, RW_Aurigae; R_Draconis remains `photometry_under_revision`. All `catalogs/allsky/`, `catalogs/gaia/`, and `catalogs/gaia-wide/` files remain unchanged.

## Viewer
The SPHEREx Observation Viewer is now a large science-image viewing area. It is populated by the unified Science Results panel through `window.SPHERExViewer.setData`. Removed manual image/JSON import, arbitrary manifest URL loader and legacy demo. It retains Blink, epoch navigation, Difference only when validated images exist, display brightness and validated per-frame source marker positions.

## Data safety
`tools/test_ui_consolidation.py` validates all published manifests and referenced media exist, checks 36 current runs and zero R Draconis runs, ensures obsolete deployed assets/scripts are gone, and confirms genuine Gaia/HYG manifests remain in the repository. Compare Git trees before and after to verify the actual scientific assets' SHA values are identical.

## 2026-11-15 Viewer + live sky split

- Updated selected-object action buttons to use the same Mission Control primary/secondary button classes as Go / Read View Center.
- Docked the Viewer beside the actual sky canvas rather than covering it. For desktop the sky and published FITS-stack preview are side by side; for narrow mobile screens they share the page vertically.
- The Viewer `setData` center is the chosen run's known **target reference coordinate**. On opening Viewer, the atlas is focused to RA/Dec and draws its existing genuine target-selection reticle. The new sky-context label explicitly disclaims that a coordinate implies a detection.
- Moved brightness from horizontal toolbar to a vertical rail on the right of the image. This changes only the rendered image filter, never the photometry data.
- No modifications to `science-runs/` or `catalogs/` are needed.

## 2026-11-15 Science Results position and 0.2° FOV
- Science Results is the first section (01), ahead of manual coordinate navigation and sky search.
- SED default per newly selected run is **Epoch-to-epoch evolution**, while By time group remains selectable.
- All FOV input validation, zoom and programmatic navigation clamps now use the range **0.2°–180°** (0.2° = 12 arcmin); Gaia/HYG content remains real catalog data, not interpolated SPHEREx detections.

## 2026-11-15 Follow-up: remove duplicate Target search and GIF copies

- Removed the redundant target search input and its handlers from 01 Science Results; retained target dropdown, RA/Dec and the independent atlas object search.
- Every published Run already uses `media/group_stacks_marked.gif` as its animated view. `tools/dedupe_marked_gifs.py` verifies matching animation frame counts and complete decoding (marked layouts may have different canvas dimensions) across all 36 published Runs before deleting only the old unmarked GIFs.
- Any frame-count mismatch or unreadable GIF causes an all-or-nothing failure, leaving the originals intact.
- New importer prefers `group_stacks_movers_variables.gif` from the scientific pipeline and publishes it using the canonical marked filename without additionally publishing a duplicate original.

- The older ZIP-based full data importer is manual-only to prevent accidental replacement of the newly published marked animations by stale ZIPs.

- Cleaned all 36 redundant unmarked GIFs in verified data commit 49283d23; exactly 36 canonical marked GIFs remain, with science measurements unchanged.
- Updated Science Results JS/CSS query versions to 6 so browser caches do not retain the old Target search field.

## Updated Run visualization (new_output.zip)
- Verified all 36 runs contain original `time_grouping_diagnostic.png`, `group_stacks_sources_epsf.png` and `group_stacks_movers_variables.gif` (2026-11-15 inspection).
- Published 36 source Stack PNGs and 36 diagnostic PNGs directly from those runs, with no synthetic figures.
- Extracted marked GIF frames as lossless WebP into a **separate** `media/viewer_marked_frames/` path; original `media/group_frames/` and every SED are untouched.
- Science Results tabs: GIF / Group, STACK, SED, Time Grouping. Open Viewer uses `viewer_frames` only, with Prev / Next and duration-aware Blink.
- Per-run manifests record the original Group MJD and marked Viewer frame source. The new CI audit verifies all 36 published assets and all original science data paths.
