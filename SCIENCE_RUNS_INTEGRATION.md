# SPHEREx Dynamic Science Analysis Runs — Phase 1

The Sky Atlas (HYG + Gaia v2), original Notebook Science Results, and the SPHEREx Image Viewer remain intact. This phase adds **one new dynamic Analysis Runs section inside the SCIENCE panel**. The older built-in WISE 0855 and Epsilon Indi B examples remain available separately; they are not silently substituted for new runs.

## Dataset contract: 5 targets × 9 standard bandpasses

Targets: `WISE_0855`, `Barnards_Star`, `Epsilon_Indi_B`, `RW_Aurigae`, `R_Draconis`.

Standard bandpasses: `D1`, `D2`, `D3`, `D4`, `D5`, `D6`, `D1+D2+D3`, `D4+D5+D6`, `D1+D2+D3+D4+D5+D6`. That is **45 planned target/bandpass combinations**, not necessarily 45 completed analysis runs. Multiple versions, different gap/span values, and experimental combinations such as `D5+D6` are allowed when actually exported.

The backend data structure (as shown in the 2026-11-15 Mac screenshots) is:

```text
6arcmin_spherex_targets/
  Barnards_Star/
    analysis_runs/
      D1_gap10_spaninf_v1/
        time_grouped_stacks.fits
        source_catalog.ecsv
        allbands_epsf_photometry.ecsv
        markers.json                 # output of Final_code, if run
        group_stacks_sources_epsf.gif # or group_stacks_marked.gif
        group_stack_frames/          # optional group_*.png
        sed_plots/
          source_001_group_sed.png
          source_001_sed_evolution.png
      D2_gap10_spaninf_v1/
      ...
      D1_D2_D3_gap10_spaninf_v1/
      D4_D5_D6_gap10_spaninf_v1/
      D1_D2_D3_D4_D5_D6_gap10_spaninf_v1/
  WISE_0855/analysis_runs/...
  Epsilon_Indi_B/analysis_runs/...
  RW_Aurigae/analysis_runs/...
  R_Draconis/analysis_runs/...
```

Exact file availability can differ. A completed run can have only a GIF, only a SED plot, or both.

## Prepare files on the backend Mac

From a checkout of the UI's `feature/science-analysis-runs` branch:

```bash
python3 -m pip install Pillow astropy
python3 tools/build_science_run_manifests.py \
  --input-root "/path/to/NASA_Hackathon/6arcmin_spherex_targets" \
  --output-dir "./science-runs"
```

The exporter automatically:
- Scans the five target directories and recognizes run names, including gap/span/version.
- Writes `science-runs/index.json` listing only run folders actually discovered. Missing target/bandpass pairs stay empty. Never synthesizes an image or Source ID.
- Copies the genuine marked GIF and SED PNG files into `science-runs/<slug>/<run_id>/media/`.
- Uses Pillow, when available, to extract each actual GIF frame into a PNG so the Group selector can show a single frame. If Pillow is absent or `--no-gif-frames` is used, the original marked GIF remains playable.
- Reads `source_catalog.ecsv` to provide source RA/Dec and identifiers.
- Reads `markers.json` from the *same run* for algorithm candidate types `mover`, `variable`, or `known`.
- Reads real Group MJDs and input counts from `time_grouped_stacks.fits` when Astropy is installed. No fake MJD is inserted.
- Generates one `manifest.json` per run; stores identity as `target_id + run_id + band_id`.

`time_grouped_stacks.fits` and the full photometry ECSV are **not copied** into the static public folder by this phase (they may be large and require later calibrated interactive plotting). The manifest records their presence as metadata. A PNG SED is an exported scientific figure, not browser-computed flux.

Commit or otherwise publish **the generated `science-runs/` output directory** alongside `index.html` on GitHub Pages; the website cannot read folders on a teammate's Mac directly. If the output is too large for a GitHub repository/Pages deployment, host media on a controlled static object store and update the URL policy/manifest handling deliberately, rather than embedding enormous files in the website.

## Frontend behavior

A new **ANALYSIS RUNS / NEW BACKEND** panel appears at the top of the existing SCIENCE explorer, with:
1. Target selector.
2. The nine standard Bandpass options (plus exported experimental combinations).
3. Analysis Run selector (multiple versions for the same band).
4. GIF / Group image, per-source SED figure, and **Open Viewer**.
5. Explicit empty state when an expected target/bandpass has not been exported.

