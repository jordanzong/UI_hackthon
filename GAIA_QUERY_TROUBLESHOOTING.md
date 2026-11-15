# Gaia DR3 query failure — diagnostics and fallback fix

This branch fixes the Sky Atlas message "Gaia DR3: 查詢失敗（可重試）".

## Root cause fixed

The previous code sent exactly the same ADQL query to ESA and MAST, using `FROM gaiadr3.gaia_source` for **both** services. However, [MAST's official Gaia DR3 examples](https://mast.stsci.edu/vo-tap/api/v0.1/gaiadr3/examples) use `FROM dbo.gaia_source`. As a result, the MAST fallback could reject the query even when its service was reachable.

The new version uses provider-specific table names:
- **ESA Gaia Archive:** `gaiadr3.gaia_source`
- **MAST Gaia DR3:** `dbo.gaia_source`

Queries retain coordinate/brightness filtering, `TOP 3000`, and bright-first ordering. Timeouts are 20 seconds per provider.

## User-visible diagnostics

If both providers fail at FOV ≤ 12°, the status line includes a human-readable error panel listing provider results, such as:
- `ESA Gaia Archive: browser network/CORS blocked or service unreachable`
- `MAST Gaia DR3: HTTP 400`
- `MAST Gaia DR3: timeout (20 s)`

This describes what the browser knows; **TypeError or a generic 'Failed to fetch' alone cannot prove a CORS failure**, because DNS, network policy or browser extensions may cause the same error.

Visitors can retry using **重新查詢 Gaia / Refresh Gaia**. Bright embedded stars remain available when Gaia is offline or fails; no fabricated Gaia points are generated.

## Reproduce and check

1. In GitHub Pages, select Gaia DR3 layer and zoom to **FOV 12° or less**.
2. Keep Browser DevTools open (F12 → Network / Console).
3. Observe automatic Gaia loading. If a failure occurs, read the detailed message under Catalog Status.
4. Click Refresh Gaia once, and note the error per service.
5. If the browser says `blocked by CORS`, editing the client-side SQL alone cannot change the remote service's Access-Control-Allow-Origin headers. For a fully reliable public site, use a server-side endpoint or pre-generated catalog files served from the same website origin.
6. Validate that other tools (Sky Search, Source overlays, Science Viewer / Epoch / SED) still load.

## Validation scope

- JavaScript inline script passes syntax parsing.
- A mocked ESA failure + MAST success test confirms fallback reaches `dbo.gaia_source` and returns stars.
- Remote endpoints' actual browser CORS responses and full site E2E have **not** been verified in a live browser; deployment testing is still required.

This change is separate from the previously observed **IRSA TAP 502**. IRSA and Gaia TAP are different services.
