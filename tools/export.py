# -*- coding: utf-8 -*-
"""Exportiert ein stagekit-Deck: PDF, Folien-PNGs, Kontaktbogen.

    python tools/export.py <deck.html> [--pdf] [--png] [--sheet] [--out DIR]

Ohne Schalter: alles. Braucht Google Chrome (oder Edge) und Pillow fuer den
Kontaktbogen. Das Deck wird ueber einen lokalen HTTP-Server geladen, damit
Schriften und Einbettungen so laden wie im Browser.

  --pdf    eine Seite je Frame, 1920x1080. Standard ist der Vektorweg: Chrome
           druckt die Klon-Ansicht (?print) direkt nach PDF, Text bleibt Text und
           Zeichnungen bleiben SVG. Beim Zoomen wird nichts pixelig, die Datei ist
           rund ein Zehntel so gross, und der Text ist durchsuchbar.
  --pdf-raster  das alte Verhalten: PDF aus den Frame-PNGs. Fuer Decks, bei denen
           die Druckansicht nicht traegt (eingebettete Demonstratoren im iframe
           drucken nicht mit), oder wenn das PDF exakt die Aufnahme zeigen soll.
  --png    ein PNG je Frame (jeder Aufbauschritt einzeln, ?slide=N) nach DIR/slides/.
           Schwarze und ungestylte Frames (Pixel (5,5) nicht --bg der theme.css)
           werden bis zu dreimal nachgeholt und gezaehlt; was danach noch
           fehlerhaft ist, meldet eine WARNUNG.
  --sheet  Kontaktbogen aus den PNGs, 6 Spalten, nummeriert, nach DIR/sheet.png
  --frames N|N-M  Preview PNGs and a compact contact sheet. N includes all
           builds of its slide; N-M selects exactly those inclusive frame numbers.
           Each run has its own directory beside the complete output directory.
  --motion FRAME  Preview a segment at 0%, 50% and 100% of its duration.
  --fonts  Schriftpruefung: jede Folie wird auf Textgroessen ausserhalb der vier
           Stufen des Themes (tiny, small, normal, large) durchsucht, auch in
           SVG-Zeichnungen. Meldet Folie, Element und Groesse.
  --steps  Schrittpruefung: jede Folie mit Aufbau schrittweise durchschalten und
           die Position aller sichtbaren Elemente vergleichen. Meldet jedes
           Element, das zwischen zwei Schritten wandert (Layout springt).
  --overflow  Check visible text against slide edges and d.box() labels against their boxes.
  --jobs N Chrome-Instanzen gleichzeitig (Standard: Prozessorkerne, hoechstens 8).
           Frames, Schritt- und Schriftpruefung sind voneinander unabhaengig und
           laufen deshalb nebeneinander; die Ausgabe bleibt in Reihenfolge.
           Eine Schritt- oder Schriftpruefung ohne Ergebnis (Folie nicht oder
           ohne Stylesheets geladen) wird einmal wiederholt, erst dann gemeldet.
"""
import concurrent.futures
import os
import argparse
import http.server
import json
import pathlib
import re
import shutil
import socketserver
import subprocess
import sys
import threading
import tempfile
import urllib.request
from urllib.parse import quote, unquote, urlencode, urljoin, urlsplit