The UI validates `target_id`, `run_id`, `band_id` before showing images. Files are served from the same GitHub Pages origin, using relative manifest paths. A Source ID is local to its analysis run: **Source 1 in D1 is not assumed to equal Source 1 in D2 or D1+D2+D3**. Selecting a different run clears the preceding run's SPHEREx sky overlay.

`markers.json` lists **algorithm candidates**; users must not interpret its mover/variable flags as confirmed astronomical identifications. The marked GIF has baked-in labels, so clicking on arbitrary pixels inside it does not yet select the scientific Source. That would require a separate, validated group+pixel mapping.

### Initial publication state

The branch contains an index with all five targets and nine standard bandpasses, but **zero new backend runs** because only Finder screenshots and an example GIF were supplied, not the full `analysis_runs` filesystem. This is intentional: opening SCIENCE shows unavailable products until the actual backend exports are published.

Previously embedded scientific results continue to work through the older Notebook Science Results controls.

## Validation

CI: `Validate Science Analysis Run Exporter` uses local, synthetic **test fixtures only**, checks Python compilation, both exporter integration tests and JavaScript syntax. No mock scientific assets are published.

Manual QA after generating real data:
1. Deploy the branch, open SCIENCE, verify 5 targets and 9 bandpasses even without backend results.
2. Export one real Barnard's Star run, publish `science-runs/`, refresh. Its band/run should appear with the correct GIF, Group selector and SED images.
3. Confirm Source 1 from another run is not reused when switching runs.
4. Change to another target without exported data: no image from Barnard's Star should remain in the Analysis Runs panel.
5. Check Viewer, legacy Notebook Science Results, Gaia/HYG stars, and mobile layout.
6. Check source/candidate categories, Group MJDs and GIF-to-frame order against the *same run*.

## Future feature backlog — explicitly NOT implemented now

- **Astronomy education**: explain classes of variable stars and moving objects, detection biases, and sample interpretation.
- **Simplified/public UI and optional developer mode**: move import/debug/config functions behind an advanced panel; if password-protected access is required, implement real server-side authentication (a password stored in frontend JavaScript is not secure).
- **Onboarding/tutorial**: guide users through Target → Bandpass → Analysis Run → GIF → SED → quality/uncertainty.
- **Arbitrary coordinate detection**: see feasibility below; no live data-processing backend has been deployed in this phase.

## Feasibility of "enter RA/Dec, find nearby special objects"

The uploaded `Fianl_code.zip` has `SPHEREx_auto.ipynb` (coordinate → SPHEREx SIA2 cutouts → time grouping/stacking → source detection → ePSF photometry) and `spherex_mark.py` (`find_targets` → `markers.json` → marked GIF / spectra).

**Immediate, static-site possibility:** build a separate spatial index from **already processed, validated run manifests/markers** and search in a user-defined angular radius around entered RA/Dec. A hit means a candidate **in the precomputed fields**, not a new measurement; no hit may simply mean no coverage.

**True analysis of arbitrary coordinates:** requires an authenticated job backend or queue with Python, Astropy, SciPy, IRSA query/download access, temporary storage, progress tracking, result caching and rate limits. The Github Pages JS frontend cannot execute those Python FITS/ePSF pipelines itself. Failures or lack of epoch coverage must be reported as `insufficient data`, not `no special object`.

In the supplied `spherex_mark.py`, the default mover criteria include **proper motion ≥ 2.5 arcsec/yr**, **PM significance ≥ 5**, **at least four time groups**, plus line-fit and displacement significance filters. The variable test uses per-wavelength ePSF photometry with a group gain × spectral-shape model and thresholds (reduced χ² ≥ 6, amplitude ≥ 0.15, peak significance ≥ 5). These are configurable heuristics and candidates may be blends/artifacts.

The supplied final code does **not** implement a validated classifier for the physical subtypes of variable stars or moving objects. It also does **not** provide a general transient search in the same `find_targets` method. Known targets inserted as forced seeds are not blind detections. For scientific claims, preserve WCS/epoch provenance, instrument flags, coverage, blend/quality status, crossmatching and follow-up verification.

**Recommended release order:** precomputed candidates near already analyzed targets → user-position search with explicit coverage indicator → authenticated background job for new coordinates, starting with a small cutout (not a whole 2°–180° sky field) and bounded processing parameters.
