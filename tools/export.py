# -*- coding: utf-8 -*-
"""Exportiert ein stagekit-Deck: PDF, Folien-PNGs, Kontaktbogen.

    python tools/export.py <deck.html> [--pdf] [--png] [--sheet] [--out DIR]

Ohne Schalter: alles. Braucht Google Chrome (oder Edge) und Pillow fuer den
Kontaktbogen. Das Deck wird ueber einen lokalen HTTP-Server geladen, damit
Schriften und Einbettungen so laden wie im Browser.

  --pdf    eine Seite je Folie, 1920x1080, ueber die Druckansicht (?print)
  --png    ein PNG je Folie (?slide=N, alle Schritte gezeigt) nach DIR/slides/
  --sheet  Kontaktbogen aus den PNGs, 6 Spalten, nummeriert, nach DIR/sheet.png
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


def run(ch, args):
    subprocess.run([ch, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-pdf-header-footer",
                    "--virtual-time-budget=6000", *args], check=False, capture_output=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("deck")
    ap.add_argument("--pdf", action="store_true")
    ap.add_argument("--png", action="store_true")
    ap.add_argument("--sheet", action="store_true")
    ap.add_argument("--out", default=None)
    a = ap.parse_args()
    if not (a.pdf or a.png or a.sheet):
        a.pdf = a.png = a.sheet = True
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
    n = slide_count(url)
    print(f"{n} Folien, {url}")
    if a.pdf:
        pdf = out / (deck.stem + ".pdf")
        run(ch, [f"--print-to-pdf={pdf}", url + "?print"])
        print(f"pdf: {pdf}")
    if a.png or a.sheet:
        sl = out / "slides"
        sl.mkdir(exist_ok=True)
        for i in range(1, n + 1):
            run(ch, ["--window-size=1920,1080", f"--screenshot={sl / f'{i:02d}.png'}", f"{url}?slide={i}&step=99"])
        print(f"png: {sl} ({n})")
    if a.sheet:
        from PIL import Image, ImageDraw
        cols, w, h = 6, 320, 180
        rows = (n + cols - 1) // cols
        sheet = Image.new("RGB", (cols * w, rows * (h + 18)), "white")
        d = ImageDraw.Draw(sheet)
        for i in range(1, n + 1):
            im = Image.open(out / "slides" / f"{i:02d}.png").resize((w - 6, h - 4))
            x, y = ((i - 1) % cols) * w, ((i - 1) // cols) * (h + 18)
            sheet.paste(im, (x + 3, y + 2))
            d.text((x + 4, y + h), str(i), fill="black")
        sheet.save(out / "sheet.png")
        print(f"sheet: {out / 'sheet.png'}")
    srv.shutdown()


if __name__ == "__main__":
    sys.exit(main())
