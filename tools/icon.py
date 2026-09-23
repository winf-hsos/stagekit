# -*- coding: utf-8 -*-
"""Symbole aus Bootstrap Icons suchen und als Schnipsel fuer eine Folie ausgeben.

    python tools/icon.py --search calendar            # passende Namen finden
    python tools/icon.py calendar-week                # <svg> fuer index.html
    python tools/icon.py arrow-repeat --js            # Pfade fuer d.icon() in deck.js

Bootstrap Icons (https://icons.getbootstrap.com) stehen unter der MIT-Lizenz,
Copyright The Bootstrap Authors. Jedes Schnipsel traegt deshalb einen Kommentar
mit Name und Lizenz; der gehoert mit in die Folie, damit die Herkunft nachvollziehbar
bleibt. Eine Namensnennung auf der Folie selbst ist nicht noetig.

Die Symbole haben alle eine viewBox von 16 x 16 und fuellen mit currentColor. In
HTML bestimmt deshalb `color` die Farbe; das Schnipsel setzt sie auf eine
Theme-Farbe (Standard var(--blue)), nie auf einen Hex-Wert.

Die Version ist festgeschrieben, damit ein Symbol morgen noch genauso aussieht.
Geladen wird von jsdelivr und in tools/.icons/ zwischengespeichert; ein zweiter
Aufruf braucht kein Netz.
"""
import argparse
import json
import pathlib
import re
import sys
import urllib.request

VERSION = "1.11.3"
BASE = f"https://cdn.jsdelivr.net/npm/bootstrap-icons@{VERSION}"
CACHE = pathlib.Path(__file__).parent / ".icons"


def fetch(rel):
    CACHE.mkdir(exist_ok=True)
    local = CACHE / rel.replace("/", "_")
    if not local.exists():
        with urllib.request.urlopen(f"{BASE}/{rel}", timeout=20) as r:
            local.write_bytes(r.read())
    return local.read_text(encoding="utf-8")


def names():
    return sorted(json.loads(fetch("font/bootstrap-icons.json")).keys())


def inner(name):
    """Die Pfade eines Symbols, ohne das umschliessende <svg>."""
    try:
        svg = fetch(f"icons/{name}.svg")
    except Exception:
        sys.exit(f"Kein Symbol '{name}'. Mit --search nach passenden Namen suchen.")
    m = re.search(r"<svg[^>]*>(.*)</svg>", svg, re.S)
    return re.sub(r"\s*\n\s*", "", m.group(1)).strip()


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("name", nargs="?", help="Name des Symbols, z. B. calendar-week")
    ap.add_argument("--search", help="Namen suchen, die diesen Text enthalten")
    ap.add_argument("--size", type=int, default=80, help="Kantenlaenge in px auf der 1920er Leinwand (Standard 80)")
    ap.add_argument("--color", default="var(--blue)", help="Theme-Farbe, Standard var(--blue)")
    ap.add_argument("--js", action="store_true", help="nur die Pfade als JS-String fuer d.icon()")
    a = ap.parse_args()

    if a.search:
        treffer = [n for n in names() if a.search.lower() in n]
        print("\n".join(treffer) if treffer else "keine Treffer")
        return
    if not a.name:
        ap.error("Name oder --search angeben")

    pfade = inner(a.name)
    herkunft = f'Bootstrap Icons "{a.name}" {VERSION} (MIT, (c) The Bootstrap Authors)'
    if a.js:
        print(f"// {herkunft}")
        print(f"const ICON_{a.name.upper().replace('-', '_')} = '{pfade}';")
    else:
        print(f"<!-- {herkunft} -->")
        print(f'<svg class="icon" viewBox="0 0 16 16" width="{a.size}" height="{a.size}" fill="currentColor" '
              f'style="color: {a.color}" aria-hidden="true">{pfade}</svg>')


if __name__ == "__main__":
    main()
