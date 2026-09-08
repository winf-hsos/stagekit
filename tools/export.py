# -*- coding: utf-8 -*-
"""Exportiert ein stagekit-Deck: PDF, Folien-PNGs, Kontaktbogen.

    python tools/export.py <deck.html> [--pdf] [--png] [--sheet] [--out DIR]

Ohne Schalter: alles. Braucht Google Chrome (oder Edge) und Pillow fuer den
Kontaktbogen. Das Deck wird ueber einen lokalen HTTP-Server geladen, damit
Schriften und Einbettungen so laden wie im Browser.

  --pdf    eine Seite je Frame, 1920x1080, aus den Frame-PNGs (wie im Vortrag)
  --png    ein PNG je Frame (jeder Aufbauschritt einzeln, ?slide=N) nach DIR/slides/
  --sheet  Kontaktbogen aus den PNGs, 6 Spalten, nummeriert, nach DIR/sheet.png
  --fonts  Schriftpruefung: jede Folie wird auf Textgroessen ausserhalb der vier
           Stufen des Themes (tiny, small, normal, large) durchsucht, auch in
           SVG-Zeichnungen. Meldet Folie, Element und Groesse.
  --steps  Schrittpruefung: jede Folie mit Aufbau schrittweise durchschalten und
           die Position aller sichtbaren Elemente vergleichen. Meldet jedes
           Element, das zwischen zwei Schritten wandert (Layout springt).
"""
import argparse
import http.server
import pathlib
import shutil
import socketserver
import subprocess
import sys
import threading
import urllib.request

