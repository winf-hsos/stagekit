---
name: stagekit
description: Foliensätze als HTML mit stagekit entwerfen und bauen (SVG-Zeichnungen, eingebettete Demonstratoren, Design aus theme.css). Erst Basisinfos erfragen, dann Markdown-Entwurf zur Freigabe, erst danach das Deck bauen. Für neue Vorträge, Lehrveranstaltungs-Inputs und Änderungen an bestehenden stagekit-Decks.
---

# stagekit: Foliensätze als HTML entwerfen und bauen

Dieses Skill beschreibt den verbindlichen Arbeitsablauf für Foliensätze mit `stagekit` (Repository `C:\agents\stagekit`, Dateien `stagekit.css`, `stagekit.js`, `draw.js`, `tools/`). Ein Deck ist eine HTML-Datei plus Notizen plus Zeichnungen in einem kleinen Skript; die Designwerte kommen aus der `theme.css` des Decks, erzeugt aus der `style.toml` des Projekts. Fehlt beides, lege die `style.toml` als ersten Schritt an (Vorlage unten) und erzeuge daraus die `theme.css`.

## Der Ablauf, in dieser Reihenfolge

### 1. Basisinfos erfragen (immer zuerst)

Was der Nutzer schon mitgeliefert hat, wird nicht erneut gefragt; der Rest in **einem** kompakten Dialog:

1. **Thema und Kernbotschaft:** der eine Satz, den das Publikum behalten soll.
2. **Publikum und Vorwissen.**
3. **Anlass und Dauer** (Faustregel: deutlich unter zwei Minuten je Inhaltsfolie).
4. **Sprache der Folien** (Lehrkontexte oft englisch; Skript und Notizen deutsch).
5. **Eröffnung:** jeder Satz beginnt mit einem Symbolfoto samt Geschichte.
6. **Design:** gilt die `style.toml` des Projekts, oder braucht dieser Satz eine eigene?
7. **Interaktive Elemente:** gibt es Demonstratoren oder Live-Daten, die auf eine Folie gehören? Das ist die Stärke von stagekit; frag danach.

### 2. Entwurf als Markdown (Diskussionsgrundlage)

Der Satz entsteht zuerst als `entwurf.md` im Satzordner, nicht als HTML. Er wird iteriert, bis der Nutzer ihn **ausdrücklich freigibt**. Vor der Freigabe wird kein Deck gebaut, auch nicht „zur Ansicht“.

Format (verbindlich): Kopf mit `# Entwurf: Input „<titel>“`, Status, Verortung; Symbolschlüssel als Tabelle (🎬 Abschnittsfolie, 📷 Foto, 🖼️ Zeichnung, 📊 Vergleich, 💬 Merksatz, ⌨️ Code, 🪜 Aufbau in Schritten, 🧪 Live-Moment, 🕹️ eingebetteter Demonstrator); dann `# Die Folien`, gegliedert in `## Teil N: <titel> (<X> Folien)`, je Folie ein Block `### Folie N <symbole>` mit Folientext in Backticks, Elementen fett (**Bild:**, **Zeichnung:**, **Titel klein:**, **Text:**, **Demo:**), Sprechernotiz als **Dazu sagen.**, Live-Momente als **Live-Moment:**. Die Kleinschreibung gilt nur für Folientext; die Prosa des Entwurfs ist normales Deutsch.

### 3. Bau des Decks (erst nach Freigabe)

