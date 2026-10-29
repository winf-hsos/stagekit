# -*- coding: utf-8 -*-
"""Bring a project's copy of the framework up to the current stagekit.

    python <stagekit>/tools/sync.py <project>            update the copy and the decks
    python <stagekit>/tools/sync.py <project> --check    only report, change nothing

<project> is either the copy itself (a folder holding stagekit.js) or the
folder that contains it as `stagekit/`. Decks load the framework through a
relative path from such a copy, because projects live in OneDrive, where a
link to C:\\code\\stagekit is not wanted.

What it does:

- copies the runtime files (stagekit.css, stagekit.js, draw.js, the code
  font and its NOTICE) into the copy, and only those that differ;
- sets the cache buster in every deck of the project that loads this copy
  to `?v=<version>-<hash>`, so browsers fetch the new files; decks that load
  another copy (a website's generated folder, say) are left alone.

Files are only written when their content changes: a needless write below a
watched folder sends `quarto preview` into a rebuild loop.

--check exits with 1 when the copy or a deck is behind, otherwise 0.
"""
import argparse
import pathlib
import re
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from stagekit_version import REPO, RUNTIME, cache_tag, version_of  # noqa: E402

SKIP = {".git", "node_modules", "export", "_site", ".quarto", "__pycache__"}
REF = re.compile(r'((?:src|href)=")([^"]*?)(stagekit\.js|stagekit\.css|draw\.js)(\?v=[^"]*)?(")')


def same(a, b):
    """Equal content, line endings ignored (git may have checked out CRLF)."""
    return b.is_file() and a.read_bytes().replace(b"\r\n", b"\n") == b.read_bytes().replace(b"\r\n", b"\n")


def decks(project, copy):
    """(html file, new text) for every deck in `project` that loads `copy`."""
    copy = copy.resolve()
    tag = None
    for path in project.rglob("*.html"):
        if SKIP.intersection(path.relative_to(project).parts) or copy in path.resolve().parents:
            continue
        with open(path, encoding="utf-8", errors="surrogateescape", newline="") as f:
            text = f.read()
        hits = [m for m in REF.finditer(text) if (path.parent / m.group(2)).resolve() == copy]
        if not hits:
            continue
        tag = tag or cache_tag(REPO)
        new = REF.sub(lambda m: (m.group(1) + m.group(2) + m.group(3) + f"?v={tag}" + m.group(5))
                      if (path.parent / m.group(2)).resolve() == copy else m.group(0), text)
        yield path, text, new


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("project", help="Projektordner oder die Kopie selbst")
    ap.add_argument("--check", action="store_true", help="nur melden, nichts schreiben")
    a = ap.parse_args()

    project = pathlib.Path(a.project).resolve()
    if not project.is_dir():
        raise SystemExit(f"kein Ordner: {project}")
    if (project / "stagekit.js").is_file():
        copy, project = project, project.parent
    else:
        copy = project / "stagekit"
    if copy.resolve() == REPO:
        raise SystemExit("Das ist das Repository selbst, keine Kopie.")

    have, want = version_of(copy), version_of(REPO)
    print(f"Kopie:  {copy}  ({have or 'ohne Version, vor 0.1.0' if copy.exists() else 'fehlt noch'})")
    print(f"Quelle: {REPO}  ({want})")

    stale_files = [n for n in RUNTIME if not same(REPO / n, copy / n)]
    if not a.check:
        for name in stale_files:
            (copy / name).parent.mkdir(parents=True, exist_ok=True)
            (copy / name).write_bytes((REPO / name).read_bytes())
    print(f"Dateien: {len(RUNTIME) - len(stale_files)} aktuell, {len(stale_files)} "
          + ("veraltet" if a.check else "erneuert") + (": " + ", ".join(stale_files) if stale_files else ""))

    stale_decks = []
    for path, text, new in decks(project, copy):
        if new != text:
            stale_decks.append(path)
            if not a.check:
                with open(path, "w", encoding="utf-8", errors="surrogateescape", newline="") as f:
                    f.write(new)
    for path in stale_decks:
        print(f"  {'veraltet' if a.check else 'erneuert'}: {path.relative_to(project)}")
    print(f"Decks: {len(stale_decks)} mit " + ("veralteter" if a.check else "neuer")
          + f" Cache-Kennung ?v={cache_tag(REPO)}")
    return 1 if a.check and (stale_files or stale_decks) else 0


if __name__ == "__main__":
    sys.exit(main())
