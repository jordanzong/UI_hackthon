# Tooling map

## Current

| Script | Purpose |
| --- | --- |
| \`build_science_run_manifests.py\` | General source \`analysis_runs\` → static per-run manifests; use carefully for future fully verified imports |
| \`publish_science_visuals.py\` | Publish current paired GIF frames + STACK + Time Grouping for already exported runs |
| \`test_ui_consolidation.py\` | Validate all published run links and scientific asset completeness |
| \`test_science_run_exporter.py\` | Synthetic fixtures for the exporter |
| \`test_ui_browser.mjs\` | Playwright UI, language and Viewer regression test |
| \`build_allsky_hyg.py\`, \`fetch_gaia_dr3_fields.py\` | Reproducible catalog generation scripts; active published files under \`catalogs/\` should not be overwritten casually |

## Historical helpers retained for regression/provenance

- \`publish_r_draconis.py\` — original one-time R Draconis import; **not** for current 45-run refresh
- \`update_marked_gifs.py\` — early four-target marked-GIF patch
- \`dedupe_marked_gifs.py\` — old redundant-GIF cleanup; **not** for the current plain/marked pair
- \`inspect_science_visual_assets.py\` — source-ZIP inventory helper
- \`export_spherex_products.py\` — older notebook-era product exporter
- \`test_marked_gif_update.py\`, \`test_dedupe_marked_gifs.py\` — useful synthetic regression tests, even though the associated release workflows are archived

See [current operating instructions](../docs/OPERATIONS.md). Always preserve \`science-runs/\` and \`catalogs/\` during repository maintenance.