- Deckordner mit `index.html` (aus `template/deck.html`), `deck.js` für die Zeichnungen, `theme.css` (aus der `style.toml`: `python C:\agents\stagekit\tools\theme.py style.toml <ordner>/theme.css`), Fotos in `img/`.
- Titelfolie: Titel und Untertitel nennen Modul oder Anlass und den Namen der vortragenden Person, keine Sitzungs- oder Terminangabe (die veraltet).
- Struktur ist Pflicht: `<section class="slide title">` und `agenda` (leer lassen, stagekit füllt sie aus `data-title`, `data-subtitle`, `data-parts`), je Teil `<section class="slide part" data-part="…">`, Ortsangabe entsteht automatisch. Teilfarben optional über `data-part-colors='{"teil": "#hex"}'`.
- Eröffnungsfoto: `<img class="photo" src="img/…png">` rechts, `<div class="photo-text">` links, Fußnote `image: ai-generated (<modell>)`; Bild in 3840x2160 mit schwarzem Grund (siehe `slidekit.image`).
- Inhaltsfolie: `<h2>` kleine Überschrift, `.content` mit `.header`, `.statement`, `.lines`, `.code`, `.sidenote`, `.remark`; `.footnote`. Aufbau in Schritten mit `data-step="n"` an den Elementen, die später erscheinen; sie behalten ihren Platz. Ändert ein Schritt Inhalte (Text, Tabelle, Zeichnung per Hook), müssen die Container ihre Größe behalten: feste Höhen, Ausrichtung oben, gleich lange Texte.
- Zeichnungen: SVG-Strings aus `draw.js` in ein `<div class="figure" id="…">`, geschrieben von `deck.js` beim Laden. Für Aufbau in Schritten je Schritt neu zeichnen über `data-on-show="fn"` / `data-on-step="fn"` (globale Funktionen mit `(slide, step)`).
- Demonstratoren: `<div class="embed"><iframe src="…" title="…"></iframe></div>`. Auf der Folie steht sonst nur die kleine Überschrift.
- Notizen: `<aside class="notes">` je Folie; sie erscheinen im Notizfenster (N).
- Parallel zum Bau entsteht `skript.md`: der Text zum Nachlesen in Folienreihenfolge, als eigenständiger Text lesbar.
- Nach dem Bau: `python C:\agents\stagekit\tools\export.py <ordner>/index.html` (PDF, PNGs, Kontaktbogen, **Schrittprüfung und Schriftprüfung**), Kontaktbogen und Einzelfolien **ansehen**, erst dann dem Nutzer melden. Die Schrittprüfung (`--steps`) schaltet jede Folie mit Aufbau durch und meldet jedes Element, das zwischen zwei Schritten seine Position ändert. **Ein Deck mit einer springenden Folie ist nicht fertig.** Häufigste Ursache: ein zentrierter Block, dessen Inhalt beim Schritt wächst (längerer Text, neue Tabelle, anderes Bild). Abhilfe: dem wachsenden Element eine feste Höhe (`min-height`) geben oder den Container oben ausrichten, und Texte je Schritt gleich lang halten.
- Zum Ansehen im Browser einen lokalen Server oberhalb von Deck und Framework starten (`python -m http.server 8800 --bind 127.0.0.1` in `C:\agents`), Adresse mit `?slide=N` für einen bestimmten Frame; nach änderungen Strg+F5. Einzelne Frames prüft man mit Chrome headless: `chrome --headless=new --window-size=1200,675 --virtual-time-budget=3000 --screenshot=<png> <url>?slide=N`.
- **Jeder Aufbauschritt ist eine Folie mit eigener Nummer** (Zähler, Adresse, PDF, Kontaktbogen), wie die Aufbau-Kopien bei slidekit. Folienverweise in `skript.md` zählen deshalb Frames.

### 4. Einbindung in eine Website (der Player)

Ein Deck laedt Framework und Bilder ueber relative Pfade; auf einer fremden Seite muss es fuer sich stehen. Zwei Schritte:

**a) Deck kopieren.** Ein Sync-Skript (im LiFi-Projekt `tools/sync_decks.py`, als `pre-render` eingehaengt) kopiert `index.html`, `deck.js`, `theme.css` und nur die tatsaechlich geladenen Bilder in einen erzeugten Ordner, schreibt die Framework-Pfade auf einen gemeinsamen `stagekit/`-Ordner daneben um und nimmt das PDF aus `export/` als `<name>.pdf` mit. **Nur schreiben, was sich geaendert hat**, sonst dreht ein laufender `quarto preview` endlos (siehe die Warnung in `sync_decks.py`).

