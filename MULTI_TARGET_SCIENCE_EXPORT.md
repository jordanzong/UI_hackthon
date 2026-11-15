# Multi-target SPHEREx Science Explorer

This branch has a **data-driven target × band × product** science panel.
All five names are navigable. For each band, the UI only enables actual exported **Epoch images, Blink, Difference, Source Catalog, SED**. Missing products show a missing-data message; no target is silently substituted.

## Built-in products vs missing products

- **Epsilon Indi B:** seven-group D5+D6 combined-stack GIF, overview image, grouping diagnostic.
- **WISE 0855:** Source 1–3 all-band SED plots, groups and overlay.
- **Barnard's Star, RW Aurigae, R Draconis:** six-band download counts and sky coordinates only, until real product files are added.

These are all taken from the saved outputs of All_Band (1).ipynb. No additional scientific products are claimed.

## Backend / GitHub Pages workflow

The UI auto-looks for a file named:
- notebook-results/barnards-star/manifest.json
- notebook-results/rw-aurigae/manifest.json
- notebook-results/r-draconis/manifest.json
- notebook-results/epsilon-indi-b/manifest.json
- notebook-results/wise-0855/manifest.json

Absent JSON returns a normal missing-data state. The SCIENCE panel also has a text input for a remote **Manifest URL**. Relative image URLs resolve against the manifest URL. Cross-origin JSON endpoints must allow CORS; serve over HTTPS.

### Export real science results

After an offline notebook run has produced calibrated/aligned Stack FITS or PNG, Difference and SED charts, install:

~~~bash
pip install numpy pillow astropy
~~~

Copy 'tools/example_target_products.json' to a spec file, e.g. 'products/barnards.json'; replace every REPLACE_WITH placeholder with a real filename from Barnard's Star, or remove unavailable products.

Minimal example (filenames and MJDs BELOW ARE HYPOTHETICAL placeholders, NOT real observations):

~~~json
{
  "target_id": "Barnards_Star",
  "center": {"ra_deg": 269.45207696, "dec_deg": 4.69336497},
  "bands": {
    "D2": {
      "kind": "single-band",
      "frames": [
        {"frame_id": "may", "label": "2025 May", "mjd": 60801.0, "image_file": "outputs/barnards/D2_may_stack.fits"},
        {"frame_id": "nov", "label": "2025 November", "mjd": 60986.0, "image_file": "outputs/barnards/D2_nov_stack.fits"}
      ],
      "difference": {"image_file": "outputs/barnards/D2_nov_minus_may.fits"}
    }
  },
  "sources_file": "outputs/barnards/source_catalog.ecsv"
}
~~~

Run from the repository directory:

~~~bash
python tools/export_spherex_products.py --spec products/barnards.json --output-root notebook-results
~~~

The exporter will create:
- notebook-results/barnards-star/manifest.json
- notebook-results/barnards-star/assets/D2_frame_001.png
- notebook-results/barnards-star/assets/D2_frame_002.png
- notebook-results/barnards-star/assets/D2_difference.png

Spec file paths resolve relative to the spec location, not where you run Python. The exporter reads science-ready 2D FITS, generates percentile-stretched PNGs (transparent for NaN), copies GIF/PNG/JPG/WebP, writes ECSV source positions when supplied, and generates a JSON manifest. The tool never performs ZODI subtraction, FLAGS checking, ePSF fitting, or cross-epoch association. Do not treat generated PNGs as calibrated photometry.

Then submit these files to your working fork branch and deploy GitHub Pages; the UI automatically detects the new target/epoch/band.

~~~bash
git add notebook-results/barnards-star
git commit -m "data: add validated Barnard's Star science products"
git push
~~~

Repeat for RW Aurigae and R Draconis when those actual products are ready.

## Standard manifest schema

Each target has a separate JSON:

~~~json
{
  "target_id": "RW_Aurigae",
  "bands": {
    "D2": {
      "kind": "single-band",
      "frames": [
        {
          "frame_id": "group_1",
          "label": "Group 1",
          "mjd": 60801.0,
          "image_url": "assets/D2_frame_001.png",
          "width": 65,
          "height": 65
        }
      ],
      "blink_url": "assets/D2_blink.gif",
      "difference": {
        "image_url": "assets/D2_difference.png",
        "valid_pixel_count": 101
      },
      "seds": [
        {
          "source_id": "1",
          "plots": {
            "groups": "assets/D2_sed_001_groups.png",
            "overlay": "assets/D2_sed_001_overlay.png"
          }
        }
      ]
    }
  },
  "sources": [
    {
      "detection_id": "det_1",
      "global_source_id": null,
      "ra_deg": 76.95,
      "dec_deg": 30.40,
      "quality_status": "unknown",
      "frame_positions": [
        {"frame_id": "group_1", "x_px": 20.5, "y_px": 30.5, "covered": true}
      ]
    }
  ]
}
~~~

**Every number/source record in this manifest example is illustrative, not a measured RW Aurigae datum.** Replace with your team's verified values, or remove the field. The example is not deployed as scientific data.

The 0-based (x_px,y_px) locations refer to the FINAL displayed PNG, origin top-left. A source is selectable in the image Viewer only with valid per-frame frame_positions; raw FITS detector coordinates are not interchangeable. If the PNG was cropped, flipped or resampled, recompute positions. Missing coverage is not nondetection. Do not invent global_source_id for epoch-local detections. Only populated calibrated flux_mjy fields represent real photometry; never convert flux_proxy_jy silently.

Band keys accepted: 'all', 'D1' to 'D6', 'D5+D6'. The latter is always a **combined** band, not independent D5/D6 photometry.

## Web front-end hooks

~~~javascript
await window.SPHERExNotebookResults.loadManifest(
  "https://example.org/api/targets/RW_Aurigae/manifest",
  "RW_Aurigae"
);
window.SPHERExNotebookResults.selectTarget("RW_Aurigae");
window.SPHERExNotebookResults.selectBand("D2");
~~~

An already fetched JSON object may be installed using:
~~~javascript
window.SPHERExNotebookResults.setManifest(json, "RW_Aurigae", document.baseURI);
~~~

## Verification before merging

1. All 5 targets remain selectable and RA/Dec navigation works.
2. Missing D1–D6 assets show a clear unavailable state rather than another band's Stack.
3. Existing Epsilon Indi B seven-group GIF and WISE 0855 SED continue to display.
4. Manifest target_id mismatch is rejected.
5. Test every generated asset URL for HTTP 200 on GitHub Pages.
6. Verify ePSF source association, valid masks and final image-pixel mapping.
7. Test Epoch/Blink/Difference, source selection, mobile layout and real backend CORS.

The fork's GitHub Pages can preview the branch before an upstream PR is merged.
