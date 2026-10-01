# Changelog

Was sich an stagekit geändert hat, neueste oben. Je Eintrag: was sich geändert
hat und, wo nötig, **was bestehende Decks tun müssen**. Gepflegt im selben
Commit wie die Änderung (Regel in `SKILL.md`, Abschnitt „Änderungen an
stagekit selbst“). Die Einträge bis zum 30.09.2026 sind am 01.10.2026 aus der
Git-Historie nachgetragen.

## 2026-10-01

- **Startskript je Deck:** neues Werkzeug `tools/start_script.py` legt im
  Deckordner `start-presentation.cmd` an (Server in dem Ordner, der Deck und
  Framework enthält, Port fest aus dem Decknamen, Browser öffnet das Deck).
  Regel in `SKILL.md`, Abschnitt 3. *Decks:* einmal
  `python <stagekit>/tools/start_script.py <deck>.html` ausführen; ein
  vorhandenes `Vortrag starten.cmd` wird dabei ersetzt.
- **Changelog:** diese Datei, rückwirkend aus der Git-Historie; Pflicht zur
  Pflege in `SKILL.md`.
- **Gestaltungsregel „keine Stakkato-Sätze“:** Punchlines, Merksätze, Titel,
  Untertitel und Sprechernotizen reihen keine kurzen Sätze oder Halbsätze als
  Effekt aneinander. *Decks:* bestehende Punchlines bei der nächsten
  Überarbeitung prüfen.

## 2026-09-30

- **Taste M** schaltet den Mauszeiger durch: normal, Laserpointer, ganz
  ausgeblendet; mit gedrückter Maustaste zieht der Laserpointer eine
  verblassende Spur statt Text zu markieren. *Decks:* Framework-Dateien
  neu kopieren.
- **Druckansicht:** `figcode` wird im Druck ausgeblendet, Folien werden
  beschnitten.

## 2026-09-29

- **Code-Folien:** Hervorhebung des Neuen mit `.hl`; Abbildungen aus Code
  tragen den Code unsichtbar (`.figcode`) mit Kopierknopf und Augensymbol
  („show code“), das ihn als Fenster über die Folie legt.
- **Punchline** verschiebt den Inhalt nicht mehr (`has-punch` kürzt oben und
  unten gleich).
- **Adressen auf Folien** sind Links, Hover unterstreicht.
- **Live-Abfragen:** `data-live-module` ordnet Sitzungen dem jüngsten Kurs
  eines Moduls zu; Referenzserver ist `classroom-live`.
- **SKILL:** R-Code auf Folien, nach jeder Pipe eine neue Zeile.

## 2026-09-28

- **Live-Abfragen als Baustein:** `.slide.poll` mit QR-Code, Sitzungscode,
  Live-Zeichen und Ergebnisbalken.
- **Kopierknopf an jedem Codeblock** (Symbol statt Text), Regel im SKILL.
- **export.py:** abgewiesene Verbindungen behoben (große Warteschlange),
  ungestylte Frames werden erkannt und nachgeholt.

## 2026-09-24

- **Deck-Dateien heißen nach dem Titel** statt `index.html`; das PDF
  übernimmt den Namen.

## 2026-09-23

- **Bootstrap Icons:** `tools/icon.py`, `draw.icon()` und Regel im SKILL.

## 2026-09-16

- **image.py** auf GPT Image 2.5 umgestellt: `flare` als Standard,
  `sunburst` wahlweise.

## 2026-09-15

- **PDF-Export vektoriell:** Chrome druckt die Klon-Ansicht; `--pdf-raster`
  für Decks mit eingebetteten Demonstratoren. *Decks:* Framework-Dateien
  neu kopieren, sonst fällt der Export auf den Bildweg zurück.
- **Benannte Zusatzfarben:** `[colors.<tabelle>]` in der `style.toml` wird zu
  `--<tabelle>-<key>`, `draw.color()` liest sie.
- **Bildwerkzeug** portiert; SKILL ermutigt zu erzeugten Bildern und fängt
  einen fehlenden Schlüssel ab; Fotos als JPEG laden.
- **SKILL:** Datum auf der Titelfolie nur bei einmaligen Anlässen,
  PDF-Regeln, ortsunabhängige Pfade, Projektregeln herausgetrennt.
- **Veröffentlichung vorbereitet:** MIT-Lizenz, Roboto Mono unter Apache 2.0
  (`fonts/NOTICE`), `slides/` ignoriert, README ohne den Vorgänger.

## 2026-09-14

- **Roboto Mono liegt im Framework** (`fonts/`, `@font-face`); `theme.py`
  ohne Google-Import.
- **Sprache des Satzes** in der `style.toml`; alles auf den Folien folgt ihr,
  Kleinschreibung nur bei Englisch.
- **draw.ipo** (das IPO-Modell als festes Element) und **draw.highlight**.
- **export.py:** schwarze Frames aus dem parallelen Aufnehmen werden einzeln
  nachgeholt.

## 2026-09-13

- **export.py:** Frames, Schritt- und Schriftprüfung parallel.
- **figures.py** misst jede Abbildung (Abgeschnittenes, Leerraum); Regel zum
  Innenabstand in Kästen.

## 2026-09-08 bis 2026-09-11

- **Erste Fassung:** HTML-Folien mit SVG-Zeichnungen (`draw.js`),
  eingebetteten Demonstratoren und Theme; Teilfolien mit Notizen; jeder
  Aufbauschritt ein Frame mit eigener Nummer, Export je Frame,
  Schrittprüfung; Schriftprüfung (`--fonts`) und die Regel der vier Größen;
  Punchline als festes Element, Spaltenraster; Tabellenstil.
- **Website-Einbindung:** Steuerleiste für eingebettete Decks (`?bar=1`),
  neuer Tab und PDF als Symbole, helle Palette, `figures.py` für
  Website-SVGs.
- **Regeln:** Code behält seine Groß- und Kleinschreibung, Bewertungszeichen
  (grüner Haken, rotes Kreuz), Skriptreihenfolge `deck.js` vor
  `stagekit.js`, linksbündige Zeilen in Kästen, echte Farben und
  Palettenfarben nicht mischen.