**b) Player einsetzen.** Das Deck bringt seine Bedienung selbst mit: `?bar=1` blendet oben rechts eine Leiste ein mit zurueck, Zaehler, vor, Vollbild, "in eigenem Tab oeffnen" und, wenn `?pdf=<pfad>` mitgegeben wird, dem PDF. Alles als Symbol mit Tooltip; unter dem Rahmen steht dadurch kein Link mehr. Im Iframe hat die Tastatur erst nach einem Klick den Fokus, deshalb ist die Leiste dort Pflicht.

In Quarto in einem `{=html}`-Block (Markdown-Links wuerden im Rohblock nicht gerendert):

```html
<div class="deck-embed">
  <iframe src="../assets/decks/<name>/index.html?bar=1&pdf=../<name>.pdf"
          title="<decktitel>" allowfullscreen loading="lazy"></iframe>
</div>
```

Dazu einmal im Stylesheet:

```scss
.deck-embed {
  margin: 1rem 0 1.5rem;
  iframe { display: block; width: 100%; aspect-ratio: 16 / 9; border: 1px solid #ddd; background: #000; }
}
```

Der `pdf`-Pfad ist relativ zur `index.html` des Decks, nicht zur einbettenden Seite. `allowfullscreen` ist noetig, damit der Vollbildknopf und die Taste F wirken. Fotos, die ein Deck per Canvas ausliest, muessen aus demselben Ursprung kommen (ins `img/` des Decks kopieren), sonst verweigert der Browser die Pixel.

### 5. Abbildungen für Webseiten aus dem Deck

Die Zeichnungen eines Decks sind reine SVG-Strings und können als Abbildungen einer Website dienen, in einer hellen Palette. Dazu:

- `[colors.light]` in der `style.toml` mit denselben Schlüsseln wie `[colors]`; `theme.py` schreibt daraus `:root[data-theme="light"]`, und `draw.js` schaltet den Block ein, wenn `?theme=light` in der Adresse steht. Die Rollen bleiben: „yellow“ ist weiter die Farbe für 1, aktuell und Strom, „white“ die des Wichtigsten.
- Zeichenfunktionen in `deck.js` geben ihr SVG **zurück** und schreiben es nur in ihr Element, wenn es das gibt (`if ($("fig-x")) …`); der Start des Decks steht unter `if ($("erstes-element"))`, damit `deck.js` auch ohne Folien lädt. Was die Website braucht, wird als `window.deckNN = {…}` veröffentlicht.
- `figures.js` im Deckordner: `window.figures = { "name": () => svg, "anderes": async () => svg }`. Jede Funktion liefert ein komplettes SVG aus `draw.js`; für Tafeln gibt es `d.table(x, y, headers, rows, {cw, rh, size, hl})` als SVG-Fassung der HTML-Wahrheitstafel. Beschriftungen englisch, Codeschrift für Bits, dieselben Größen wie auf den Folien.
- `python C:\agents\stagekit\tools\figures.py <deck>/index.html --out <ordner> --theme light` schreibt je Abbildung `<name>.svg` (Roboto Mono eingebettet, Breite und Höhe aus der viewBox). **Jede Abbildung danach als Screenshot auf Weiß ansehen** (Chrome headless mit `--default-background-color=ffffffff` auf die SVG-Datei), auf abgeschnittene Ränder, zu enge Spalten und Leerraum unter der Zeichnung prüfen; die viewBox-Höhe auf den Inhalt zuschneiden.

### 6. Danach: die HTML-Datei ist die Quelle

Änderungen laufen direkt an `index.html` und `deck.js`, nicht über einen Neubau. Jede inhaltliche Änderung zieht dieselbe Änderung in `skript.md` nach sich, im selben Arbeitsgang.

## Gestaltungsregeln (Kurzfassung)

