# SPHEREx Observation Viewer — Backend integration

This repository is a plain HTML/CSS/JavaScript sky atlas. New files:

- `spherex-viewer.css` — responsive observation panel
- `spherex-viewer.js` — epoch, blink, difference, local import, source overlays
- `spherex-demo.js` — **real** 2025 May/November SPHEREx DR1 aligned-FITS previews, reduced to 65×65 RGBA PNGs with invalid pixels transparent. Not synthetic astronomy data.
- `index.html` — loads these assets; bridges sky atlas source selection.

## Use now (no backend needed)

Open the GitHub Pages site after the branch is merged, click **SPHEREx Viewer**, and choose **DR1 Example**. Switch epochs with Prev/Next or Blink; choose Difference. Brightness controls change only the display.

The example uses two 2025 DR1 D2 observations approximately 185.81 days apart (1.55373 and 1.55247 μm). Only **101 difference pixels** are valid; WISE 0855 is **outside the valid common mask**, so this is **not a discovery demonstration**.

You can also import existing PNG/JPEG/WebP/GIF images (e.g. `difference.png` or `blink.gif`). A browser cannot analyze raw FITS in this implementation; render PNGs on the Python backend.

## REST / Manifest contract

Expose a JSON URL that returns something like:

```json
{
  "field_id": "my_field",
  "status": "ready",
  "center": {"ra_deg": 133.795129, "dec_deg": -7.245147},
  "frames": [
    {
      "frame_id": "obs_may",
      "label": "2025 May · D2",
      "mjd": 60801.108089,
      "wavelength_um": 1.55373,
      "width": 65,
      "height": 65,
      "image_url": "/previews/may.png"
    },
    {
      "frame_id": "obs_nov",
      "label": "2025 Nov · D2",
      "mjd": 60986.922736,
      "wavelength_um": 1.55247,
      "width": 65,
      "height": 65,
      "image_url": "/previews/nov.png"
    }
  ],
  "difference": {
    "image_url": "/previews/diff.png",
    "width": 65,
    "height": 65,
    "valid_pixel_count": 101
  },
  "sources": [
    {
      "detection_id": "det_1",
      "global_source_id": null,
      "ra_deg": 133.8,
      "dec_deg": -7.24,
      "flux_mjy": null,
      "quality_status": "warning",
      "frame_positions": [
        {"frame_id": "obs_may", "x_px": 20.5, "y_px": 30.5, "covered": true}
      ]
    }
  ]
}
```

The example source coordinates above are illustrative schema values, **not a measured source**. Remove illustrative rows in production.

Important conventions:

- `frame_positions[].x_px/y_px` are **0-based coordinates in the final displayed PNG** (origin at its upper-left), **not** native detector FITS pixels. WCS/registration belong on the backend.
- Set `covered: false` or omit positions for invalid/masked pixels. The UI only plots markers that explicitly have valid frame positions, and does **not** draw them over the difference image by default.
- `global_source_id` remains null until reliable cross-epoch association is performed. Never treat epoch-local IDs as cross-epoch identities.
- `flux_mjy` must be real calibrated flux; do not silently convert preliminary `flux_proxy_jy`.
- Use `status: "coverage_unavailable"` and a helpful `notice` if the requested target lies outside the common valid mask; do not report a non-detection.
- `image_url` values can be relative to the URL of the JSON manifest. URLs must be HTTP(S) or allowed image data URLs.
- For cross-origin hosting, enable CORS for JSON, and serve both JSON and images via HTTPS.

## Programmatic hooks

```js
// Server-generated manifest from already-calibrated frames:
window.SPHERExViewer.setData(manifest);

// Fetch manifest from deployed Python backend:
await window.SPHERExViewer.loadFromUrl(
  "https://your-backend.example.com/api/fields/example/manifest"
);

// Existing Gaia/SPHEREx sky-atlas overlays:
window.SPHERExCatalog.setSources(manifest.sources);
```

The first two methods load source positions into the sky atlas automatically when `sources` is present.

## Test checklist

- Desktop and mobile panel open/close.
- Two valid image previews and local image import; verify load errors.
- Prev/Next, Blink play/pause, Difference and brightness.
- Source markers only if frame-specific pixel positions are provided; clicking a marker focuses that RA/Dec in the sky atlas.
- Gaia DR3 layer, Gaia CSV fallback, quality filter and Source ID label toggles.
- Original RA/Dec/FOV search, panning, zooming, bilingual labels.
- Missing-coverage notice stays visible on the DR1 example.

Note: the sky atlas currently queries ESA/MAST Gaia TAP in small fields. This is **different from IRSA TAP** and can be blocked independently by network/CORS. The Gaia CSV import remains available as an offline fallback.
