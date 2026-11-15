#!/usr/bin/env python3
"""Audit deployed science manifests, preservation and obsolete test asset removal."""
import json
from pathlib import Path
from urllib.parse import urlsplit
from html.parser import HTMLParser
import re

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "science-runs"
EXPECTED = ("WISE_0855", "Barnards_Star", "Epsilon_Indi_B", "RW_Aurigae")
OLD = (
    "spherex-demo.js", "notebook-results.js", "notebook-results.css",
    "hyg-preview-20261115.html", "sky-verify-20261115b.html",
    "tools/example_target_products.json",
    "notebook-results/epsilon-indi-b/epoch-blink.gif",
    "notebook-results/epsilon-indi-b/grouping-diagnostic.png",
    "notebook-results/epsilon-indi-b/stack-overview.png",
    *("notebook-results/wise-0855/source-%02d-%s.png" % (i, kind)
      for i in (1, 2, 3) for kind in ("groups", "overlay")),
)

class Inspector(HTMLParser):
    def __init__(self):
        super().__init__()
        self.stack = []
        self.sel_parent = None
        self.static_scripts = []
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "script" and a.get("src"):
            self.static_scripts.append(a["src"].split("?")[0])
        if a.get("id") == "sel":
            self.sel_parent = tuple(self.stack)
        if tag not in ("area", "base", "br", "col", "embed", "hr", "img",
                       "input", "link", "meta", "param", "source", "track", "wbr"):
            self.stack.append(a.get("id", tag))
    def handle_endtag(self, tag):
        if self.stack:
            self.stack.pop()

def asset(run_dir, value):
    if not value:
        return
    part = urlsplit(value)
    assert not part.scheme and not part.netloc, "Unexpected non-local science asset: " + value
    file = (run_dir / part.path).resolve()
    assert file.is_relative_to(DATA.resolve()), "Science asset traversal: " + value
    assert file.is_file() and file.stat().st_size > 0, "Missing science asset: " + str(file)

def main():
    index = json.loads((DATA / "index.json").read_text())
    targets = {t["target_id"]: t for t in index["targets"]}
    assert len(targets) == 5 and len(index["bands"]) == 9
    assert sum(len(t["runs"]) for t in targets.values()) == 36
    assert not targets["R_Draconis"]["runs"]
    assert targets["R_Draconis"]["publication_status"] == "photometry_under_revision"
    gif = sed = frames = 0
    for target_id in EXPECTED:
        t = targets[target_id]
        assert len(t["runs"]) == 9, "Incomplete published runs: " + target_id
        for run in t["runs"]:
            manifest_file = (DATA / run["manifest_url"]).resolve()
            assert manifest_file.is_relative_to(DATA.resolve()) and manifest_file.is_file()
            m = json.loads(manifest_file.read_text())
            assert m["target_id"] == target_id and m["run_id"] == run["run_id"] and m["band_id"] == run["band_id"]
            p = m["bands"][run["band_id"]]
            asset(manifest_file.parent, p["blink_url"])
            if p["blink_url"]:
                gif += 1
            assert p["source_count"] == len(m["sources"])
            for f in p["frames"]:
                asset(manifest_file.parent, f["image_url"])
                frames += 1
            for s in p["seds"]:
                assert str(s["source_id"])
                for path in s["plots"].values():
                    asset(manifest_file.parent, path)
                    sed += 1
    assert gif == 36 and sed > 0 and frames > 0
    for name in ("catalogs/allsky/manifest.json", "catalogs/gaia/manifest.json",
                 "catalogs/gaia-wide/manifest.json"):
        assert (ROOT / name).is_file(), "Catalog lost: " + name
    for name in OLD:
        assert not (ROOT / name).exists(), "Obsolete test asset still deployed: " + name
    html = (ROOT / "index.html").read_text()
    parser = Inspector()
    parser.feed(html)
    assert re.search(r'</form>\s*<div id="sel" class="selection-inline"', html), \
        "Selected object no longer placed immediately inside the coordinates section"
    assert "./science-run-browser.js" in parser.static_scripts
    assert "./sky-map-tools.js" in parser.static_scripts
    assert "./spherex-viewer.js" in parser.static_scripts
    assert "./notebook-results.js" not in parser.static_scripts
    assert "./spherex-demo.js" not in parser.static_scripts
    sky = (ROOT / "sky-map-tools.js").read_text()
    browser = (ROOT / "science-run-browser.js").read_text()
    viewer = (ROOT / "spherex-viewer.js").read_text()
    assert "atlas-presets-slot" in sky and "preset-staging" in sky
    assert "window.SPHERExNotebookResults=" in browser
    assert "SPHERExViewer.setData" in browser
    assert "panel.insertBefore(scienceSection,panel.firstElementChild)" in browser
    assert "plot:'evolution'" in browser
    assert "state.plot='evolution'" in browser
    assert 'value="evolution">Epoch-to-epoch evolution' in browser
    assert "clamp(fov,0.2,180)" in html
    assert "(deg>=0.2&&deg<=180)" in html
    assert "0.2°–180°" in html
    css = (ROOT / "spherex-viewer.css").read_text()
    assert 'id="selCenter"' in html and 'class="btn primary" id="selCenter"' in html
    assert 'class="btn" id="selCopy"' in html
    assert 'class="spx-visual"' in viewer
    assert 'spx-brightness-rail' in viewer and 'id="spx-brightness-value"' in viewer
    assert 'spx-brightness-rail input[type=range]' in css
    assert 'body.spx-open #main' in css and 'body.spx-open #stage' in css
    assert 'main.append(panel)' in viewer and 'focusSkyContext()' in viewer
    assert 'SkyAtlas?.goToCoordinates?' in viewer
    assert 'target_name:targetName(state.target)' in browser
    for bad in ("spx-import-img", "spx-import-json", "spx-file-img", "spx-file-json",
                "spx-manifest-url", "spx-demo", "importImages", "loadFromUrl",
                "SPHEREx_DemoManifest"):
        assert bad not in viewer, "Legacy import/demo remains: " + bad
    print("PASS: %d published GIFs, %d Group frames, %d genuine SED image assets; "
          "36 scoped runs and real HYG/Gaia catalogs preserved; legacy test files absent."
          % (gif, frames, sed))

if __name__ == "__main__":
    main()