- Folientext kleingeschrieben (`--lowercase` im Theme), kein Kursiv, keine Übergänge. Code, Eigennamen und Abkürzungen wie RAM, CPU, LLM bleiben groß: im HTML mit `class="keep-case"`, in Zeichnungen mit `keepCase: true`.
- Acht Farben, **genau vier Schriftgrößen**, nur aus dem Theme: `var(--tiny)`, `var(--small)`, `var(--normal)`, `var(--large)` (20, 32, 48, 80 px auf der 1920er Leinwand) und in Zeichnungen `size: 20 | 32 | 48 | 80`. Keine anderen Pixelwerte, auch nicht „ein bisschen kleiner, damit es passt“: Passt es nicht, wird das Layout geändert, nicht die Größe. Der Export prüft das (`--fonts`) und meldet jede fremde Größe. Nie Hex-Werte im Deck. Farbe ist Bedeutung: Blau verweist, Gelb merkt an und zeigt „aktuell“, Rot ist der sparsame Hingucker.
- **Codeschrift für alles, was der Rechner liest:** Bits, Bytes, Hex-Adressen, Binärzahlen, Bezeichner, Formeln (`var(--mono)` bzw. `mono: true`), ohne Ausnahme und auf jeder Folie gleich. Bitfolgen in Vierergruppen mit Leerzeichen; Bytes, die untereinander stehen (Addition, Vergleich), Stelle für Stelle ausgerichtet: Bits rechtsbündig an einer gemeinsamen Kante, Gleichheitszeichen fest, Dezimalzahlen rechtsbündig.
- **Gelb heißt 1 oder „aktuell“**, sonst nichts: leuchtende Leitungen, gesetzte Bits, die markierte Zelle, die aktuelle Tafelzeile. Braucht eine zweite Betonung eine Farbe (etwa aufgefüllte Nullen), nimmt sie Grün; Rot bleibt der Warnhinweis.
- **Verbinder liegen hinter dem Shape, in das sie führen.** Kein Strich darf auf einem Rahmen oder in einem Kasten sichtbar bleiben: erst alle Linien zeichnen, dann die Kaesten (`layers(wires, boxes, labels)`), und Kaesten mit Hintergrundfüllung, die den Linienrest abdeckt (`box()` füllt dafür seit dem 08.09.2026 standardmässig mit `--bg`). Dasselbe gilt für Pfeile: Die Spitze endet an der Kante, nicht darin.
- Zeichnungen: Linien und Rahmen in `--white` oder `--gray-light`, Strom in Gelb, Inaktives in `--gray-dark`. Leitungen nur waagerecht und senkrecht, mit `d.layers(wires, gates, labels)` hinter den Gattern; Eingaben als Kippschalter (`d.toggle`), Ausgaben als Lampen (`d.lamp`); Zeichnung so groß wie die Fläche erlaubt, nur über die viewBox skaliert.
- Tabellen: Wahrheitstafeln mit `.tt` (`.tt.large` neben großen Zeichnungen), schriftliche Addition mit `table.sum` (Zeile `carries` für die überträge in Bitgröße, Summenzeile mit Strich). Tabellen ohne Rahmenlinien-Wildwuchs: Kopf und Zeilen aus dem Framework, keine eigenen Rahmen.
- **Der `.content`-Block deckt die ganze Folie ab** und zentriert senkrecht; ein hoher Block läuft deshalb unter die überschrift. Dann `style="top: 150px"` (oder eine Klasse) setzen, damit der Block unter der überschrift zentriert. Abstände zwischen Zeilen und Spalten großzügig (40 bis 60 px), zwischen Beschriftung und Wert mindestens 100 px.
- **Formeln werden gesetzt, nicht getippt.** Kein `log2(x)`, kein `x^2` im Fließtext: `d.formula(x, y, "H = log_2(N)")` setzt die Formel in Codeschrift, `_` stellt tief, `^` hoch, geschweifte Klammern fassen zusammen (`H_{before}`). Tief- und Hochgestelltes läuft automatisch in der nächstkleineren der vier erlaubten Größen, die Schriftprüfung bleibt also still. Für alles, was darüber hinausgeht (Brüche, Summen, Wurzeln), gibt es in HTML-Decks bewusst nichts: Solche Formeln gehören in dieser Lehre auf die Konzeptseite, wo Quarto sie satzt, nicht auf eine Folie.
- **Beschriftungen sitzen mittig zu dem, was sie beschriften.** Ein Label neben einem Kasten wird nicht an einer selbst ausgerechneten Grundlinie abgesetzt, sondern an der Mitte des Kastens: `d.label(x, y, text, { centerY: kastenMitte })` bestimmt die Grundlinie selbst, auch bei mehreren Zeilen. Von Hand gesetzte Grundlinien sind der häufigste Grund dafür, dass ein zweizeiliges Label sichtbar zu tief steht: Eine Zeile sitzt auf der Mitte, zwei Zeilen hängen darunter. Dasselbe gilt für Werte neben Formen, Erklärzeilen an Kästen und Achsenbeschriftungen an Balken. **Abweichungen nur mit Grund** und dann sichtbar begründet: wenn mehrere Beschriftungen an einer gemeinsamen Kante ausgerichtet werden (Eingabe-Labels rechtsbündig vor dem Pfeil), wenn eine Beschriftung bewusst an der Oberkante einer Spalte steht, oder wenn zwei Labels sonst kollidieren würden.
- **Bewertung: grüner Rahmen mit Haken, roter Rahmen mit Kreuz.** Die bessere Lösung, die richtige Antwort, der Weg, der trägt: Der Kasten bekommt einen grünen Rahmen und mittig an seinem unteren Rand einen kleinen grünen Haken. Das Gegenstück bekommt Rahmen und Kreuz in Rot, in derselben Größe und an derselben Stelle. Immer über `d.verdict(x, y, w, h, text, ok, opts)` zeichnen, nie von Hand, damit das Zeichen auf jeder Folie gleich aussieht und gleich sitzt; `ok` ist `true`, `false` oder `null` für den Fall, dass das Urteil erst in einem späteren Schritt erscheint (gleicher Kasten, gleiche Textlage, nur ohne Zeichen). Steht ein bewerteter Kasten neben unbewerteten, bekommen auch die `verdict(..., null, {border: …})`, sonst sitzt ihr Text höher als der der Nachbarn. Kein zweites Zeichen für dieselbe Aussage: Die Farbe des Rahmens sagt es schon, der Haken wiederholt sie für den, der sie nicht sieht.
- **Demonstratoren auf Folien** laden mit `?embed=1` (Kopfzeile, Fußzeile und Hinweise ausgeblendet) und ihren Startparametern in der Adresse, in `.embed.z125` oder `.z150`, damit die Bedienelemente auf der Leinwand lesbar sind. Die Folie trägt nur die kleine überschrift `try it: …`.
- **Foto-Folien:** Eröffnung und Schluss als Symbolfoto rechts, Frage oder Satz links (`.photo` und `.photo-text`), Fußnote `image: ai-generated (<modell>)`. Pfeile in einen Kasten liegen auf dessen Mittelachse; Eingabe-Labels rechtsbündig vor dem Pfeil, Ausgabe-Labels linksbündig dahinter.
- Eine Aussage je Folie. Wenig Text; die Aussage steckt im Bild, der Rest in den Notizen.
- **Punchline:** nur dort, wo ein Satz den Kern der Folie trägt, nicht auf jeder Folie. Wenn, dann als `<div class="punch">` am unteren Rand, immer in der kleinen Größe, immer an derselben Stelle; die Folie bekommt dazu die Klasse `has-punch`, damit der Inhalt darüber Abstand hält. Nie eine gelbe Zeile frei in eine Zeichnung setzen.
- **Beschriftungen in Zeichnungen:** Achsen-, Ein- und Ausgabelabels in `small` (32), Werte und Bits in `normal` (48) oder `small`, nie größer als der Fließtext der Folie; Bildunterschriften und Erklärzeilen in `small` und Grau. Ein Foliensatz benutzt für dieselbe Textsorte überall dieselbe Größe.
- **Gleiche Inhalte, gleiche Stelle:** Steht dieselbe Tabelle oder Zeichnung auf zwei aufeinanderfolgenden Folien, steht sie pixelgleich an derselben Stelle (gleiches Raster, feste Höhen). Die Schrittprüfung deckt das innerhalb einer Folie ab; zwischen Folien muss es der Bau sicherstellen und per Screenshot-Differenz prüfen.
- **Vor dem Melden jede Folie einzeln in voller Größe ansehen,** nicht nur den Kontaktbogen: abgeschnittene Beschriftungen, Texte, die in Kästen zu tief sitzen, fehlende Linien und Kollisionen sieht man nur so.
- **Cache-Buster:** `stagekit.css`, `stagekit.js`, `draw.js` und `deck.js` mit `?v=<datum>` einbinden und die Zahl bei jeder Änderung hochzählen, sonst zeigt der Browser des Nutzers alte Fassungen.

