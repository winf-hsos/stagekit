# -*- coding: utf-8 -*-
"""Version helpers shared by release.py, sync.py, export.py and selftest.py.

The one place the version lives is the line `const VERSION = "x.y.z";` in
stagekit.js. A copy of the framework in a project therefore carries its
version with it, whether it came there through tools/sync.py or by hand.
"""
import hashlib
import pathlib
import re

REPO = pathlib.Path(__file__).resolve().parents[1]

# what a deck loads at runtime; tools/sync.py copies exactly these
RUNTIME = ["stagekit.css", "stagekit.js", "draw.js",
           "fonts/RobotoMono-Regular.woff2", "fonts/NOTICE"]

VERSION_RE = re.compile(r'const VERSION = "([^"]+)";')


def version_of(folder):
    """Version of the framework in `folder`, or None for copies made before 0.1.0."""
    js = pathlib.Path(folder) / "stagekit.js"
    if not js.is_file():
        return None
    m = VERSION_RE.search(js.read_text(encoding="utf-8", errors="ignore"))
    return m.group(1) if m else None


def repo_version():
    return version_of(REPO)


def content_hash(folder):
    """Short hash over the three code files, line endings ignored.

    Part of the cache buster (?v=0.1.0-1a2b3c): between two releases the
    version stays the same while the code may not, and a browser must still
    load the new files.
    """
    h = hashlib.sha1()
    for name in ("stagekit.css", "stagekit.js", "draw.js"):
        p = pathlib.Path(folder) / name
        h.update(p.read_bytes().replace(b"\r\n", b"\n") if p.is_file() else b"")
    return h.hexdigest()[:6]


def cache_tag(folder):
    return f"{version_of(folder) or '0'}-{content_hash(folder)}"


def parse(v):
    """'1.2.3' -> (1, 2, 3)."""
    m = re.fullmatch(r"(\d+)\.(\d+)\.(\d+)", v or "")
    if not m:
        raise ValueError(f"keine Versionsnummer: {v!r}")
    return tuple(int(x) for x in m.groups())
