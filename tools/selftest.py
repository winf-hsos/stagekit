# -*- coding: utf-8 -*-
"""Self-test for stagekit: run it before every commit.

    python tools/selftest.py             all checks
    python tools/selftest.py --quick     without the export (no Chrome needed)
    python tools/selftest.py --update    write new reference frames and theme.css
    python tools/selftest.py --out DIR   keep the work folder (frames, diffs) in DIR

Checks, in this order:

1. syntax of stagekit.js and draw.js (node --check) and of every tool;
2. tools/theme.py turns tests/deck/style.toml into exactly tests/deck/theme.css;
3. tools/sync.py fills an empty project, sets the cache buster and then
   reports nothing left to do; tools/start_script.py writes a start script;
   tools/release.py --notes reads the changelog;
4. tools/export.py exports tests/deck/selftest.html, which holds every kind of
   slide and building block: no frame may fail, no step may move the layout,
   no text may leave the four sizes; tools/review.py reads every slide of it;
5. every frame, and one frame half-way through an animation segment, is
   compared with tests/reference/<platform>/. Fonts
   render slightly differently on each system, so there is one set of
   reference frames per platform; without one, this step is skipped.

A changed frame is not always a bug: when a change is meant to alter how
slides look, check the frames in the reported folder and accept them with
--update. Exit code 1 when anything failed.
"""
import argparse
import os
import pathlib
import py_compile
import re
import shutil
import subprocess
import sys
import tempfile
import warnings

TOOLS = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(TOOLS))
from stagekit_version import REPO, cache_tag, repo_version, version_of  # noqa: E402

DECK = REPO / "tests" / "deck"
PLATFORM = {"win32": "windows", "linux": "linux", "darwin": "macos"}.get(sys.platform, sys.platform)
REFERENCE = REPO / "tests" / "reference" / PLATFORM
# Two runs on the same machine render bit for bit the same frames, so a frame
# counts as changed once more than 100 pixels differ by more than 16 of 255
# in any channel; that still catches a short word in another colour.
PIXEL_THRESHOLD, PIXEL_TOLERANCE = 16, 100
# frame 18 of the test deck is segment 2 of its animation; at 0.3 of it the
# packet is half-way along its route (the segment also holds the count)
ANIM_FRAME = 18

failures = []


def check(ok, what, detail=""):
    print(f"  {'ok    ' if ok else 'FEHLER'} {what}" + (f": {detail}" if detail else ""))
    if not ok:
        failures.append(what)
    return ok


def run(*args, cwd=None):
    r = subprocess.run([sys.executable, *map(str, args)], cwd=cwd, capture_output=True,
                       text=True, encoding="utf-8", errors="replace",
                       env={**os.environ, "PYTHONIOENCODING": "utf-8"})
    return r.returncode, r.stdout + r.stderr


def syntax():
    print("1 Syntax")
    node = shutil.which("node")
    for js in ("stagekit.js", "draw.js", "anim.js"):
        if not node:
            print(f"  --     {js}: node fehlt, übersprungen")
            continue
        r = subprocess.run([node, "--check", str(REPO / js)], capture_output=True, text=True)
        check(r.returncode == 0, js, r.stderr.strip())
    for py in sorted(TOOLS.glob("*.py")):
        # a SyntaxWarning (an invalid escape, say) turns into an error in a later Python
        with warnings.catch_warnings(record=True) as caught:
            warnings.simplefilter("always")
            try:
                py_compile.compile(str(py), doraise=True, cfile=str(pathlib.Path(tempfile.gettempdir()) / "stagekit-selftest.pyc"))
                error = ""
            except py_compile.PyCompileError as e:
                error = str(e)
        error = error or "; ".join(f"Zeile {w.lineno}: {w.message}" for w in caught if issubclass(w.category, SyntaxWarning))
        check(not error, f"tools/{py.name}", error)