## API-Spickzettel

```html
<div class="deck" data-title="…" data-subtitle="…" data-parts='["a","b"]' data-part-colors='{"a":"#009ee3"}'>
  <section class="slide title"></section>
  <section class="slide agenda"></section>
  <section class="slide part" data-part="a"></section>
  <section class="slide">
    <h2>heading</h2>
    <div class="content">
      <div class="header">header</div>
      <div class="statement">statement</div>
      <div class="lines mono"><div>line one</div><div data-step="1">line two, on step 1</div></div>
      <div class="sidenote">sidenote</div><div class="remark">remark</div>
    </div>
    <div class="footnote">footnote</div>
    <aside class="notes">notes</aside>
  </section>
  <section class="slide"><h2>drawing</h2><div class="figure" id="f1"></div></section>
  <section class="slide"><h2>demo</h2><div class="embed"><iframe src="…"></iframe></div></section>
  <section class="slide"><img class="photo" src="img/x.png"><div class="photo-text">question?</div><div class="footnote">image: ai-generated (gpt-image-2)</div></section>
</div>
<!-- Reihenfolge ist Pflicht: deck.js VOR stagekit.js. stagekit ruft beim ersten
     Anzeigen die data-on-show-Funktionen auf; stehen sie danach, fehlen sie noch.
     Sichtbar wird das erst im Export, wo jeder Frame frisch mit ?slide=N laedt. -->
<script src="…/stagekit/draw.js"></script>
<script src="deck.js"></script>
<script src="…/stagekit/stagekit.js"></script>
```

