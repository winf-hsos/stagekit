# -*- coding: utf-8 -*-
"""Bilder mit OpenAIs gpt-image-2 erzeugen, für Fotofolien und Ähnliches.

    python tools/image.py "a photo of an elephant" ziel.png
    python tools/image.py "a sticker of a red led" icon.png --transparent

Der API-Schlüssel wird in dieser Reihenfolge gesucht:

1. Umgebungsvariable `OPENAI_API_KEY`
2. `openai.key` oder `tools/openai.key` im Arbeitsverzeichnis, dann aufwärts
   durch die Elternordner (eine Zeile, nur der Schlüssel)
3. `~/.openai.key`

Transparenter Hintergrund ist bei gpt-image-2 ein Preview (seit August 2026):
`background: "transparent"` zusammen mit `output_format: "png"` liefert ein
PNG mit echtem Alpha-Kanal. Für Folienfotos auf schwarzem Grund meist
unnötig, für freigestellte Objekte genau richtig.

Folienfotos: 3840x2160 (16:9, 288 dpi auf der Folie) und schwarzer Grund im
Bild selbst, damit sie nahtlos in die Folie übergehen.
"""
import argparse
import base64
import json
import os
import pathlib
import urllib.error
import urllib.request

API_URL = "https://api.openai.com/v1/images/generations"
MODEL = "gpt-image-2"


def find_key_file():
    """Die zuständige Schlüsseldatei finden, oder None."""
    here = pathlib.Path.cwd()
    for folder in [here, *here.parents]:
        for candidate in (folder / "openai.key",
                          folder / "tools" / "openai.key"):
            if candidate.is_file():
                return candidate
    home = pathlib.Path.home() / ".openai.key"
    if home.is_file():
        return home
    return None


def read_api_key():
    key = os.environ.get("OPENAI_API_KEY", "").strip()
    if key:
        return key
    key_file = find_key_file()
    if key_file is not None:
        key = key_file.read_text(encoding="utf-8").strip()
        if key:
            return key
    raise SystemExit(
        "Kein API-Schlüssel gefunden. Entweder die Umgebungsvariable "
        "OPENAI_API_KEY setzen oder den Schlüssel in `openai.key` im "
        "Projekt (auch `tools/openai.key`) oder in `~/.openai.key` legen "
        "(eine Zeile, nur der Schlüssel).")


def generate(prompt, target, size="1536x1024", quality="high",
             transparent=False):
    payload = {
        "model": MODEL,
        "prompt": prompt,
        "size": size,
        "quality": quality,
        "output_format": "png",
    }
    if transparent:
        # Preview-Parameter, siehe Docstring oben.
        payload["background"] = "transparent"

    request = urllib.request.Request(
        API_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {read_api_key()}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=300) as response:
            result = json.load(response)
    except urllib.error.HTTPError as error:
        details = error.read().decode("utf-8", errors="replace")
        raise SystemExit(f"OpenAI meldet {error.code}:\n{details}")

    image_bytes = base64.b64decode(result["data"][0]["b64_json"])
    target = pathlib.Path(target)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(image_bytes)
    print(f"geschrieben: {target}  ({len(image_bytes) // 1024} KB)")
    return target


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("prompt", help="Bildbeschreibung, gern ausführlich")
    parser.add_argument("target", help="Zieldatei (.png)")
    parser.add_argument("--size", default="1536x1024",
                        help="1024x1024, 1536x1024 (16:10, Standard), "
                             "1024x1536, 3840x2160 (Folienfoto) oder auto")
    parser.add_argument("--quality", default="high",
                        choices=["low", "medium", "high", "auto"])
    parser.add_argument("--transparent", action="store_true",
                        help="transparenter Hintergrund (Preview)")
    args = parser.parse_args()
    generate(args.prompt, args.target, args.size, args.quality,
             args.transparent)


if __name__ == "__main__":
    main()
