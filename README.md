# SPHEREx Sky Atlas & Science Results

A static, browser-based sky atlas and SPHEREx science-result viewer for the NASA Space Apps hackathon project. The site uses published scientific outputs: it does **not** invent astronomical observations or process arbitrary sky coordinates through a live FITS backend.

> **Current working/release branch:** [`feature/science-analysis-runs`](https://github.com/jordanzong/UI_hackthon/tree/feature/science-analysis-runs). The repository default `main` is an earlier snapshot; **do not assume it contains the latest site or 45 science runs**. Review and merge intentionally when ready.

## What you can do

- Explore the sky by **RA/Dec**, drag/pan, and set FOV from **0.2° to 180°**.
- Search built-in objects and inspect genuine **HYG** and **Gaia DR3** catalog layers (subject to coverage and provider limits).
- Browse **5 targets × 9 analysis runs = 45 published science runs**:
  **WISE 0855**, **Barnard's Star**, **Epsilon Indi B**, **RW Aurigae**, **R Draconis**.
- Switch between **GIF / Group**, **STACK**, **SED**, and **Time Grouping**.
- Open the **SPHEREx Observation Viewer**, with **Prev / Blink / Next**, original vs annotated GIFs, brightness starting at **1×**, and an astronomy reading panel.
- Use **HOW TO USE** for an interactive guide; **EN** is the first-visit default, with an optional **ZH** interface.

**Science caveats:** A marked GIF contains **algorithm-generated candidate annotations**; these are not independently confirmed object classifications. Source IDs belong to individual analysis runs (Source 1 in D1 is not automatically Source 1 in D2). Display brightness does not modify photometry.

## Run locally

No frontend build system is required. Serve the repository root over HTTP (rather than opening `index.html` via `file://`, which can block data requests):

```bash
python3 -m http.server 8765
```

Open `http://localhost:8765/` in your browser.

### Repository map

| Location | Role |
| --- | --- |
| `index.html` | Sky atlas, language selection and page layout |
| `science-run-browser.js/.css` | Science Results navigation and figures |
| `spherex-viewer.js/.css` | Observation Viewer and marked/plain animation controls |
| `sky-map-tools.js/.css` | Sky search, presets and view sharing |
| `user-guide.js/.css` | Interactive EN/ZH walkthrough |
| `allsky-stars.js` | HYG all-sky catalog layer |
| `science-runs/` | **Published per-target/per-run science assets and manifests** |
| `catalogs/` | Real HYG/Gaia catalog data and index files |
| `tools/` | Dataset generation, validation and older recovery utilities |
| `.github/workflows/` | Current test and deliberately triggered science publication workflows |
| `docs/` | Current architecture, operations and historical development notes |

For details, see the [documentation index](docs/README.md), [architecture](docs/ARCHITECTURE.md), and [maintenance guide](docs/OPERATIONS.md).

## Scientific dataset contract

Read `science-runs/index.json` first. It declares the five targets, nine bandpasses and each available run's `manifest_url`. Every run is independent. A run manifest contains source coordinates and references to available observation images, SED figures, STACK, Time Grouping Diagnostic and animation frames. Image references are **relative to the run manifest**.

- **Original Group images:** remain intact in `frames`.
- **Marked GIF / Viewer frames:** `blink_url`, `viewer_frames`.
- **Original GIF / Viewer frames:** `unmarked_blink_url`, `plain_viewer_frames`.
- **Other visual products:** `stack_url`, `diagnostic_url`, `seds`.

Do **not** rename scientific media, merge Source IDs across runs or move `science-runs/` without updating and validating every manifest link.

## Testing

```bash
python3 tools/test_ui_consolidation.py
python3 tools/test_science_run_exporter.py
python3 -m pip install Pillow
python3 tools/test_marked_gif_update.py
python3 tools/test_dedupe_marked_gifs.py
node --check science-run-browser.js
node --check spherex-viewer.js
node --check sky-map-tools.js
```

The [browser CI](.github/workflows/test-browser-ui.yml) additionally checks EN-only visible text, the guide, brightness, animated controls and the marked/original GIF switch with Chromium. The [science CI](.github/workflows/test-science-runs.yml) validates published assets and regression fixtures.

## Updating scientific data

The current [science visual publication workflow](.github/workflows/publish-science-visuals.yml) is **manual-only**. Use a vetted ZIP with the proper **five-target** outputs; read [operations](docs/OPERATIONS.md) before running it. The data directory is not a scratch area, and historical single-target or 36-run scripts must not overwrite the published 45-run set.

**Branch policy:** make reviewed changes on `feature/science-analysis-runs`; keep `main` unchanged until a deliberate merge. Historical feature branches are retained for reproducibility, not recommended as deployment sources.

## Data provenance

HYG: Astronexus HYG v4.1 ([source](https://github.com/astronexus/HYG-Database), CC BY-SA 4.0). Gaia DR3: Gaia science archive / published cached extracts. SPHEREx analyses: team-generated, real scientific outputs; only web-friendly image derivatives are shipped, not a claim of live FITS processing.

---

**中文簡述：** 本專案已整合 5 個研究目標、45 組 Science Run，以及 Viewer 的標記／原始 GIF 切換。網頁首次開啟預設英文。更新資料前請先閱讀 [維護說明](docs/OPERATIONS.md)；正式資料不可因整理目錄而移動或刪除。