CHROME = [r"C:\Program Files\Google\Chrome\Application\chrome.exe",
          r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
          r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
          "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "google-chrome", "chromium"]


def chrome():
    for c in CHROME:
        if pathlib.Path(c).exists() or shutil.which(c):
            return c
    raise SystemExit("Chrome nicht gefunden; Pfad in tools/export.py eintragen")


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def serve(root):
    handler = lambda *a, **k: Quiet(*a, directory=str(root), **k)  # noqa: E731
    srv = socketserver.TCPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, srv.server_address[1]


def slide_count(url):
    html = urllib.request.urlopen(url).read().decode("utf-8", "replace")
    return html.count('class="slide')


def frames_of(deck):
    """Alle Frames (Folie, Schritt) in Reihenfolge; ein Aufbauschritt ist ein Frame."""
    out = []
    for i, n in enumerate(step_counts(deck), start=1):
        for k in range(n + 1):
            out.append((i, k))
    return out


def run(ch, args):
    subprocess.run([ch, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-pdf-header-footer",
                    "--virtual-time-budget=6000", *args], check=False, capture_output=True)


def step_counts(deck):
    """Hoechster data-step je Folie, aus dem Quelltext (Reihenfolge der <section class="slide")."""
    import re
    html = deck.read_text(encoding="utf-8")
    sections = re.split(r'<section class="slide', html)[1:]
    return [max([int(m) for m in re.findall(r'data-step="(\d+)"', sec)] or [0]) for sec in sections]


HARNESS = """<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;background:#000">
<iframe id="f" style="width:960px;height:540px;border:0"></iframe>
<script>
const q = new URLSearchParams(location.search);
const slide = q.get("slide"), n = Number(q.get("n"));
const f = document.getElementById("f");
f.src = q.get("deck") + "?slide=" + slide;
function path(e, root) { const p = []; while (e && e !== root) { const par = e.parentElement; p.unshift(e.tagName + (e.id ? "#" + e.id : "") + ":" + Array.prototype.indexOf.call(par.children, e)); e = par; } return p.join("/"); }
function snap(win) {
  const root = win.document.querySelector(".slide.current"), m = {};
  root.querySelectorAll("*").forEach((e) => {
    if (e.closest("svg") || e.closest(".notes") || e.closest(".location")) return;
    const cs = win.getComputedStyle(e);
    if (cs.visibility === "hidden" || cs.display === "none" || cs.display === "inline") return;   // inline: Wortpositionen aendern sich mit dem Text, das ist kein Springen
    const r = e.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    m[path(e, root)] = [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)];
  });
  return m;
}
f.onload = () => setTimeout(() => {
  const win = f.contentWindow, snaps = [snap(win)];
  for (let k = 0; k < n; k++) { win.stagekit.next(); snaps.push(snap(win)); }
  const moved = [];
  for (let k = 1; k <= n; k++) {
    for (const key of Object.keys(snaps[k - 1])) {
      const a = snaps[k - 1][key], b = snaps[k][key];
      if (b && (Math.abs(a[0] - b[0]) > 1 || Math.abs(a[1] - b[1]) > 1)) moved.push({ step: k, el: key, from: [a[0], a[1]], to: [b[0], b[1]] });
    }
  }
  document.title = "STEPS:" + JSON.stringify(moved);
}, 900);
</script></body></html>
"""


def check_steps(ch, url, deck, out):
    """Aufbau in Schritten: Nichts, was schon zu sehen war, darf seine Position
    aendern. Ein Testrahmen laedt jede Folie mit Aufbau, ruft die
    Weiter-Funktion schrittweise auf und vergleicht die Position aller
    sichtbaren Elemente (ausser Zeichnungen und Notizen) vor und nach jedem
    Schritt. Gemeldet wird jedes Element, das wandert."""
    import json
    import re
    harness = deck.parent / "_stepcheck.html"
    harness.write_text(HARNESS, encoding="utf-8")
    hurl = url.rsplit("/", 1)[0] + "/_stepcheck.html"
    counts = step_counts(deck)
    problems = 0
    first_frame = {}
    f = 1
    for i, n in enumerate(counts, start=1):
        first_frame[i] = f
        f += n + 1
    try:
        for i, n in enumerate(counts, start=1):
            if n == 0:
                continue
            res = subprocess.run([ch, "--headless=new", "--disable-gpu", "--virtual-time-budget=6000", "--dump-dom",
                                  f"{hurl}?deck={deck.name}&slide={first_frame[i]}&n={n}"], capture_output=True, text=True, encoding="utf-8", errors="replace")
            m = re.search(r"<title>STEPS:(.*?)</title>", res.stdout, re.S)
            if not m:
                print(f"  folie {i}: pruefung ohne ergebnis")
                continue
            moved = json.loads(m.group(1).replace("&quot;", '"'))
            if not moved:
                print(f"  folie {i}: {n} schritt(e), nichts wandert")
            else:
                problems += 1
                print(f"  folie {i}: SPRINGT")
                for mv in moved[:8]:
                    print(f"    schritt {mv['step']}: {mv['el'].split('/')[-1]} von {mv['from']} nach {mv['to']}")
                if len(moved) > 8:
                    print(f"    ... und {len(moved) - 8} weitere")
    finally:
        harness.unlink(missing_ok=True)
    print(f"steps: {sum(1 for n in counts if n)} folien mit aufbau geprueft, {problems} springen")


FONT_HARNESS = """<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;background:#000">
<iframe id="f" style="width:960px;height:540px;border:0"></iframe>
<script>
const q = new URLSearchParams(location.search);
const f = document.getElementById("f");
f.src = q.get("deck") + "?slide=" + q.get("slide");
f.onload = () => setTimeout(() => {
  const win = f.contentWindow, doc = win.document, cs = win.getComputedStyle(doc.documentElement);
  const allowed = ["--tiny", "--small", "--normal", "--large"].map((v) => Math.round(parseFloat(cs.getPropertyValue(v))));
  const root = doc.querySelector(".slide.current"), bad = {};
  root.querySelectorAll("*").forEach((e) => {
    if (e.closest(".notes") || e.closest(".location") || e.closest("iframe")) return;
    const hasText = Array.from(e.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!hasText) return;
    let size = parseFloat(win.getComputedStyle(e).fontSize);
    // SVG-Text: font-size in viewBox-Einheiten, auf Folienpixel umrechnen
    const svg = e.closest("svg");
    if (svg) { const vb = svg.viewBox.baseVal; const r = svg.getBoundingClientRect(); const scale = parseFloat(cs.getPropertyValue("--scale")) || 1; if (vb && vb.width) size = size * (r.width / scale) / vb.width; }
    size = Math.round(size);
    if (!allowed.some((a) => Math.abs(a - size) <= 2)) { const key = (e.tagName + (e.id ? "#" + e.id : "") + " " + size + "px"); bad[key] = (bad[key] || 0) + 1; }
  });
  document.title = "FONTS:" + JSON.stringify({ allowed, bad });
}, 900);
</script></body></html>
"""


def check_fonts(ch, url, deck):
    """Nur die vier Groessen des Themes sind erlaubt (auf der 1920er Leinwand).
    SVG-Text wird ueber die viewBox in Folienpixel umgerechnet."""
    import json
    import re
    harness = deck.parent / "_fontcheck.html"
    harness.write_text(FONT_HARNESS, encoding="utf-8")
    hurl = url.rsplit("/", 1)[0] + "/_fontcheck.html"
    frames = frames_of(deck)
    seen = set()
    problems = 0
    try:
        first = {}
        for f, (slide, step) in enumerate(frames, start=1):
            first.setdefault(slide, f)
        for slide, f in first.items():
            res = subprocess.run([ch, "--headless=new", "--disable-gpu", "--virtual-time-budget=6000", "--dump-dom",
                                  f"{hurl}?deck={deck.name}&slide={f}"], capture_output=True, text=True, encoding="utf-8", errors="replace")
            m = re.search(r"<title>FONTS:(.*?)</title>", res.stdout, re.S)
            if not m:
                continue
            data = json.loads(m.group(1).replace("&quot;", '"'))
            if data["bad"]:
                problems += 1
                items = ", ".join(f"{k} x{v}" for k, v in data["bad"].items())
                print(f"  folie {slide}: {items}")
            seen.add(slide)
    finally:
        harness.unlink(missing_ok=True)
    print(f"fonts: {len(seen)} folien geprueft, {problems} mit fremden groessen (erlaubt: 20, 32, 48, 80 px)")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("deck")
    ap.add_argument("--pdf", action="store_true")
    ap.add_argument("--png", action="store_true")
    ap.add_argument("--sheet", action="store_true")
    ap.add_argument("--steps", action="store_true")
    ap.add_argument("--fonts", action="store_true")
    ap.add_argument("--out", default=None)
    a = ap.parse_args()
    if not (a.pdf or a.png or a.sheet or a.steps or a.fonts):
        a.pdf = a.png = a.sheet = a.steps = a.fonts = True
    deck = pathlib.Path(a.deck).resolve()
    out = pathlib.Path(a.out).resolve() if a.out else deck.parent / "export"
    out.mkdir(parents=True, exist_ok=True)
    # Server auf dem gemeinsamen Vorfahren von Deck und stagekit, damit relative Pfade tragen
    root = pathlib.Path(deck.anchor)
    for parent in deck.parents:
        if (parent / "stagekit.css").exists() or any((p / "stagekit.css").exists() for p in parent.iterdir() if p.is_dir()):
            root = parent
            break
    srv, port = serve(root)
    rel = deck.relative_to(root).as_posix()
    url = f"http://127.0.0.1:{port}/{rel}"
    ch = chrome()
    frames = frames_of(deck)
    n = len(frames)
    print(f"{slide_count(url)} Folien, {n} Frames (Aufbauschritte einzeln), {url}")
    if a.pdf or a.png or a.sheet:
        # ein PNG je Frame, aufgenommen wie im Vortrag (Hooks laufen mit)
        sl = out / "slides"
        sl.mkdir(exist_ok=True)
        for f in range(1, n + 1):
            run(ch, ["--window-size=1920,1080", f"--screenshot={sl / f'{f:02d}.png'}", f"{url}?slide={f}"])
        print(f"png: {sl} ({n} frames)")
    if a.pdf:
        # PDF aus den Frame-PNGs: eine Seite je Frame, genau das Bild des Vortrags
        from PIL import Image
        pages = [Image.open(out / "slides" / f"{f:02d}.png").convert("RGB") for f in range(1, n + 1)]
        pdf = out / (deck.stem + ".pdf")
        pages[0].save(pdf, save_all=True, append_images=pages[1:], resolution=144)
        print(f"pdf: {pdf} ({n} seiten)")
    if a.sheet:
        from PIL import Image, ImageDraw
        cols, w, h = 6, 320, 180
        rows = (n + cols - 1) // cols
        sheet = Image.new("RGB", (cols * w, rows * (h + 18)), "white")
        d = ImageDraw.Draw(sheet)
        for f in range(1, n + 1):
            im = Image.open(out / "slides" / f"{f:02d}.png").resize((w - 6, h - 4))
            x, y = ((f - 1) % cols) * w, ((f - 1) // cols) * (h + 18)
            sheet.paste(im, (x + 3, y + 2))
            slide, step = frames[f - 1]
            d.text((x + 4, y + h), f"{f}" + (f" ({slide}.{step})" if step else f" ({slide})"), fill="black")
        sheet.save(out / "sheet.png")
        print(f"sheet: {out / 'sheet.png'}")
    if a.steps:
        check_steps(ch, url, deck, out)
    if a.fonts:
        check_fonts(ch, url, deck)
    srv.shutdown()


if __name__ == "__main__":
    sys.exit(main())
