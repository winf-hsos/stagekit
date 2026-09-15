# stagekit

Foliensätze als HTML: eine Datei je Satz, Zeichnungen als SVG, Demonstratoren eingebettet, Design aus einer Datei. Entstanden im LiFi-Projekt der Hochschule Osnabrück, ausgegründet als eigenständiges Werkzeug für weitere Module und Vorträge.

Grundsätze:

- **Feste Palette** (acht Farben mit Bedeutung), **vier Schriftgrößen**, Folientext kleingeschrieben, kein Kursiv. Alles davon steht in `theme.css` und nirgends sonst.
- **Struktur je Satz:** Titelfolie, Agenda, je Teil eine Abschnittsfolie, Ortsangabe (Balken plus Teilname, Farbe je Teil möglich) auf jeder Inhaltsfolie.
- **Aufbau in Schritten statt Animationen:** Elemente mit `data-step="n"` erscheinen nacheinander, behalten aber ihren Platz, damit nichts springt.
- **Eine Aussage je Folie,** wenig Text, die Aussage steckt im Bild, der Rest in den Sprechernotizen.

Was neu ist:

- **Zeichnungen sind SVG** (`draw.js`): Kästen, Pfeile, Leitungen mit Strom, Gatter, Lampen, Schalter, Wahrheitstafeln. Sie skalieren verlustfrei und lesen ihre Farben aus dem Theme.
- **Demonstratoren laufen auf der Folie** (`<div class="embed"><iframe …>`), nicht hinter einem Link.
- **Sprechernotizen** in einem zweiten Fenster (Taste N), synchron über einen BroadcastChannel; Vollbild mit F; Druckansicht mit P.
- **Export** als PDF, PNG je Folie und Kontaktbogen über `tools/export.py` (Headless Chrome). Das PDF ist Vektor: Chrome druckt die Druckansicht direkt, Text bleibt Text und Zeichnungen bleiben SVG. **Ausnahme: eingebettete Demonstratoren drucken nicht mit** — ein `<iframe>` bleibt im PDF leer. Decks, die davon leben, brauchen `--pdf-raster`.

## Dateien

| Datei | Inhalt |
|---|---|
| `stagekit.css` | Layout und Typografie; liest alle Werte aus dem Theme |
| `stagekit.js` | Laufzeit: Titel und Agenda erzeugen, Ortsangabe, Schritte, Tastatur, Notizfenster, Druckansicht, Hash-Routing |
| `draw.js` | SVG-Helfer: `svg`, `box`, `label`, `line`, `arrow`, `wire`, `dot`, `gate`, `lamp`, `toggle`, `truthTable` |
| `themes/default.css` | die Design-Tokens; Vorlage für die `theme.css` eines Projekts |
| `tools/theme.py` | erzeugt `theme.css` aus einer `style.toml`; `[colors.light]` wird zum Block `:root[data-theme="light"]`, den `?theme=light` in der Adresse einschaltet |
| `tools/figures.py` | rendert die in `figures.js` eines Decks benannten Zeichnungen als eigenständige SVG-Dateien in einer Palette der `theme.css` (`--theme light`), Codeschrift eingebettet; für Website-Abbildungen, die dieselben sind wie auf den Folien |
| `tools/image.py` | erzeugt Bilder über die OpenAI-API (gpt-image-2), für Fotofolien; Schlüssel aus `OPENAI_API_KEY`, `openai.key` im Projekt oder `~/.openai.key` |
| `tools/export.py` | PDF, PNGs, Kontaktbogen (je Frame: jeder Aufbauschritt einzeln), Schrittprüfung (`--steps`: meldet Elemente, die zwischen Aufbauschritten wandern), Schriftprüfung (`--fonts`: meldet Textgrößen außerhalb der vier Stufen). PDF vektoriell aus `?print`; `--pdf-raster` baut es stattdessen aus den Frame-PNGs (nötig bei eingebetteten Demonstratoren) |
| `template/deck.html` | Startpunkt für einen neuen Satz |
| `SKILL.md` | der Arbeitsablauf für Agenten |

## Drittinhalte

`fonts/RobotoMono-Regular.woff2` ist Roboto Mono, Copyright 2015 The Roboto Mono Project Authors, lizenziert unter der [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0) — siehe `fonts/NOTICE`. Die MIT-Lizenz dieses Repositorys gilt für stagekit selbst, nicht für die Schrift.

## Ein Deck anlegen

1. `theme.css` erzeugen: `python tools/theme.py style.toml <deckordner>/theme.css` (oder `themes/default.css` kopieren und anpassen).
2. `template/deck.html` in den Deckordner kopieren, die zwei Pfade zu stagekit anpassen, `data-title`, `data-subtitle`, `data-parts` setzen.
3. Folien schreiben: `<section class="slide">` mit `<h2>` (kleine Überschrift), `.content` mit `.header`, `.statement`, `.lines`, `.code`, `.sidenote`, `.remark`, dazu `.footnote`; Zeichnungen in `.figure`, Fotos als `<img class="photo">` mit `.photo-text`, Einbettungen in `.embed`; Notizen in `<aside class="notes">`.
4. Ansehen: die Datei im Browser öffnen (Schriften laden über Google Fonts). Für Einbettungen und Export einen lokalen Server nutzen, `tools/export.py` bringt seinen eigenen mit.
5. Export: `python tools/export.py <deck.html>`. Das PDF entsteht vektoriell; trägt der Satz eingebettete Demonstratoren, stattdessen `--pdf-raster` nehmen, weil ein `<iframe>` nicht mitdruckt.

## Tastatur

→ ↓ Leertaste PgDn: weiter (erst Schritte, dann Folien) · ← ↑ PgUp: zurück · Home/End · F: Vollbild · N: Notizfenster · P: Druckansicht · Klick rechts/links im Fenster: weiter/zurück.

## Adresse

`deck.html#12` öffnet Frame 12; ein Aufbauschritt ist ein Frame mit eigener Nummer. `?slide=12` dasselbe (für Screenshots). `?print` zeigt alle Frames untereinander. `?notes` ist das Notizfenster.
