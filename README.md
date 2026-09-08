# stagekit

Foliensätze als HTML: eine Datei je Satz, Zeichnungen als SVG, Demonstratoren eingebettet, Design aus einer Datei. Entstanden im LiFi-Projekt der Hochschule Osnabrück als Nachfolger von `slidekit` (PowerPoint), ausgegründet als eigenständiges Werkzeug für weitere Module und Vorträge.

Grundsätze, geerbt von slidekit:

- **Feste Palette** (acht Farben mit Bedeutung), **vier Schriftgrößen**, Folientext kleingeschrieben, kein Kursiv. Alles davon steht in `theme.css` und nirgends sonst.
- **Struktur je Satz:** Titelfolie, Agenda, je Teil eine Abschnittsfolie, Ortsangabe (Balken plus Teilname, Farbe je Teil möglich) auf jeder Inhaltsfolie.
- **Aufbau in Schritten statt Animationen:** Elemente mit `data-step="n"` erscheinen nacheinander, behalten aber ihren Platz, damit nichts springt.
- **Eine Aussage je Folie,** wenig Text, die Aussage steckt im Bild, der Rest in den Sprechernotizen.

Was neu ist:

- **Zeichnungen sind SVG** (`draw.js`): Kästen, Pfeile, Leitungen mit Strom, Gatter, Lampen, Schalter, Wahrheitstafeln. Sie skalieren verlustfrei und lesen ihre Farben aus dem Theme.
- **Demonstratoren laufen auf der Folie** (`<div class="embed"><iframe …>`), nicht hinter einem Link.
- **Sprechernotizen** in einem zweiten Fenster (Taste N), synchron über einen BroadcastChannel; Vollbild mit F; Druckansicht mit P.
- **Export** als PDF, PNG je Folie und Kontaktbogen über `tools/export.py` (Headless Chrome).

## Dateien

| Datei | Inhalt |
|---|---|
| `stagekit.css` | Layout und Typografie; liest alle Werte aus dem Theme |
| `stagekit.js` | Laufzeit: Titel und Agenda erzeugen, Ortsangabe, Schritte, Tastatur, Notizfenster, Druckansicht, Hash-Routing |
| `draw.js` | SVG-Helfer: `svg`, `box`, `label`, `line`, `arrow`, `wire`, `dot`, `gate`, `lamp`, `toggle`, `truthTable` |
| `themes/default.css` | die Design-Tokens; Vorlage für die `theme.css` eines Projekts |
| `tools/theme.py` | erzeugt `theme.css` aus einer `style.toml` (dasselbe Format wie slidekit) |
| `tools/export.py` | PDF, PNGs, Kontaktbogen (je Frame: jeder Aufbauschritt einzeln), Schrittprüfung (`--steps`: meldet Elemente, die zwischen Aufbauschritten wandern), Schriftprüfung (`--fonts`: meldet Textgrößen außerhalb der vier Stufen) |
| `template/deck.html` | Startpunkt für einen neuen Satz |
| `SKILL.md` | der Arbeitsablauf für Agenten |

## Ein Deck anlegen

1. `theme.css` erzeugen: `python tools/theme.py style.toml <deckordner>/theme.css` (oder `themes/default.css` kopieren und anpassen).
2. `template/deck.html` in den Deckordner kopieren, die zwei Pfade zu stagekit anpassen, `data-title`, `data-subtitle`, `data-parts` setzen.
3. Folien schreiben: `<section class="slide">` mit `<h2>` (kleine Überschrift), `.content` mit `.header`, `.statement`, `.lines`, `.code`, `.sidenote`, `.remark`, dazu `.footnote`; Zeichnungen in `.figure`, Fotos als `<img class="photo">` mit `.photo-text`, Einbettungen in `.embed`; Notizen in `<aside class="notes">`.
4. Ansehen: die Datei im Browser öffnen (Schriften laden über Google Fonts). Für Einbettungen und Export einen lokalen Server nutzen, `tools/export.py` bringt seinen eigenen mit.
5. Export: `python tools/export.py <deck.html>`.

## Tastatur

→ ↓ Leertaste PgDn: weiter (erst Schritte, dann Folien) · ← ↑ PgUp: zurück · Home/End · F: Vollbild · N: Notizfenster · P: Druckansicht · Klick rechts/links im Fenster: weiter/zurück.

## Adresse

`deck.html#12` öffnet Frame 12; ein Aufbauschritt ist ein Frame mit eigener Nummer, wie bei slidekit. `?slide=12` dasselbe (für Screenshots). `?print` zeigt alle Frames untereinander. `?notes` ist das Notizfenster.
