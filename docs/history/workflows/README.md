# Archived GitHub Actions workflows

This directory holds **historical, non-active workflow YAMLs**. They were moved from `.github/workflows/` on `feature/science-analysis-runs` because they target old feature branches, one-off 36-run/R Draconis publication stages, or destructive GIF cleanup incompatible with the current paired animation release.

The files are preserved verbatim for traceability. GitHub Actions only discovers workflows from the recognized `.github/workflows/` location, so these archived copies **do not run** on push or manual dispatch.

Do not move them back or run them without revising the target branch, source ZIP, 45-run checks and preservation rules.

- `build-allsky-hyg.yml` — original HYG catalog build branch.
- `build-gaia-csv.yml` — original five-field Gaia extract branch.
- `build-gaia-wide.yml` — original wide-field Gaia branch.
- `dedupe-marked-gifs.yml` — obsolete unmarked GIF cleanup; plain animation is now needed.
- `inspect-science-visual-assets.yml` — one-time source archive asset inventory.
- `publish-r-draconis.yml` — one-off correction import now completed.
- `publish-spherex-data.yml` — **unsafe old output.zip full overwrite**; do not reuse as-is.
- `update-marked-gifs.yml` — obsolete four-target/36-run updater; current release has five targets.
