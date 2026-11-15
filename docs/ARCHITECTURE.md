# Architecture and scientific data contracts

## Browser architecture

The project is a static HTML/CSS/JS site, with no production backend. The browser loads manifest JSON and published image derivatives:

1. \`index.html\` handles the sky canvas, coordinates and language switching.
2. \`sky-map-tools.js\` provides search and view sharing. HYG/Gaia catalog loaders fetch real catalog records under \`catalogs/\`.
3. \`science-run-browser.js\` reads \`science-runs/index.json\`, then loads a specific \`manifest_url\` for the chosen target, band and run.
4. \`spherex-viewer.js\` receives one run's pre-published marked/plain frames and supports epoch navigation and Blink. It does **not** infer source pixel positions when the science data lack them.
5. \`user-guide.js\` provides an EN/ZH user walkthrough; EN is default on first visit.

The web interface does **not** retrieve fresh arbitrary-coordinate FITS on demand or perform backend calibration. Those tasks belong to the external science pipeline.

## Paths and inventory

\`\`\`text
science-runs/
  index.json
  wise-0855/
  barnards-star/
  epsilon-indi-b/
  rw-aurigae/
  r-draconis/
    <run-id>/
      manifest.json
      media/
        group_stacks_marked.gif
        group_stacks_plain.gif
        group_stacks_sources_epsf.png
        time_grouping_diagnostic.png
        viewer_marked_frames/group_001.webp
        viewer_plain_frames/plain_001.webp
        ...
\`\`\`

A run name such as \`D1_gap10_spaninf_v1\` identifies a specific band grouping and reduction configuration. Supported band choices:

\`D1, D2, D3, D4, D5, D6, D1+D2+D3, D4+D5+D6, D1+D2+D3+D4+D5+D6\`.

Current index: **45 available runs** across five targets. Each run's local \`source_id\` is scoped to that run. Never merge measurements by \`source_id\` alone.

### Manifest fields used by the website

| Field | Meaning |
| --- | --- |
| \`target_id\`, \`run_id\`, \`band_id\` | Exact identity used to prevent cross-run asset mixing |
| \`sources\`, \`seds\` | Measured source metadata / referenced SED plots |
| \`bands[band_id].frames\` | **Original** individual Group PNGs, with Group and MJD metadata |
| \`bands[band_id].blink_url\` | Algorithm-annotated GIF |
| \`bands[band_id].viewer_frames\` | Individual frames extracted from the annotated GIF |
| \`bands[band_id].unmarked_blink_url\` | Original unannotated GIF |
| \`bands[band_id].plain_viewer_frames\` | Individual frames extracted from the original GIF |
| \`bands[band_id].stack_url\` | Original STACK overview PNG |
| \`bands[band_id].diagnostic_url\` | Original Time Grouping Diagnostic PNG |

All \`media/…\` URLs are relative to that run's manifest directory. Blink, Prev and Next navigate the extracted frames using their original ordering and duration. A checkbox switches between annotated/plain frames at the same epoch.

## Scientific integrity rules

- Preserve the original Group images, SED and HYG/Gaia catalogs byte-for-byte during UI changes.
- Do not interpret candidate mover/variable annotations as confirmed identifications.
- Do not fabricate source positions, MJD times, photometry, FITS observations or visuals.
- Never publish a mixed ZIP without validating exact target/run/band identities and corresponding Group frame counts.
- If the source pipeline needs a new capability (e.g. arbitrary RA/Dec), implement it as a separate backend rather than claiming the static site already performs that operation.

The project includes real downloadable image products, but heavy FITS/photometry calculations are performed upstream, not in the browser.
