# Operations, CI and release safety

## Current branch and release policy

- **Active development branch:** \`feature/science-analysis-runs\`.
- **Default branch:** \`main\` is an earlier snapshot. Do not overwrite or force-push it during routine site maintenance.
- **Other \`feature/*\` branches:** historical experiments kept for audit/reproducibility. A branch should only be deleted after its work and Git SHA are confirmed to be recoverable and no teammate relies on it.
- **GitHub Pages:** verify deployment through the repository's Actions page after each release. Do not equate "pushed" with "deployed".

## GitHub Actions: active

| Workflow | Purpose | How it runs |
| --- | --- | --- |
| \`test-science-runs.yml\` | Python regression tests, syntax, all manifests and real media paths | On relevant pushes or manual |
| \`test-browser-ui.yml\` | Chromium checks: EN visible text, guide, 1× brightness, marked/plain Viewer, Blink | On relevant UI pushes or manual |
| \`publish-science-visuals.yml\` | Rebuilds authentic STACK, Time Grouping and paired GIF Viewer frames for all 45 runs from an approved ZIP | **Manual only** |

Historical workflows (old 36-run, one-off R Draconis import and catalog-build jobs) are preserved under \`docs/history/workflows/\`, not automatically executed by GitHub Actions on the current branch.

**Important:** \`tools/publish_science_visuals.py\` enriches an **already published** complete 45-run manifest set. It does not replace the ingestion of new source catalogs/FITS. If a genuinely new analysis run or revision is needed, validate full import and source IDs first rather than assuming the visual-only script imports it.

## Before changing scientific media

1. Confirm the archive is the intended/current input, with exactly five targets and nine standard bandpass runs per target.
2. Inspect \`science-runs/index.json\` and target/run identities. Preserve original source catalogs and MJD.
3. Keep **both** \`group_stacks_movers_variables.gif\` (annotated) and \`group_stacks_sources_epsf.gif\` (original) from the same run when rebuilding paired Viewer frames.
4. Run \`python3 tools/test_ui_consolidation.py\` and the two CI checks.
5. Use a Git diff/tree comparison to ensure Group PNGs, existing SED and \`catalogs/\` files did not change unintentionally.
6. Confirm both science validation and Pages deployment finish with **Success**. Never silently drop a target because one run's photometry is invalid.

## Developer commands

\`\`\`bash
python3 -m http.server 8765
python3 tools/test_ui_consolidation.py
python3 tools/test_science_run_exporter.py
python3 -m pip install Pillow
python3 tools/test_marked_gif_update.py
python3 tools/test_dedupe_marked_gifs.py
node --check science-run-browser.js
node --check spherex-viewer.js
node --check sky-map-tools.js
\`\`\`

The browser CI requires Node/Playwright and uses \`ubuntu-24.04\` for compatible Chromium setup. Its test file is \`tools/test_ui_browser.mjs\`.

## Common risks

- **Old ZIP:** historical docs refer to \`output.zip\`, 36 runs or R Draconis being withheld. This is not the current release; do not republish it over 45 runs.
- **Stale workflow:** a previous one-time updater may require R Draconis to be absent or may delete unmarked GIFs. Do not re-enable it as-is.
- **Run-scoped IDs:** never join source records across bandpasses by Source ID alone.
- **UI localization:** English visible text must remain free of Chinese after first load and after ZH→EN switching; both languages intentionally exist in the source.
- **Browser caching:** bump JS/CSS query-string versions in \`index.html\` when front-end changes are not appearing.
- **Binary data:** the published image tree is large. Do not rewrite or relocate \`science-runs/\` merely to improve directory appearance.

## Next release

When ready to make the default branch current, open a pull request **from \`feature/science-analysis-runs\` into \`main\`**, review the asset diff and Actions statuses, and merge deliberately. Do not force-update \`main\` or bulk-delete older branches as part of cosmetic cleanup.
