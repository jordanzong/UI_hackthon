# Three targets published: ordinary GIF now, marker GIF later

This branch follows the user's 2026-11-15 clarification: **the shared `output.zip` already has one ordinary GIF per Analysis Run. The separate special-object marker GIFs are STILL BEING GENERATED.** Do not treat `group_stacks_sources_epsf.gif` as a completed special-object marker GIF just because of its filename.

## Verified upload

Google Drive shared folder: https://drive.google.com/drive/folders/1l3bbGPJDf73ew28OsqaV8e7qQuWVw1AI

Source archive: `output.zip`, Drive ID `1e0cN8dgP3J7ONuub_wMk5FFi2rGRo_go` (292,428,660 bytes). The real source folders are `output/<target>/analysis_runs/<run_id>/`.

The whole ZIP was validated and the following were successfully published under `science-runs/` using GitHub Actions:
- Real download and publish job: https://github.com/jordanzong/UI_hackthon/actions/runs/43712139053
- Automated integrity tests: https://github.com/jordanzong/UI_hackthon/actions/runs/43712393325

| Target | Analysis Runs | Ordinary GIF | Native Group PNG | SED PNG | Run Sources (summed) |
|---|---:|---:|---:|---:|---:|
| WISE 0855 | 9 | 9 | 34 | 716 | 358 |
| Barnard's Star | 9 | 9 | 49 | 730 | 365 |
| Epsilon Indi B | 9 | 9 | 53 | 464 | 232 |
| RW Aurigae | 0 (processing) | 0 | 0 | 0 | — |
| R Draconis | 0 (processing) | 0 | 0 | 0 | — |
| **Total** | **27** | **27** | **136** | **1,910** | **955 across runs** |

The 955 source entries are summed across different Runs; they are **not 955 unique astrophysical objects**. Another 27 Group Overview PNGs and 27 time-grouping diagnostic PNGs are present.

Each completed run's published manifest also includes:
- Actual run identity (`target_id`, `band_id`, `run_id`, gap/span/version)
- Group IDs, MJD boundaries and NINPUT from real stack FITS headers
- Source Catalog source IDs with RA/Dec and other available measurement metadata
- All SED plots, linked to source IDs for the **same** Run
- `animation_url`: a real ordinary GIF
- `marked_gif_url: null` and `marker_gif_status: "pending"` until a distinct marked file is supplied
- Group stack PNG frames, overview PNG and diagnostic PNG

**The public folder does NOT expose the raw FITS or complete photometry ECSV in this phase.** These exist in the source ZIP, but their presence is recorded in the manifest instead of copying those heavy scientific files.

## UI

Deploy `feature/science-three-targets-gif-staged` to GitHub Pages and force refresh. Open **SCIENCE → ANALYSIS RUNS / NEW BACKEND**. The interface offers:
- Target → nine standard Bandpasses → Analysis Run selector
- Group Stack, Ordinary GIF, Marker GIF (disabled / pending), SED and Open Viewer
- Individual Group frame, actual MJD (when available), and 2 PNG SED types per Source ID
- Two incomplete targets listed without substitute data
- No extrapolation between the same Source ID across target/band/run

The older Notebook Science Results and the stable Gaia/HYG sky layers are preserved.

## How the Marker GIF will work when ready

Export a **distinct** file named with `marked` or `marker` in the basename, for example:

```text
output/WISE_0855/analysis_runs/D1_gap10_spaninf_v1/
  group_stacks_sources_epsf.gif   # existing ordinary animation
  group_stacks_marked.gif         # NEW confirmed special-source marker animation
```

The exporter will assign `marked_gif_url` only to the separately named marked GIF. On re-export, the UI automatically enables the **Marker GIF** tab. For physically reliable click-to-select annotations, publish corresponding verified group/source pixel coordinates and WCS metadata separately; a baked-in GIF image does not supply that mapping.

### Refresh shared Drive ZIP

The GitHub workflow `Publish SPHEREx Three-Target Science Results` downloads from the shared archive's **file ID**. If the team uploads a replacement as a *new* Drive file, update the ID in `.github/workflows/publish-three-targets.yml`. If the existing file is updated in place, rerun the workflow. It validates that the current three targets contain nine runs each. When adding the two remaining targets, update that completion contract rather than mixing in placeholders.

## Scientific caution

- These are real ePSF/source products from the team, not verified celestial classifications.
- A name like "source_001" identifies a source **within a given run**, not across multiple run configurations.
- The GIF may show ePSF detections/IDs; this does **not** establish that special-object marker analysis is complete.
- Absence of `markers.json` or marked GIF must not be reported as a negative search for variable/moving objects.
- Dates and units come from actual FITS headers / SED plot contents; do not invent classifications, uncertainties, or flux calibration claims.

For exporter usage and the broader pipeline, see `SCIENCE_RUNS_INTEGRATION.md`.