def theme(tmp, update):
    print("2 Theme")
    out = tmp / "theme.css"
    rc, log = run(TOOLS / "theme.py", DECK / "style.toml", out)
    if not check(rc == 0, "theme.py läuft", log.strip() if rc else ""):
        return
    if update:
        shutil.copy(out, DECK / "theme.css")
        print("  neu    tests/deck/theme.css geschrieben")
        return
    same = out.read_text(encoding="utf-8") == (DECK / "theme.css").read_text(encoding="utf-8")
    check(same, "theme.css wie erwartet", "" if same else f"abweichend, Ergebnis in {out}")


def tools(tmp):
    print("3 Werkzeuge")
    project = tmp / "project"
    deck = project / "slides" / "example" / "example.html"
    deck.parent.mkdir(parents=True)
    deck.write_text('<link rel="stylesheet" href="../../stagekit/stagekit.css?v=old">\n'
                    '<script src="../../stagekit/draw.js"></script>\n'
                    '<script src="../../stagekit/stagekit.js?v=old"></script>\n', encoding="utf-8")
    rc, _ = run(TOOLS / "sync.py", project, "--check")
    check(rc == 1, "sync.py --check meldet ein leeres Projekt als veraltet")
    rc, log = run(TOOLS / "sync.py", project)
    check(rc == 0 and version_of(project / "stagekit") == repo_version(), "sync.py füllt die Kopie", log.strip() if rc else "")
    check(deck.read_text(encoding="utf-8").count(f"?v={cache_tag(REPO)}") == 3, "sync.py setzt die Cache-Kennung")
    rc, log = run(TOOLS / "sync.py", project, "--check")
    check(rc == 0, "sync.py --check danach ohne Befund", log.strip() if rc else "")
    rc, log = run(TOOLS / "start_script.py", deck)
    script = deck.parent / "start-presentation.cmd"
    check(rc == 0 and script.is_file() and "http.server" in script.read_text(encoding="utf-8", errors="ignore"),
          "start_script.py schreibt das Startskript", log.strip() if rc else "")
    rc, log = run(TOOLS / "release.py", "--notes")
    check(rc == 0, "release.py --notes liest CHANGELOG.md", log.strip() if rc else "")
    new_decks(project)


def new_decks(project):
    course = project / "Wahlfach für alle"
    course.mkdir()
    (course / "style.toml").write_text('[stagekit]\nlanguage = "de"\nmargin = 144\n', encoding="utf-8")
    destination = course / "slides" / "einstieg"
    title = "Größe & Auswahl"
    args = (TOOLS / "new_deck.py", destination, "--title", title)
    rc, log = run(*args)
    if not check(rc == 0, "new_deck.py legt den Satz an", log.strip() if rc else ""):
        return
    deck = destination / "groesse-auswahl.html"
    html = deck.read_text(encoding="utf-8")
    check('<html lang="de">' in html and "--margin: 144px" in (destination / "theme.css").read_text(),
          "Deck verwendet die Kursgestaltung")
    check(f'../../../stagekit/stagekit.js?v={cache_tag(project / "stagekit")}' in html
          and not (course / "stagekit").exists(), "Deck verwendet die vorhandene gemeinsame Kopie")
    check("Wahlfach%%20f%%C3%%BCr%%20alle/slides/einstieg/groesse-auswahl.html" in
          (destination / "start-presentation.cmd").read_text(encoding="ascii"),
          "Launcher kodiert den relativen Pfad für Windows")
    drawing = destination / "deck.js"
    drawing.write_text("// custom drawing\n", encoding="utf-8")
    rc, _ = run(*args)
    check(rc != 0 and drawing.read_text(encoding="utf-8") == "// custom drawing\n",
          "Ein zweiter Aufruf erhält die Zeichnung")
    standalone = project.parent / "standalone"
    rc, log = run(TOOLS / "new_deck.py", standalone)
    check(rc == 0 and (standalone / "style.toml").is_file()
          and version_of(standalone / "stagekit") == repo_version(), "Eigenständiges Deck startet mit lokalen Vorgaben",
          log.strip() if rc else "")


