# SPHEREx Drive dataset publishing (2026-11-15)

This feature branch integrates real `analysis_runs` from the team's Google Drive ZIP without claiming that detector/photometric sources are confirmed astronomical movers or variables.

Source archive: https://drive.google.com/drive/folders/1l3bbGPJDf73ew28OsqaV8e7qQuWVw1AI (`output.zip`).

## Data state
- Expected: 5 targets × 9 standard bandpass selections = 45 planned combinations.
- Provided in this archive: 3 targets × 9 runs = **27 runs**:
  WISE_0855, Barnards_Star and Epsilon_Indi_B.
- RW_Aurigae and R_Draconis are still processing.
- All 27 runs include a source-annotated GIF, ECSV catalogs, FITS stacks and SED PNG plots. The `markers.json` classifier output and specifically candidate-marked GIFs are **not yet available**.
- Bandpass `D1` etc selects the **time grouping/stacking analysis**; `allbands_epsf_photometry.ecsv` can still carry **D1–D6 photometry** for its SED. Source IDs remain scoped to individual runs.
- WISE 0855 download manifest shows seven HTTP 503 failures; do not infer complete coverage or claim no detections from gaps.

## Publication

The GitHub Actions workflow `Publish Real SPHEREx Science Runs` is triggered by exporter/workflow changes on `feature/science-analysis-runs`, and can also be dispatched manually when visible/enabled. It downloads the supplied ZIP with `gdown`, validates its paths, then runs:

```bash
python3 tools/build_science_run_manifests.py \
  --input-root /tmp/spherex-science/unpacked/output \
  --output-dir ./science-runs \
  --no-gif-frames
```

Each generated manifest includes exact `target_id + run_id + band_id`, catalog positions, genuine FITS group MJDs, media links and empty candidate labels when markers are absent. Original GIFs are published; Group PNGs are copied; SED PNGs are encoded as more compact WebP for browser delivery. There is **no synthetic photometric content**.

This workflow requires the linked Drive ZIP to be anonymously downloadable by `gdown` (shared-folder access in ChatGPT does not itself grant GitHub Actions permissions), and GitHub Actions permission to push generated assets. If either condition fails, upload/publish the assets through another authenticated route. Do not mark a run as published unless all its referenced files exist.

For future ZIP updates, rerun the workflow with the new Drive file ID; published media reflect the chosen archive's content. The site still needs to be deployed from this feature branch or merged through the team's standard release flow.

## Marker GIF integration

The exporter now prefers `*marked*.gif` over `*sources_epsf*.gif` in the **same run**, and reads the matching `markers.json` if supplied. The UI distinguishes algorithm-candidate markers from numbered source circles. **Neither is a confirmed astrophysical classification.**
