# Notebook Results Explorer — All_Band (1).ipynb

This branch adds an interactive **Notebook Science Results** section to the Mission Control sky atlas.

## User interactions

- Search five included names and aliases: WISE 0855, Barnard's Star (GJ 699), Epsilon Indi B, RW Aurigae, R Draconis
- Enter decimal RA and Dec to navigate the sky atlas (arbitrary coordinates; no fabricated SPHEREx frame)
- Select SPHEREx D1–D6, all-band summary, or the D5+D6 combined stack
- For Epsilon Indi B: select seven observation groups, show the original 7-frame Blink GIF, and open groups in the SPHEREx Viewer
- For WISE 0855: browse saved Source 1–3 time-group and overlay SED figures; click **View original full-size figure**

## Source materials

**Exactly nine media assets** extracted from Notebook execution outputs; no simulated source flux or image pixels:

- `notebook-results/epsilon-indi-b/stack-overview.png` — Cell B seven-group stack overview
- `notebook-results/epsilon-indi-b/grouping-diagnostic.png` — Cell B1 MJD grouping
- `notebook-results/epsilon-indi-b/epoch-blink.gif` — Cell B2, seven 900×900 frames at 900 ms/frame
- `notebook-results/wise-0855/source-{01,02,03}-{groups,overlay}.png` — Cell E six saved SED figures

Counts displayed are **saved notebook logs**, not newly executed experiments:

| Target | D1 | D2 | D3 | D4 | D5 | D6 | Valid / total |
|---|---:|---:|---:|---:|---:|---:|---:|
| WISE 0855 | 35 | 48 | 45 | 36 | 48 | 45 | 257 / 258 |
| Barnard's Star | 59 | 61 | 59 | 60 | 62 | 59 | 360 / 363 |
| Epsilon Indi B | 48 | 93 | 99 | 45 | 84 | 96 | 465 / 465 |
| RW Aurigae | 56 | 55 | 56 | 56 | 56 | 56 | 335 / 335 |
| R Draconis | 581 | 88 | 550 | 578 | 89 | 573 | 2,459 / 2,493 |

Epsilon Indi B D5+D6 groups: stack image counts 41, 1, 15, 36, 10, 17, 60. Matched photometry image counts 91, 2, 31, 108, 24, 44, 120.

The saved Source Detection logs list 216 detections matched into 55 sources across **10 groups**, and the saved SED figures display **12 groups**; the current Epsilon Indi B stack output has **seven groups**. Though the user reports these outputs are part of the same analysis, these different saved cell states must not be equated as the same target/epoch image stack without the original FITS/ECSV and association tables. This UI keeps WISE 0855 SEDs separate from Epsilon Indi B images.

## Important scientific guards

1. A D5 or D6 selection displays the **combined D5+D6 stack** with an explicit label; it is *not* an independent D5 or D6 image. Individual-band image previews for D1–D6 are not embedded.
2. Changing band on a saved SED changes observation counts; it does **not** crop the original full-spectrum chart or invent individual-band photometry.
3. Notebook contains no complete 55-row source table, no 10,280-row photometry ECSV, no PNG WCS/corresponding per-source `frame_positions`. Consequently, no new sky or image source-marker associations are invented.
4. Group 2 is based on only one stack input.
5. Seven GIF frames can be individually decoded with the browser's WebCodecs `ImageDecoder`. Without this API the UI falls back to the original animated GIF, so per-group still-frame selection requires a compatible browser.
6. The frontend remains a static GitHub Pages application. It does not perform FITS reduction or remote target-name resolution.

## Hooks

```js
window.SPHERExNotebookResults.selectTarget('Epsilon_Indi_B');
window.SPHERExNotebookResults.selectBand('D5+D6');
window.SPHERExNotebookResults.navigate(331.04414659, -56.78284420);
window.SPHERExNotebookResults.current();
```

Original backend Manifest integration remains available through `window.SPHERExViewer.setData(manifest)` or `loadFromUrl(url)`.

## Validation

- All nine committed assets verified at repository paths.
- New JS and original sky-atlas and Viewer JS parse successfully.
- Static data counts and Group MJD values cross-checked with saved Notebook output.
- Live browser rendering, GitHub Pages deployment, source marker back-end registration, and WebCodecs compatibility on other browsers remain to be tested.