def export(tmp, update):
    print("4 Export des Testdecks")
    out = tmp / "export"
    rc, log = run(TOOLS / "export.py", DECK / "selftest.html", "--sheet", "--steps", "--fonts", "--out", out)
    if not check(rc == 0, "export.py läuft", log.strip()[-2000:] if rc else ""):
        return None
    m = re.search(r"(\d+) Frames", log)
    frames = int(m.group(1)) if m else 0
    check(frames > 0, "Frames gezählt", f"{frames}")
    check("WARNUNG" not in log, "keine fehlerhaften Frames",
          "; ".join(line.strip() for line in log.splitlines() if "WARNUNG" in line))
    check("ohne ergebnis" not in log, "jede Prüfung mit Ergebnis",
          "; ".join(line.strip() for line in log.splitlines() if "ohne ergebnis" in line))
    m = re.search(r"steps: .*?, (\d+) springen", log)
    check(m is not None and m.group(1) == "0", "nichts springt zwischen Aufbauschritten",
          "" if m else "keine Schrittprüfung in der Ausgabe")
    m = re.search(r"fonts: .*?, (\d+) mit fremden groessen", log)
    check(m is not None and m.group(1) == "0", "nur die vier Schriftgrößen",
          "; ".join(line.strip() for line in log.splitlines() if "px x" in line))
    pngs = sorted((out / "slides").glob("*.png"))
    if pngs:
        preview(out)
    overflow_bounds()
    visual_helpers(tmp)
    review(tmp)
    return pngs + [midstate(out / "slides")]


def review(tmp):
    out = tmp / "review"
    rc, log = run(TOOLS / "review.py", DECK / "selftest.html", "--audience", "test audience",
                  "--minutes", "10", "--no-sheet", "--out", out)
    slides = (DECK / "selftest.html").read_text(encoding="utf-8").count('class="slide')
    m = re.search(r"(\d+) Folien", log)
    files = all((out / f).is_file() for f in ("story.md", "metrics.md", "audience.md"))
    ok = rc == 0 and files and m is not None and int(m.group(1)) == slides
    detail = "" if ok else log.strip()[-1000:] if rc or not files else f"{m.group(1) if m else '?'} statt {slides} Folien"
    check(ok, "review.py liest jede Folie und schreibt seine drei Dateien", detail)


def overflow_bounds():
    rc, log = run(TOOLS / "export.py", DECK / "overflow.html", "--overflow")
    findings = [line.strip() for line in log.splitlines() if line.strip().startswith("Frame ")]
    check(rc == 1 and findings == [
        'Frame 3: "processing time" exceeds d.box() (right 18 px)',
        'Frame 4: "Slide edge" exceeds slide (left 24 px)',
        'Frame 4: "Cropped SVG" exceeds slide (left 12 px)',
    ] and "0 unchecked" in log, "Exakter Rand passt, Überläufe erst im sichtbaren Frame", log.strip())


