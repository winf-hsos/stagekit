# -*- coding: utf-8 -*-
"""Legt im Deckordner start-presentation.cmd an: Doppelklick startet den Vortrag.

    python <stagekit>/tools/start_script.py <ordner>/<deck>.html [--port N]

Ein Deck braucht zum Vortragen einen lokalen Server: Live-Abfragen und
eingebettete Demonstratoren laufen nicht unter file://. Der Server muss in
dem Ordner laufen, der Deck **und** Framework enthält. Wie weit das nach oben
geht, steht im Deck selbst: Lädt es `../../stagekit/stagekit.js`, liegt die
Wurzel zwei Ordner über dem Deck. Dieses Werkzeug liest das aus und schreibt
ein Startskript, das

- in diese Wurzel wechselt,
- den Browser auf das Deck öffnet und
- `python -m http.server` startet (Fenster offen lassen, Schließen beendet ihn).

Der Port ergibt sich fest aus dem Decknamen (8800 bis 8899), damit zwei Decks
gleichzeitig laufen können und dasselbe Deck immer dieselbe Adresse hat;
`--port` setzt ihn von Hand. Ein älteres `Vortrag starten.cmd` im Deckordner
wird durch das neue ersetzt (Regel vom 01.10.2026).
"""
import argparse
import pathlib
import re
import sys
import zlib

VORLAGE = r"""@echo off
rem start-presentation.cmd: startet das Deck "{deck}" ueber einen lokalen Server.
rem Erzeugt von stagekit/tools/start_script.py; nicht von Hand aendern, neu erzeugen.
rem Der Server laeuft in dem Ordner, der Deck und stagekit enthaelt.
rem Fenster offen lassen, solange vorgetragen wird; Schliessen beendet den Server.
cd /d "%~dp0{hoch}"
start "" http://127.0.0.1:{port}/{pfad}
python -m http.server {port} --bind 127.0.0.1
"""


def tiefe(html_text):
    """Wie viele Ordner der Verweis auf stagekit nach oben geht (0 = daneben)."""
    treffer = re.findall(r'(?:src|href)="((?:\.\./)*)stagekit/', html_text)
    if not treffer:
        raise SystemExit("Das Deck laedt kein stagekit/ ueber einen relativen Pfad; "
                         "Startskript nicht erzeugt.")
    return max(t.count("../") for t in treffer)


def main(argv):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("deck", type=pathlib.Path)
    ap.add_argument("--port", type=int)
    args = ap.parse_args(argv)

    deck = args.deck.resolve()
    if not deck.is_file():
        raise SystemExit(f"{deck} gibt es nicht.")
    n = tiefe(deck.read_text(encoding="utf-8"))
    wurzel = deck.parent
    for _ in range(n):
        wurzel = wurzel.parent
    pfad = deck.relative_to(wurzel).as_posix()
    port = args.port or 8800 + zlib.crc32(deck.stem.encode("utf-8")) % 100

    text = VORLAGE.format(deck=deck.stem, hoch="..\\" * n, port=port, pfad=pfad)
    ziel = deck.parent / "start-presentation.cmd"
    neu = text.replace("\n", "\r\n").encode("ascii")
    if not (ziel.exists() and ziel.read_bytes() == neu):
        ziel.write_bytes(neu)
    alt = deck.parent / "Vortrag starten.cmd"
    if alt.exists():
        alt.unlink()
        print(f"  ersetzt: {alt.name}")
    print(f"{ziel}  (Port {port}, Server in {wurzel})")


if __name__ == "__main__":
    main(sys.argv[1:])
