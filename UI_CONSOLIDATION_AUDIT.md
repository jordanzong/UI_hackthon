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
