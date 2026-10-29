# -*- coding: utf-8 -*-
"""Turn the "Unveröffentlicht" section of CHANGELOG.md into a release.

    python tools/release.py --notes            print what the next release contains
    python tools/release.py --notes 0.2.0      print the notes of a past release
    python tools/release.py minor              release: patch | minor | major | X.Y.Z
    python tools/release.py minor --dry-run    show what would happen, change nothing

A release sets the version in stagekit.js, renames the section to
"## X.Y.Z (YYYY-MM-DD)" with a fresh empty "Unveröffentlicht" above it,
commits both files as "Release vX.Y.Z" and creates the annotated tag vX.Y.Z.

It does not push. Publishing needs Nicolas' word; then
`git push origin main vX.Y.Z`, and the workflow in .github/workflows/release.yml
creates the GitHub release from the same notes.
"""
import argparse
import datetime
import pathlib
import re
import subprocess
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from stagekit_version import REPO, VERSION_RE, parse, repo_version  # noqa: E402

CHANGELOG = REPO / "CHANGELOG.md"
UNRELEASED = "## Unveröffentlicht"


def git(*args, check=True):
    r = subprocess.run(["git", *args], cwd=REPO, capture_output=True, text=True, encoding="utf-8")
    if check and r.returncode:
        raise SystemExit(f"git {' '.join(args)}: {r.stderr.strip()}")
    return r.stdout.strip()


def section(text, heading):
    """Body of the '## …' section starting with `heading`, up to the next '## '."""
    m = re.search(rf"^{re.escape(heading)}[^\n]*\n(.*?)(?=^## |\Z)", text, flags=re.M | re.S)
    return m.group(1).strip() if m else None


def entries(body):
    return [line for line in (body or "").splitlines() if line.startswith("- ")]


def tags():
    return [t for t in git("tag", "--list", "v*").split() if re.fullmatch(r"v\d+\.\d+\.\d+", t)]


def next_version(arg):
    if re.fullmatch(r"\d+\.\d+\.\d+", arg):
        return arg
    released = sorted(parse(t[1:]) for t in tags())
    major, minor, patch = released[-1] if released else (0, 0, 0)
    if arg == "major":
        return f"{major + 1}.0.0"
    if arg == "minor":
        return f"{major}.{minor + 1}.0"
    if arg == "patch":
        return f"{major}.{minor}.{patch + 1}"
    raise SystemExit(f"unbekannte Stufe: {arg} (patch, minor, major oder X.Y.Z)")


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("level", nargs="?", help="patch | minor | major | X.Y.Z")
    ap.add_argument("--notes", nargs="?", const="", metavar="VERSION",
                    help="Notizen ausgeben: ohne Wert die unveröffentlichten, sonst die einer Version")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    text = CHANGELOG.read_text(encoding="utf-8")

    if a.notes is not None:
        body = section(text, f"## {a.notes.lstrip('v')} (") if a.notes else section(text, UNRELEASED)
        if body is None:
            raise SystemExit(f"kein Abschnitt für {a.notes or 'Unveröffentlicht'} in CHANGELOG.md")
        print(body)
        return 0
    if not a.level:
        ap.error("Stufe fehlt (patch, minor, major oder X.Y.Z), oder --notes")

    body = section(text, UNRELEASED)
    if not entries(body):
        raise SystemExit("Unter „Unveröffentlicht“ steht nichts; es gibt nichts zu veröffentlichen.")
    version = next_version(a.level)
    if f"v{version}" in tags():
        raise SystemExit(f"v{version} gibt es schon.")
    released = sorted(parse(t[1:]) for t in tags())
    if released and parse(version) <= released[-1]:
        raise SystemExit(f"{version} ist nicht größer als die letzte Version v{'.'.join(map(str, released[-1]))}.")
    dirty = git("status", "--porcelain", "--untracked-files=no")
    if dirty:
        raise SystemExit("Es gibt Änderungen ohne Commit; erst committen, dann veröffentlichen:\n" + dirty)
    if git("rev-parse", "--abbrev-ref", "HEAD") != "main":
        raise SystemExit("Releases nur von main.")

    today = datetime.date.today().isoformat()
    print(f"Version {repo_version()} -> {version} ({today}), {len(entries(body))} Einträge:\n")
    print(body + "\n")
    if a.dry_run:
        print("Trockenlauf: nichts geändert.")
        return 0

    js = REPO / "stagekit.js"
    js.write_text(VERSION_RE.sub(f'const VERSION = "{version}";', js.read_text(encoding="utf-8"), count=1),
                  encoding="utf-8")
    CHANGELOG.write_text(text.replace(UNRELEASED + "\n", f"{UNRELEASED}\n\n## {version} ({today})\n", 1),
                         encoding="utf-8")
    git("add", "stagekit.js", "CHANGELOG.md")
    git("commit", "-q", "-m", f"Release v{version}")
    git("tag", "-a", f"v{version}", "-m", f"stagekit {version}\n\n{body}")
    print(f"Commit und Tag v{version} angelegt, nichts gepusht.")
    print(f"Veröffentlichen nur mit Nicolas' Wort: git push origin main v{version}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
