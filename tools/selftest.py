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
   no text may leave the four sizes;
5. every frame is compared with tests/reference/<platform>/NN.png. Fonts
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
    for js in ("stagekit.js", "draw.js"):
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


def export(tmp, update):
    print("4 Export des Testdecks")
    out = tmp / "export"
    rc, log = run(TOOLS / "export.py", DECK / "selftest.html", "--png", "--steps", "--fonts", "--out", out)
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
    if update:
        if REFERENCE.exists():
            shutil.rmtree(REFERENCE)
        REFERENCE.mkdir(parents=True)
        for p in pngs:
            shutil.copy(p, REFERENCE / p.name)
        print(f"  neu    {len(pngs)} Referenzframes in tests/reference/{PLATFORM}/")
    return pngs


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
        if pngs and not a.update:
            compare(pngs, tmp)
    if failures:
        print(f"\n{len(failures)} Fehler. Arbeitsordner bleibt liegen: {tmp}")
        return 1
    shutil.rmtree(tmp, ignore_errors=True)
    print("\nAlles in Ordnung.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