CHROME = [r"C:\Program Files\Google\Chrome\Application\chrome.exe",
          r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
          r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
          "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "google-chrome", "chromium"]


def chrome():
    for c in CHROME:
        if pathlib.Path(c).exists() or shutil.which(c):
            return c
    raise SystemExit("Chrome nicht gefunden; Pfad in tools/export.py eintragen")


MOTION_PATH = "/__stagekit_checks__/motion.html"
OVERFLOW_PATH = "/__stagekit_checks__/overflow.html"
REVIEW_PATH = "/__stagekit_checks__/review.html"


class Quiet(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        if urlsplit(path).path == OVERFLOW_PATH:
            return str(pathlib.Path(__file__).with_name("overflow-check.html"))
        if urlsplit(path).path == MOTION_PATH:
            return str(pathlib.Path(__file__).with_name("motion-check.html"))
        if urlsplit(path).path == REVIEW_PATH:
            return str(pathlib.Path(__file__).with_name("review-check.html"))
        return super().translate_path(path)

    def log_message(self, *a):
        pass


class Server(socketserver.ThreadingTCPServer):
    # Threading, sonst bedient der Server eine Chrome-Instanz nach der anderen
    # und die Parallelisierung verpufft. Die Warteschlange fuer neue
    # Verbindungen steht in socketserver auf 5; schon zwei Chrome-Instanzen
    # oeffnen beim Laden mehr Verbindungen gleichzeitig, der Rest wurde
    # abgewiesen (ERR_CONNECTION_REFUSED): mal die ganze Seite, mal nur
    # theme.css, und der Frame kam als weisse Rohseite heraus.
    request_queue_size = 256
    daemon_threads = True


def serve(root):
    handler = lambda *a, **k: Quiet(*a, directory=str(root), **k)  # noqa: E731
    srv = Server(("127.0.0.1", 0), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, srv.server_address[1]


JOBS = min(8, os.cpu_count() or 1)
RENDERED = None   # the deck's DOM after stagekit.js ran, see rendered()


def rendered(ch, url):
    """The deck's DOM after its scripts ran (Chrome --dump-dom), or None."""
    res = subprocess.run([ch, "--headless=new", "--disable-gpu", "--virtual-time-budget=12000", "--dump-dom", url],
                         capture_output=True, text=True, encoding="utf-8", errors="replace")
    return res.stdout if '<section class="slide' in res.stdout else None


def parallel(fn, items):
    """fn auf alle items, JOBS gleichzeitig; Ergebnisse in der Reihenfolge der items."""
    with concurrent.futures.ThreadPoolExecutor(max_workers=JOBS) as pool:
        return list(pool.map(fn, items))


def nachholen(fn, items, name):
    """Wie parallel(), aber eine Pruefung ohne Ergebnis (None) einmal einzeln
    wiederholen, bevor sie als solche gemeldet wird."""
    res = parallel(fn, items)
    leer = [k for k, r in enumerate(res) if r is None]
    if leer:
        print(f"  {name}: {len(leer)} pruefung(en) ohne ergebnis nachgeholt: {[items[k] for k in leer]}")
        for k in leer:
            res[k] = fn(items[k])
    return res


PRINT_V2 = "print-clone-ids"


def print_view_ok(deck):
    """Traegt die stagekit.js, die DIESES Deck laedt, die reparierte Druckansicht?

    Ein Deck darf eine eigene Framework-Kopie im Ordner haben. Eine aeltere klont
    die Aufbauschritte, bevor gezeichnet wird, und liefert leere oder vertauschte
    Zeichnungen -- ein Vektor-PDF waere dann still falsch. True/False, oder None,
    wenn sich die Datei nicht finden laesst."""
    import re
    m = re.search(r'<script src="([^"?]*stagekit\.js)', deck.read_text(encoding="utf-8"))
    if not m:
        return None
    js = (deck.parent / m.group(1))
    if not js.exists():
        return None
    return PRINT_V2 in js.read_text(encoding="utf-8")


def pdf_pages(pdf):
    """Seitenzahl eines PDF, oder None, wenn keine PDF-Bibliothek da ist.
    Dient nur der Kontrolle: Der Vektorweg muss so viele Seiten liefern, wie das
    Deck Frames hat."""
    try:
        import pypdf
        return len(pypdf.PdfReader(str(pdf)).pages)
    except Exception:
        return None


def theme_bg(deck):
    """--bg aus dem :root-Block der theme.css, die das Deck laedt, als (r, g, b).
    Schwarz, wenn sich nichts finden laesst."""
    import re
    m = re.search(r'<link[^>]*href="([^"?]*theme\.css)', deck.read_text(encoding="utf-8"))
    css = deck.parent / m.group(1) if m else None
    if css and css.exists():
        root = re.search(r":root\s*\{([^}]*)\}", css.read_text(encoding="utf-8"))
        bg = re.search(r"--bg:\s*#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b", root.group(1)) if root else None
        if bg:
            h = bg.group(1)
            if len(h) == 3:
                h = "".join(c * 2 for c in h)
            return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
    return (0, 0, 0)


def slide_count(url):
    html = urllib.request.urlopen(url).read().decode("utf-8", "replace")
    return html.count('class="slide')


def frames_of(deck):
    """Alle Frames (Folie, Schritt) in Reihenfolge; ein Aufbauschritt ist ein Frame."""
    return [(slide, step) for slide, steps in enumerate(slide_steps(deck), start=1)
            for step in [0, *steps]]


def run(ch, args):
    # 12 s virtuelle Zeit: Bei 6 s wurde vereinzelt eine Folie aufgenommen, bevor
    # die Codeschrift geladen war, und ihr Text sass dann falsch.
    subprocess.run([ch, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-pdf-header-footer",
                    "--virtual-time-budget=12000", *args], check=False, capture_output=True)


def slide_steps(deck):
    """Distinct reveal numbers in player order, including runtime-generated steps."""
    import re
    # The deck as the browser built it, where available: animations (anim.js)
    # announce their steps only at runtime. The source text is the fallback.
    html = RENDERED or deck.read_text(encoding="utf-8")
    sections = re.split(r'<section class="slide', html)[1:]
    steps = []
    for sec in sections:
        numbers = {int(m) for m in re.findall(r'data-step="(\d+)"', sec)}
        if "poll" in sec.split('"', 1)[0].split():
            numbers.update([1, 2] if "data-correct" in sec else [1])
        steps.append(sorted(numbers))
    return steps


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
  const win = f.contentWindow;
  // Ohne Stylesheets (Verbindung abgewiesen, zu frueh) waeren es die Positionen
  // einer Rohseite; lieber kein Ergebnis, dann wird die Folie nachgeholt.
  if (!win.stagekit || !stylesLoaded(win)) { document.title = "STEPS:null"; return; }
  const snaps = [snap(win)];
  for (let k = 0; k < n; k++) { win.stagekit.showFrame(win.stagekit.frame + 1); snaps.push(snap(win)); }
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
    counts = [len(steps) for steps in slide_steps(deck)]
    problems = 0
    first_frame = {}
    f = 1
    for i, n in enumerate(counts, start=1):
        first_frame[i] = f
        f += n + 1
    def pruefe(i):
        n = counts[i - 1]
        res = subprocess.run([ch, "--headless=new", "--disable-gpu", "--virtual-time-budget=6000", "--dump-dom",
                              f"{hurl}?deck={deck.name}&slide={first_frame[i]}&n={n}"], capture_output=True, text=True, encoding="utf-8", errors="replace")
        m = re.search(r"<title>STEPS:(.*?)</title>", res.stdout, re.S)
        return json.loads(m.group(1).replace("&quot;", '"')) if m else None

    try:
        folien = [i for i, n in enumerate(counts, start=1) if n]
        ergebnisse = nachholen(pruefe, folien, "steps")
        for i, moved in zip(folien, ergebnisse):
            n = counts[i - 1]
            if moved is None:
                print(f"  folie {i}: pruefung ohne ergebnis")
                continue
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
    ohne = sum(1 for e in ergebnisse if e is None)
    print(f"steps: {len(folien) - ohne} von {len(folien)} folien mit aufbau geprueft, {problems} springen"
          + (f", {ohne} ohne ergebnis" if ohne else ""))


FONT_HARNESS = """<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;background:#000">
<iframe id="f" style="width:960px;height:540px;border:0"></iframe>
<script>
const q = new URLSearchParams(location.search);
const f = document.getElementById("f");
f.src = q.get("deck") + "?slide=" + q.get("slide");
f.onload = () => setTimeout(() => {
  const win = f.contentWindow, doc = win.document, cs = win.getComputedStyle(doc.documentElement);
  if (!stylesLoaded(win) || !doc.querySelector(".slide.current")) { document.title = "FONTS:null"; return; }
  const allowed = ["--tiny", "--small", "--normal", "--large"].map((v) => Math.round(parseFloat(cs.getPropertyValue(v))));
  const root = doc.querySelector(".slide.current"), bad = {};
  root.querySelectorAll("*").forEach((e) => {
    if (e.closest(".notes") || e.closest(".location") || e.closest("iframe")) return;
    const hasText = Array.from(e.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!hasText) return;
    let size = parseFloat(win.getComputedStyle(e).fontSize);
    // SVG-Text: font-size in Zeichnungseinheiten, auf Folienpixel umrechnen.
    // Die Bildschirmmatrix des Texts enthaelt viewBox und jedes scale() einer
    // umgebenden Gruppe; die viewBox allein liess <g transform="scale(2)"> aus.
    const svg = e.closest("svg");
    if (svg) {
      const scale = parseFloat(cs.getPropertyValue("--scale")) || 1;
      const m = (e.closest("text") || e).getScreenCTM && (e.closest("text") || e).getScreenCTM();
      if (m) size = size * Math.hypot(m.a, m.b) / scale;
      else { const vb = svg.viewBox.baseVal; const r = svg.getBoundingClientRect(); if (vb && vb.width) size = size * (r.width / scale) / vb.width; }
    }
    size = Math.round(size);
    if (!allowed.some((a) => Math.abs(a - size) <= 2)) { const key = (e.tagName + (e.id ? "#" + e.id : "") + " " + size + "px"); bad[key] = (bad[key] || 0) + 1; }
  });
  document.title = "FONTS:" + JSON.stringify({ allowed, bad });
}, 900);
</script></body></html>
"""


# Beide Testrahmen: Sind alle Stylesheets des Decks geladen und traegt theme.css?
# Ein abgewiesenes Stylesheet hat kein .sheet; ohne theme.css fehlt --bg.
STYLES_LOADED = """function stylesLoaded(win) {
  const doc = win.document, links = Array.from(doc.querySelectorAll('link[rel="stylesheet"]'));
  return links.every((l) => l.sheet && l.sheet.cssRules.length) && win.getComputedStyle(doc.documentElement).getPropertyValue("--bg").trim() !== "";
}
"""
HARNESS = HARNESS.replace("<script>\n", "<script>\n" + STYLES_LOADED, 1)
FONT_HARNESS = FONT_HARNESS.replace("<script>\n", "<script>\n" + STYLES_LOADED, 1)


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
    def pruefe(f):
        res = subprocess.run([ch, "--headless=new", "--disable-gpu", "--virtual-time-budget=6000", "--dump-dom",
                              f"{hurl}?deck={deck.name}&slide={f}"], capture_output=True, text=True, encoding="utf-8", errors="replace")
        m = re.search(r"<title>FONTS:(.*?)</title>", res.stdout, re.S)
        return json.loads(m.group(1).replace("&quot;", '"')) if m else None

    try:
        first = {}
        for f, (slide, step) in enumerate(frames, start=1):
            first.setdefault(slide, f)
        ergebnisse = nachholen(pruefe, list(first.values()), "fonts")
        for (slide, f), data in zip(first.items(), ergebnisse):
            if data is None:
                print(f"  folie {slide}: pruefung ohne ergebnis")
                continue
            if data["bad"]:
                problems += 1
                items = ", ".join(f"{k} x{v}" for k, v in data["bad"].items())
                print(f"  folie {slide}: {items}")
            seen.add(slide)
    finally:
        harness.unlink(missing_ok=True)
    ohne = len(first) - len(seen)
    print(f"fonts: {len(seen)} folien geprueft, {problems} mit fremden groessen (erlaubt: 20, 32, 48, 80 px)"
          + (f", {ohne} ohne ergebnis" if ohne else ""))


def check_overflow(ch, url, numbers):
    harness = urljoin(url, OVERFLOW_PATH)

    def inspect(frame):
        address = harness + "?" + urlencode({"deck": url, "frame": frame})
        result = subprocess.run([ch, "--headless=new", "--disable-gpu", "--virtual-time-budget=12000",
                                 "--dump-dom", address], capture_output=True, text=True,
                                encoding="utf-8", errors="replace")
        match = re.search(r"<title>OVERFLOW:([^<]+)</title>", result.stdout)
        return json.loads(unquote(match[1])) if match else None

    results = nachholen(inspect, numbers, "overflow")
    count = unchecked = 0
    for frame, result in zip(numbers, results):
        if result is None:
            unchecked += 1
            print(f"  Frame {frame}: could not check text bounds")
            continue
        for item in result["findings"]:
            text = json.dumps(item["text"], ensure_ascii=False)
            print(f"  Frame {frame}: {text} exceeds {item['target']} ({item['edge']})")
            count += 1
    if any(result and result["legacy"] for result in results):
        print("  Older draw.js: only slide edges checked. Run tools/sync.py for d.box() label checks.")
    print(f"overflow: {len(numbers) - unchecked} frames checked, {count} findings, {unchecked} unchecked")
    return int(bool(count or unchecked))


def warn_stale_copy(deck):
    """Say so when the deck loads a framework copy that differs from this repository."""
    import re
    sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
    from stagekit_version import REPO, content_hash, version_of
    m = re.search(r'src="([^"]*?)stagekit\.js', deck.read_text(encoding="utf-8", errors="ignore"))
    if not m:
        return
    copy = (deck.parent / m.group(1)).resolve()
    if copy == REPO or not (copy / "stagekit.js").is_file() or content_hash(copy) == content_hash(REPO):
        return
    print(f"  hinweis: das deck laedt die framework-kopie {copy} "
          f"({version_of(copy) or 'ohne version'}), stagekit ist bei {version_of(REPO)} und weicht ab. "
          f"erneuern mit: python {REPO / 'tools' / 'sync.py'} \"{copy}\"")


def frame_request(value):
    if not re.fullmatch(r"[1-9][0-9]*(?:-[1-9][0-9]*)?", value):
        raise argparse.ArgumentTypeError("expected a positive frame number or an inclusive range, e.g. 12 or 12-15")
    first, separator, last = value.partition("-")
    if separator and int(last) < int(first):
        raise argparse.ArgumentTypeError("end frame must be at least the start frame")
    return int(first), int(last) if separator else None


def preview_frames(request, frames):
    first, last = request
    if (last or first) > len(frames):
        raise ValueError(f"requested frame exceeds the deck's {len(frames)} frames")
    if last is None:
        slide = frames[first - 1][0]
        numbers = [f for f, (s, _) in enumerate(frames, start=1) if s == slide]
        first, last = numbers[0], numbers[-1]
    return range(first, last + 1)


def motion_preview(ch, url, out, frame, frames):
    """Capture three positions in the segment ending at the requested player frame."""
    from PIL import Image, ImageDraw

    if not RENDERED or not 1 <= frame <= len(frames):
        raise SystemExit(f"--motion expects a frame in the rendered deck (1-{len(frames)})")
    slide, step = frames[frame - 1]
    section = re.split(r'<section class="slide', RENDERED)[slide]
    if f'<span class="anim-step" data-step="{step}">' not in section:
        raise SystemExit(f"Frame {frame} has no animation segment. Select the frame where a movement ends.")
    parent = out.with_name(out.name + "-preview")
    parent.mkdir(parents=True, exist_ok=True)
    folder = pathlib.Path(tempfile.mkdtemp(prefix=f"motion-{frame:02d}-", dir=parent))
    samples = [(0, "start"), (0.5, "midpoint"), (1, "end")]

    def capture(sample):
        time, name = sample
        address = urljoin(url, MOTION_PATH) + "?" + urlencode({"deck": url, "frame": frame, "time": time})
        path = folder / (name + ".png")
        for attempt in range(2):
            run(ch, ["--force-device-scale-factor=1", "--window-size=1920,1088", f"--screenshot={path}", address])
            try:
                with Image.open(path) as source:
                    if source.size != (1920, 1088) or source.getpixel((3, 3))[:3] != (23, 187, 97):
                        continue
                    slide_image = source.crop((0, 8, 1920, 1088)).convert("RGB")
                slide_image.save(path)
                return slide_image.resize((640, 360), Image.Resampling.LANCZOS)
            except OSError:
                continue
        raise SystemExit(f"Could not capture frame {frame} at {time:.0%}. Samples in {folder}")

    tiles = parallel(capture, samples)
    strip = Image.new("RGB", (1920, 388), "white")
    draw = ImageDraw.Draw(strip)
    for index, ((time, name), tile) in enumerate(zip(samples, tiles)):
        x = index * tile.width
        strip.paste(tile, (x, 0))
        draw.text((x + 10, 368), f"Frame {frame}   {name} ({time:.0%})", fill="black")
    strip.save(folder / "motion.png")
    print(f"motion: {folder / 'motion.png'}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("deck")
    ap.add_argument("--pdf", action="store_true")
    ap.add_argument("--pdf-raster", action="store_true", dest="pdf_raster")
    ap.add_argument("--png", action="store_true")
    ap.add_argument("--sheet", action="store_true")
    ap.add_argument("--motion", type=int, metavar="FRAME",
                    help="preview the start, midpoint and end of the animation segment ending at FRAME")
    ap.add_argument("--frames", type=frame_request, metavar="N|N-M",
                    help="preview the complete slide containing frame N, or the exact inclusive range N-M")
    ap.add_argument("--overflow", action="store_true", help="check text against slide edges and its owning d.box()")
    ap.add_argument("--steps", action="store_true")
    ap.add_argument("--fonts", action="store_true")
    ap.add_argument("--out", default=None)
    ap.add_argument("--jobs", type=int, default=None)
    a = ap.parse_args()
    global JOBS
    if a.jobs:
        JOBS = max(1, a.jobs)
    if a.pdf_raster:
        a.pdf = True
    if a.motion is not None:
        if a.frames or a.pdf or a.png or a.sheet or a.steps or a.fonts or a.overflow:
            ap.error("use --motion FRAME as a separate preview")
    elif a.frames:
        if a.pdf or a.steps or a.fonts:
            ap.error("--frames produces preview PNGs and a contact sheet; use a full export for PDF or layout checks")
        a.png = a.sheet = a.overflow = True
    elif not (a.pdf or a.png or a.sheet or a.steps or a.fonts or a.overflow):
        a.pdf = a.png = a.sheet = a.steps = a.fonts = a.overflow = True
    deck = pathlib.Path(a.deck).resolve()
    out = pathlib.Path(a.out).resolve() if a.out else deck.parent / "export"
    srv, url = deck_server(deck)
    try:
        return export_deck(a, deck, out, url)
    finally:
        srv.shutdown()
        srv.server_close()


def deck_server(deck):
    """A server on the common ancestor of deck and stagekit, so relative paths
    resolve; returns the server and the deck's address."""
    root = pathlib.Path(deck.anchor)
    for parent in deck.parents:
        if (parent / "stagekit.css").exists() or any((p / "stagekit.css").exists() for p in parent.iterdir() if p.is_dir()):
            root = parent
            break
    srv, port = serve(root)
    return srv, f"http://127.0.0.1:{port}/{quote(deck.relative_to(root).as_posix())}"


def export_deck(a, deck, out, url):
    ch = chrome()
    global RENDERED
    RENDERED = rendered(ch, url)
    frames = frames_of(deck)
    n = len(frames)
    print(f"{slide_count(url)} Folien, {n} Frames (Aufbauschritte einzeln), {url}")
    warn_stale_copy(deck)
    if a.motion is not None:
        return motion_preview(ch, url, out, a.motion, frames)
    numbers = range(1, n + 1)
    if a.overflow and (RENDERED is None or not n):
        raise SystemExit("Cannot read the rendered deck's frame map for the overflow check.")
    if a.frames:
        try:
            numbers = preview_frames(a.frames, frames)
        except ValueError as error:
            raise SystemExit(str(error)) from error
        previews = out.with_name(out.name + "-preview")
        previews.mkdir(parents=True, exist_ok=True)
        out = pathlib.Path(tempfile.mkdtemp(prefix=f"{numbers[0]:02d}-{numbers[-1]:02d}-", dir=previews))
        print(f"preview: frames {numbers[0]}-{numbers[-1]} of {n}")
    if a.pdf or a.png or a.sheet:
        out.mkdir(parents=True, exist_ok=True)
    # Vektor nur, wenn die Druckansicht des Decks sie traegt
    vektor = a.pdf and not a.pdf_raster
    if vektor and print_view_ok(deck) is False:
        print("  hinweis: dieses deck laedt eine aeltere stagekit.js; pdf als raster. "
              "framework-kopie im deckordner erneuern fuer den vektorweg.")
        vektor = False
    if a.png or a.sheet or (a.pdf and not vektor):
        # ein PNG je Frame, aufgenommen wie im Vortrag (Hooks laufen mit)
        sl = out / "slides"
        sl.mkdir(exist_ok=True)
        aufnehmen = lambda f: run(ch, ["--window-size=1920,1080", f"--screenshot={sl / f'{f:02d}.png'}", f"{url}?slide={f}"])  # noqa: E731
        parallel(aufnehmen, numbers)
        # Misslungene Aufnahmen einzeln nachholen. Zwei Arten:
        # schwarz: aufgenommen vor dem ersten Zeichnen; jede Folie zeigt
        #   mindestens die Ortsangabe, also nie reines Schwarz.
        # ungestylt: theme.css oder die ganze Seite nicht geladen, eine weisse
        #   Rohseite oder Chromes Fehlerseite. Erkannt am Pixel (5,5), das den
        #   Seitengrund --bg aus der theme.css zeigen muss.
        from PIL import Image
        bg = theme_bg(deck)
        def fehler(f):
            try:
                im = Image.open(sl / f"{f:02d}.png").convert("RGB")
            except Exception:
                return "fehlt"
            if im.convert("L").getextrema()[1] < 40:
                return "schwarz"
            if sum(abs(a - b) for a, b in zip(im.getpixel((5, 5)), bg)) > 30:
                return "ungestylt"
            return None
        nachgeholt = set()
        for versuch in range(3):
            kaputt = {f: e for f in numbers if (e := fehler(f))}
            if not kaputt:
                break
            arten = ", ".join(f"{art}: {[f for f, e in kaputt.items() if e == art]}"
                              for art in ("schwarz", "ungestylt", "fehlt") if art in kaputt.values())
            print(f"  {len(kaputt)} frame(s) nachgeholt ({arten})")
            nachgeholt |= set(kaputt)
            for f in kaputt:
                aufnehmen(f)
        rest = {f: e for f in numbers if (e := fehler(f))}
        if rest:
            print(f"  WARNUNG: frames weiterhin fehlerhaft: {rest} "
                  f"(pixel (5,5) soll --bg {bg} zeigen; randlos gefuellte folie?)")
            if a.frames:
                raise SystemExit(f"Incomplete preview in {out}")
        print(f"png: {sl} ({len(numbers)} frames, {JOBS} gleichzeitig, {len(nachgeholt)} nachgeholt)")
    if a.pdf:
        pdf = out / (deck.stem + ".pdf")
        if not vektor:
            # PDF aus den Frame-PNGs: eine Seite je Frame, genau das Bild des Vortrags
            from PIL import Image
            pages = [Image.open(out / "slides" / f"{f:02d}.png").convert("RGB") for f in range(1, n + 1)]
            pages[0].save(pdf, save_all=True, append_images=pages[1:], resolution=144)
            print(f"pdf: {pdf} ({n} seiten, raster)")
        else:
            # Vektor: Chrome druckt ?print, wo je Aufbauschritt eine Seite geklont
            # wird. @page in stagekit.css gibt 1920x1080 px vor, also 1440x810 pt.
            run(ch, [f"--print-to-pdf={pdf}", f"{url}?print"])
            seiten = pdf_pages(pdf)
            if seiten is None:
                print(f"pdf: {pdf} (vektor)")
            elif seiten == n:
                print(f"pdf: {pdf} ({seiten} seiten, vektor)")
            else:
                # Zahl stimmt nicht: fast immer ein Deck, dessen Druckansicht nicht
                # traegt. Lieber laut sein als ein falsches PDF ausliefern.
                print(f"  WARNUNG: pdf hat {seiten} seiten, erwartet {n}. "
                      f"Mit --pdf-raster den Bildweg nehmen.")
                print(f"pdf: {pdf} ({seiten} seiten, vektor)")
    if a.sheet:
        from PIL import Image, ImageDraw
        cols, w, h = 6, 320, 180
        if a.frames:
            cols = min(cols, len(numbers))
        rows = (len(numbers) + cols - 1) // cols
        sheet = Image.new("RGB", (cols * w, rows * (h + 18)), "white")
        d = ImageDraw.Draw(sheet)
        for position, f in enumerate(numbers):
            with Image.open(out / "slides" / f"{f:02d}.png") as source:
                im = source.resize((w - 6, h - 4))
            x, y = (position % cols) * w, (position // cols) * (h + 18)
            sheet.paste(im, (x + 3, y + 2))
            slide, step = frames[f - 1]
            d.text((x + 4, y + h), f"{f}" + (f" ({slide}.{step})" if step else f" ({slide})"), fill="black")
        sheet.save(out / "sheet.png")
        print(f"sheet: {out / 'sheet.png'}")
    if a.steps:
        check_steps(ch, url, deck, out)
    if a.fonts:
        check_fonts(ch, url, deck)
    if a.overflow:
        return check_overflow(ch, url, numbers)


if __name__ == "__main__":
    sys.exit(main())