```js
const d = window.draw;                       // Farben kommen aus dem Theme
d.svg(w, h, ...parts)                        // Rahmen (viewBox)
d.box(x, y, w, h, text, {border, fill, color, size, mono, dashed, rx})
d.verdict(x, y, w, h, text, ok, opts)   // grüner Rahmen mit Haken (true), roter mit Kreuz (false), ohne Zeichen (null)
d.mark(cx, cy, ok, {size})             // nur das Zeichen, überall gleich groß
d.formula(x, y, "H = log_2(N)", {size, color, anchor, centerY})  // _ tief, ^ hoch, {} gruppiert
d.label(x, y, text, {size, color, anchor, mono, lineHeight, centerY})  // "\n" bricht um; centerY: mittig zu dieser Hoehe
d.line(x1, y1, x2, y2, {color, width, dashed});  d.arrow(x1, y1, x2, y2, {color, width})
d.wire([[x,y],…], on);  d.dot(x, y, on);  d.gate("and|or|xor|not|nand|nor", x, y, on)
d.lamp(x, y, on, caption);  d.toggle(x, y, on, label)
d.truthTable(["a","b"], ["out"], [{in:[0,0], out:[0]}, …], nowIndex)   // HTML-Tabelle
```

Hooks: `data-on-show="fn"` und `data-on-step="fn"` auf einer Folie rufen `window.fn(slide, step)`.

## Vorlage style.toml

```toml
[colors]
background = "000000"
white = "FFFFFF"
gray_light = "B6BEC6"
gray = "7D868F"
gray_dark = "4A5259"
blue = "009EE3"
green = "4ADE80"
yellow = "FFD23F"
red = "FF4D6D"

[fonts]
text = "Arial"
code = "Roboto Mono"

[sizes]
large = 40
normal = 24
small = 16
tiny = 10

[stagekit]
lowercase = true
margin = 120
```
