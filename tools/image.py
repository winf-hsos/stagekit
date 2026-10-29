# -*- coding: utf-8 -*-
"""Bilder mit OpenAIs GPT Image 2.5 erzeugen, für Fotofolien und Ähnliches.

    python tools/image.py "a photo of an elephant" ziel.png
    python tools/image.py "a sticker of a red led" icon.png --transparent
    python tools/image.py "…" ziel.png --model sunburst      # fuer Bearbeitungen mit Praezision

Zwei Modelle seit dem 08.09.2026 (developers.openai.com/api/docs/guides/image-generation):
`gpt-image-2.5-flare` ist der Standard, schnell und fuer alles Alltaegliche, laut
OpenAI besser als gpt-image-2 bei halber Latenz; `gpt-image-2.5-sunburst` ist fuer
Arbeitsablaeufe gedacht, in denen Bearbeitungspraezision zaehlt, und braucht laenger.
Beide kosten dieselben Token-Saetze. Qualitaet: low, medium, high, xhigh, max, auto.

Der API-Schlüssel kommt nur aus der Umgebungsvariable `OPENAI_API_KEY`.
Schlüsseldateien (`openai.key`, `~/.openai.key`) liest das Werkzeug seit dem
29.10.2026 nicht mehr: Die Suche danach hatte dazu geführt, dass Kopien des
Schlüssels in Projektordnern lagen.

Transparenter Hintergrund: `background: "transparent"` zusammen mit
`output_format: "png"` liefert ein PNG mit echtem Alpha-Kanal. Für Folienfotos auf schwarzem Grund meist
unnötig, für freigestellte Objekte genau richtig.

Folienfotos: 3840x2160 (16:9, 288 dpi auf der Folie) und schwarzer Grund im
Bild selbst, damit sie nahtlos in die Folie übergehen. Das ist zugleich die
groesste erlaubte Flaeche (8 294 400 Pixel, laengste Kante 3840); freie Groessen
sind Vielfache von 16 mit Seitenverhaeltnis zwischen 1:3 und 3:1.
"""
import argparse
import base64
import json
import os
import pathlib
import urllib.error
import urllib.request

API_URL = "https://api.openai.com/v1/images/generations"
MODELS = {"flare": "gpt-image-2.5-flare", "sunburst": "gpt-image-2.5-sunburst"}
MODEL = MODELS["flare"]


def read_api_key():
    key = os.environ.get("OPENAI_API_KEY", "").strip()
    if key:
        return key
    raise SystemExit(
        "OPENAI_API_KEY ist nicht gesetzt, ohne Schlüssel entsteht kein Bild. "
        "Den Schlüssel als Umgebungsvariable hinterlegen (Windows: "
        "setx OPENAI_API_KEY \"sk-...\", dann ein neues Terminal öffnen) "
        "oder den Nutzer fragen. Schlüsseldateien wie openai.key werden "
        "nicht mehr gelesen; bitte keine anlegen.")


def generate(prompt, target, size="1536x1024", quality="high",
             transparent=False, model=MODEL):
    model = MODELS.get(model, model)           # Kurzname oder volle Kennung
    payload = {
        "model": model,
        "prompt": prompt,
        "size": size,
        "quality": quality,
        "output_format": "png",
    }
    if transparent:
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
    print(f"geschrieben: {target}  ({len(image_bytes) // 1024} KB, {model})")
    return target


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("prompt", help="Bildbeschreibung, gern ausführlich")
    parser.add_argument("target", help="Zieldatei (.png)")
    parser.add_argument("--size", default="1536x1024",
                        help="1024x1024, 1536x1024 (16:10, Standard), "
                             "1024x1536, 3840x2160 (Folienfoto) oder auto")
    parser.add_argument("--quality", default="high",
                        choices=["low", "medium", "high", "xhigh", "max", "auto"])
    parser.add_argument("--transparent", action="store_true",
                        help="transparenter Hintergrund (PNG mit Alpha)")
    parser.add_argument("--model", default="flare",
                        help="flare (Standard, schnell) oder sunburst (Bearbeitungspraezision), "
                             "oder eine volle Modellkennung")
    args = parser.parse_args()
    generate(args.prompt, args.target, args.size, args.quality,
             args.transparent, args.model)


if __name__ == "__main__":
    main()