def visual_helpers(tmp):
    import export as ex
    from PIL import Image, ImageChops

    # Edit the same two inputs an author would change, then inspect actual
    # browser geometry in the modified deck and its print view.
    demo = REPO / "examples" / "animations"
    folder = tmp / "project" / "visuals"
    folder.mkdir()
    shutil.copytree(demo / "img", folder / "img")
    shutil.copy(DECK / "theme.css", folder / "theme.css")
    html = (demo / "animations.html").read_text(encoding="utf-8")
    html = html.replace("../../themes/default.css", "theme.css").replace("../../", "../stagekit/")
    script = (demo / "deck.js").read_text(encoding="utf-8")
    script = script.replace("x: 760, y: 220", "x: 900, y: 220").replace("width: 180, height: 56", "width: 240, height: 56")
    script = script.replace("x: 700, y: 219, width: 231, height: 236", "x: 96, y: 250, width: 144, height: 96")
    (folder / "deck.js").write_text(script.replace('chip, "CPU"', 'chip, "USB port"'), encoding="utf-8")
    probe = """<script>
    const params = new URLSearchParams(location.search);
    if (params.has("print")) {
      const fig = document.getElementById("fig-zoom");
      const r = sel => fig.querySelector(sel).getBoundingClientRect();
      const view = r("svg"), label = r('[data-a="caption"] text'), box = r('[data-a="outline"] rect');
      const inside = b => b.width > 0 && b.left >= view.left && b.right <= view.right &&
        b.top >= view.top && b.bottom <= view.bottom;
      const outline = fig.querySelector('[data-a="outline"] rect');
      document.title = "TEST:" + (inside(box) && inside(label) && label.left >= box.right &&
        outline.getAttribute("x") === "96" && fig.querySelector("text").textContent === "USB port");
    } else if (["13", "14"].includes(params.get("slide"))) {
      const r = name => document.querySelector('#fig-net [data-a="' + name + '"] rect').getBoundingClientRect();
      const link = document.querySelector('#fig-net [data-a="link1"] line');
      const edges = link.getBoundingClientRect();
      const distance = params.get("slide") === "13" ? r("request").right - edges.right : r("reply").left - edges.left;
      const good = link.x2.baseVal.value === 900 && Math.abs(distance) < 0.5;
      document.title = "TEST:" + good;
    }
    </script>"""
    deck = folder / "visuals.html"
    deck.write_text(html.replace("</body>", probe + "</body>"), encoding="utf-8")
    srv, port = ex.serve(folder.parent)
    try:
        url = f"http://127.0.0.1:{port}/visuals/visuals.html"
        for query, name in [("slide=13&anim-t=" + str(1300 / 3700), "Packet stops at moved router"),
                            ("slide=14", "Returning packet stops at the sender edge"),
                            ("print", "Retargeted close-up and caption fit the final print frame")]:
            dom = ex.rendered(ex.chrome(), url + "?" + query) or ""
            check("<title>TEST:true</title>" in dom, name)
    finally:
        srv.shutdown()
        srv.server_close()

    rc, log = run(TOOLS / "export.py", deck, "--motion", 7, "--out", tmp / "motion")
    match = re.search(r"^motion: (.+)$", log, re.M)
    if check(rc == 0 and match, "Motion preview produced", log if rc else ""):
        strip = pathlib.Path(match[1].strip())
        with Image.open(strip) as sheet:
            check(sheet.size == (1920, 388), "Motion strip dimensions")
        panels = []
        for name in ("start", "midpoint", "end"):
            with Image.open(strip.parent / (name + ".png")) as frame:
                panels.append(frame.convert("RGB"))
        check(all(ImageChops.difference(a, b).getbbox() for a, b in zip(panels, panels[1:])),
              "Motion preview samples distinct positions")
    rc, log = run(TOOLS / "export.py", deck, "--motion", 1)
    check(rc != 0 and "no animation segment" in log, "Static frame rejected for motion preview")


def preview(out):
    from PIL import Image, ImageChops
    # A frame inside the JS-defined animation must select its whole build,
    # including the initial state. A written range may cross a slide boundary.
    for request, expected in [("18", range(16, 20)), ("19-20", range(19, 21))]:
        rc, log = run(TOOLS / "export.py", DECK / "selftest.html", "--out", out, "--frames", request)
        if not check(rc == 0, f"Vorschau {request} läuft", log if rc else ""):
            continue
        check(f"overflow: {len(expected)} frames checked, 0 findings, 0 unchecked" in log,
              "Vorschau prüft die Textgrenzen aller gewählten Frames")
        match = re.search(r"^sheet: (.+)$", log, re.M)
        if not check(bool(match), "Vorschau meldet den Kontaktbogen"):
            continue
        sheet = pathlib.Path(match[1].strip())
        pngs = sorted((sheet.parent / "slides").glob("*.png"))
        names = [f"{f:02d}.png" for f in expected]
        check(sheet.parent.parent == out.with_name(out.name + "-preview")
              and [p.name for p in pngs] == names, "Vorschau separat mit den gewählten Framenummern")
        with Image.open(sheet) as compact, Image.open(out / "sheet.png") as complete:
            check(compact.size == (len(expected) * 320, 198), "Kontaktbogen passt zur Framezahl")
            for i, f in enumerate(expected):
                x, y = (f - 1) % 6 * 320, (f - 1) // 6 * 198
                tile = complete.crop((x, y, x + 320, y + 198))
                check(ImageChops.difference(compact.crop((i * 320, 0, (i + 1) * 320, 198)), tile).getbbox() is None,
                      f"Kontaktbild und Beschriftung für Frame {f} wie im Gesamtexport")


