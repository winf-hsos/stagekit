# -*- coding: utf-8 -*-
"""Renders the figures of a deck as standalone SVG files, in a theme of choice.

    python tools/figures.py <deck>/index.html --out <dir> [--theme light] [--only name,name]

A deck may ship a `figures.js` next to `deck.js` that exposes

    window.figures = { "half-adder": () => svgString, "pixel-grid": async () => svgString, ... }

Each function returns a complete SVG string (from draw.js) or a promise of one.
This tool loads theme.css, draw.js, deck.js and figures.js in headless Chrome
with the requested theme (`?theme=light` selects the `:root[data-theme="light"]`
block that tools/theme.py writes from `[colors.light]` in style.toml), collects
every figure and writes `<out>/<name>.svg`. The code font (Roboto Mono, latin
subset, from tools/fonts/) is embedded so the file looks the same everywhere;
the text font falls back to Arial, which every system has.

The figures are drawn by the same functions as the slides, so a change in the
deck changes the website figure with it. The SVGs are generated: do not edit.
"""
import argparse
import base64
import html
import pathlib
import re
import subprocess
import sys

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from export import chrome  # noqa: E402

FONT = HERE / "fonts" / "RobotoMono-Regular.woff2"

HARNESS = """<!DOCTYPE html>
<html data-theme="{theme}"><head><meta charset="utf-8">
<link rel="stylesheet" href="theme.css">
<link rel="stylesheet" href="{stagekit}/stagekit.css">
</head><body>
<script src="{stagekit}/draw.js"></script>
<script src="deck.js"></script>
<script src="figures.js"></script>
<script>
(async () => {{
  const only = {only};
  for (const [name, fn] of Object.entries(window.figures || {{}})) {{
    if (only.length && !only.includes(name)) continue;
    try {{
      const svg = await fn();
      const pre = document.createElement("pre"); pre.dataset.figure = name; pre.textContent = svg; document.body.appendChild(pre);
    }} catch (e) {{
      const pre = document.createElement("pre"); pre.dataset.error = name; pre.textContent = String(e && e.stack || e); document.body.appendChild(pre);
    }}
  }}
  document.body.dataset.done = "1";
}})();
</script></body></html>
"""


def font_style():
    if not FONT.exists():
        return ""
    b64 = base64.b64encode(FONT.read_bytes()).decode("ascii")
    return ("<style>@font-face{font-family:'Roboto Mono';font-style:normal;font-weight:400;"
            f"src:url(data:font/woff2;base64,{b64}) format('woff2');}}</style>")


def finish(svg, font):
    """Add width/height from the viewBox and embed the code font."""
    m = re.match(r'<svg viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"', svg)
    if m:
        w, h = m.group(1), m.group(2)
        svg = svg.replace(m.group(0), f'<svg width="{w}" height="{h}" viewBox="0 0 {w} {h}"', 1)
    i = svg.index(">") + 1
    return svg[:i] + font + svg[i:]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("deck", help="index.html of the deck")
    ap.add_argument("--out", required=True, help="output folder for the SVG files")
    ap.add_argument("--theme", default="light", help="palette block of theme.css (default: light)")
    ap.add_argument("--only", default="", help="comma-separated figure names")
    a = ap.parse_args()
    deck = pathlib.Path(a.deck).resolve()
    folder = deck.parent
    if not (folder / "figures.js").exists():
        print(f"no figures.js in {folder}")
        return 1
    index = deck.read_text(encoding="utf-8")
    m = re.search(r'src="((?:\.\./)+stagekit)/stagekit\.js', index)
    stagekit = m.group(1) if m else "../../../../../stagekit"
    only = [x for x in a.only.split(",") if x]
    harness = folder / "_figures.html"
    harness.write_text(HARNESS.format(theme=a.theme, stagekit=stagekit, only=repr(only)), encoding="utf-8")
    out = pathlib.Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    try:
        res = subprocess.run([chrome(), "--headless=new", "--disable-gpu", "--virtual-time-budget=8000", "--dump-dom",
                              "--allow-file-access-from-files", harness.as_uri()], capture_output=True, text=True, encoding="utf-8", errors="replace")
        dom = res.stdout
    finally:
        harness.unlink(missing_ok=True)
    font = font_style()
    n = 0
    for name, body in re.findall(r'<pre data-figure="([^"]+)">(.*?)</pre>', dom, re.S):
        svg = finish(html.unescape(body), font)
        (out / f"{name}.svg").write_text(svg, encoding="utf-8")
        print(f"  {name}.svg")
        n += 1
    for name, body in re.findall(r'<pre data-error="([^"]+)">(.*?)</pre>', dom, re.S):
        print(f"  FEHLER {name}: {html.unescape(body)[:300]}")
    if 'data-done="1"' not in dom:
        print("  (Seite nicht fertig geworden: Zeitbudget oder Skriptfehler)")
    print(f"figures: {n} geschrieben nach {out}")
    return 0 if n else 1


if __name__ == "__main__":
    sys.exit(main())