def midstate(folder):
    """One frame half-way through an animation segment (?anim-t), so that the
    interpolation between keyframes is checked as well, not only the keyframes."""
    import export as ex
    srv, port = ex.serve(REPO)
    out = folder / "anim-half.png"
    ex.run(ex.chrome(), ["--window-size=1920,1080", f"--screenshot={out}",
                         f"http://127.0.0.1:{port}/tests/deck/selftest.html?slide={ANIM_FRAME}&anim-t=0.3"])
    srv.shutdown()
    check(out.is_file(), "Animation mitten in einem Abschnitt aufgenommen")
    return out


def write_references(pngs):
    if REFERENCE.exists():
        shutil.rmtree(REFERENCE)
    REFERENCE.mkdir(parents=True)
    for p in pngs:
        shutil.copy(p, REFERENCE / p.name)
    print(f"  neu    {len(pngs)} Referenzbilder in tests/reference/{PLATFORM}/")


def compare(pngs, tmp):
    print(f"5 Vergleich mit tests/reference/{PLATFORM}/")
    refs = sorted(REFERENCE.glob("*.png")) if REFERENCE.is_dir() else []
    if not refs:
        print(f"  --     keine Referenzframes für {PLATFORM}, übersprungen "
              f"(anlegen mit: python tools/selftest.py --update)")
        return
    from PIL import Image, ImageChops
    check(len(pngs) == len(refs), "Zahl der Frames", "" if len(pngs) == len(refs) else f"{len(pngs)} statt {len(refs)}")
    diffs = tmp / "diff"
    changed = []
    for p in pngs:
        ref = REFERENCE / p.name
        if not ref.is_file():
            continue
        a, b = Image.open(p).convert("RGB"), Image.open(ref).convert("RGB")
        if a.size != b.size:
            changed.append(p.name)
            continue
        r, g, bl = ImageChops.difference(a, b).split()
        diff = ImageChops.lighter(ImageChops.lighter(r, g), bl).point(lambda v: 255 if v > PIXEL_THRESHOLD else 0)
        count = diff.histogram()[255]
        if count > PIXEL_TOLERANCE:
            changed.append(f"{p.stem} ({count} Pixel)")
            diffs.mkdir(exist_ok=True)
            diff.save(diffs / p.name)
    check(not changed, "alle Frames wie die Referenz",
          ", ".join(changed) + (f"; neue Frames in {pngs[0].parent}, Unterschiede in {diffs}" if changed else ""))


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--quick", action="store_true", help="ohne Export, braucht kein Chrome")
    ap.add_argument("--update", action="store_true", help="Referenzframes und theme.css neu schreiben")
    ap.add_argument("--out", help="Arbeitsordner vorgeben (bleibt dann liegen), etwa für GitHub")
    a = ap.parse_args()
    if a.out:
        tmp = pathlib.Path(a.out).resolve()
        shutil.rmtree(tmp, ignore_errors=True)
        tmp.mkdir(parents=True)
    else:
        tmp = pathlib.Path(tempfile.mkdtemp(prefix="stagekit-selftest-"))
    print(f"stagekit {repo_version()} auf {PLATFORM}, Arbeitsordner {tmp}")
    syntax()
    theme(tmp, a.update)
    tools(tmp)
    if not a.quick:
        pngs = export(tmp, a.update)
        if pngs and a.update:
            write_references(pngs)
        elif pngs:
            compare(pngs, tmp)
    if failures:
        print(f"\n{len(failures)} Fehler. Arbeitsordner bleibt liegen: {tmp}")
        return 1
    shutil.rmtree(tmp, ignore_errors=True)
    print("\nAlles in Ordnung.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
