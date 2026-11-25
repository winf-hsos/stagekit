# API und Vorlagen

Nachschlagedatei zum Skill `stagekit` (`SKILL.md`): das Gerüst eines Decks, die
Zeichenfunktionen aus `draw.js`, Live-Abfragen, Animationen (`anim.js`) und
die Vorlage der `style.toml`. Beim Schreiben von HTML und `deck.js` daneben offen halten.

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
  <section class="slide"><img class="photo" src="img/x.png"><div class="photo-text">question?</div><div class="footnote">image: ai-generated (gpt-image-2.5-flare)</div></section>
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
d.verdict(x, y, w, h, text, ok, opts)   // grüner Rahmen mit Haken (true), roter mit Kreuz (false), gelber mit Warndreieck ("caution"), ohne Zeichen (null)
d.mark(cx, cy, ok, {size})             // nur das Zeichen, überall gleich groß
d.keys(x, cy, ["ctrl", "c"], {color})  // Tastenkappen mit "+" dazwischen, 56 hoch, x linke Kante, cy Mitte; d.keys.width(names) = Gesamtbreite
d.icon(x, y, size, paths, {color})     // Bootstrap-Icons-Symbol; paths aus `tools/icon.py <name> --js`, Standardfarbe Grau
d.highlight(x, w, centerY, size, {color, opacity, pad, rx})  // Kasten über eine ganze Textstelle, Höhe aus der Schriftgröße
d.ipo(y, input, processing, output, {level, active, monoBox})  // IPO-Zeile mit fester Geometrie: Eingabe, Kasten, Ausgabe
d.color("families-transfer")           // benannte Zusatzfarbe aus [colors.<tabelle>] der style.toml
d.formula(x, y, "H = log_2(N)", {size, color, anchor, centerY})  // _ tief, ^ hoch, {} gruppiert
d.label(x, y, text, {size, color, anchor, mono, lineHeight, centerY})  // "\n" bricht um; centerY: mittig zu dieser Hoehe
d.line(x1, y1, x2, y2, {color, width, dashed});  d.arrow(x1, y1, x2, y2, {color, width})
d.wire([[x,y],…], on);  d.dot(x, y, on);  d.gate("and|or|xor|not|nand|nor", x, y, on)
d.lamp(x, y, on, caption, {size});  d.toggle(x, y, on, label, {size})   // vergrößert gezeichnet (scale(2)) mit {size: 16}, damit 32 herauskommt
d.truthTable(["a","b"], ["out"], [{in:[0,0], out:[0]}, …], nowIndex)   // HTML-Tabelle
```

**Verbinder zwischen Kanten.** Knoten als Rechtecke mit `{ x, y, width, height }` in derselben Zeichenfläche beschreiben. `d.anchor(rechteck, "left" | "right" | "top" | "bottom")` liefert die Kantenmitte. Die einander zugewandten Kanten mit `d.connect(von, bis, { color, width, dashed })` verbinden. Die Strecke bleibt hinter den Knoten. Für die Bewegung dieselbe Linie benennen und mit `along` abfahren. An jedem Ende berücksichtigt der Player die halbe Breite oder Höhe des bewegten Objekts, auch beim Rückweg. Zwischen die beiden Kanten muss das Objekt passen. Die Rechtecke, die Linie und die bewegte Gruppe verwenden dieselben untransformierten Zeichenkoordinaten.

```js
const link = d.connect(d.anchor(router, "right"), d.anchor(server, "left"));
// In d.svg(...) vor den beiden Knoten zeichnen.
const connection = d.g("link", link);
// Sobald die Zeichnung im DOM steht:
a.step(a.along("request", "link"));
a.step(a.along("reply", "link", { reverse: true }));
```

**Beschriftete Nahansicht.** `d.closeup(breite, höhe, zielrechteck, beschriftung, { zoom: 2.5 })` liefert `view` für die Kamera sowie die SVG-Teile `shade`, `outline` und `caption`. Das Zielrechteck liegt in Koordinaten der Zeichnung nach Platzierung des Fotos. Die Kamera bleibt innerhalb der Zeichenfläche. Die Beschriftung sitzt neben, über oder unter dem Ziel auf eigenem Grund. Bei wenig Platz wählt der Helfer die nächstkleinere Zoomstufe (2,5 → 1,5 → 1). Ein langer Text kann mit `\n` umbrochen werden. Die [Platinen-Demo](../examples/animations/deck.js) zeigt das vollständige Einblenden.

Hooks: `data-on-show="fn"` und `data-on-step="fn"` auf einer Folie rufen `window.fn(slide, step)`.

**Magic Move zwischen Folien** (wann: `docs/design-rules.md`, „Magic Move verbindet benachbarte Folien“). Tragen zwei benachbarte Folien je ein Element mit derselben Kennung `data-morph="…"`, gleitet es bei → und ← von seinem Platz, seiner Größe und seinen Farben auf der alten Folie zu denen auf der neuen. Der Rest der alten Folie blendet aus, der Rest der neuen kurz danach ein; eine Überschrift, die auf beiden Folien gleich lautet, bleibt stehen. Das funktioniert mit HTML-Elementen und mit Gruppen in Zeichnungen (`<g data-morph="…">`), auch gemischt: Aus einem Kasten im Überblick wird die Aussage der nächsten Folie. Ein Sprung, ein frischer Aufruf, der Export und das PDF zeigen jede Folie, wie sie ist. `?morph=0` und die Systemeinstellung „Bewegung reduzieren“ schalten es ab. Beispiel: Teil „between slides“ im [Demo-Deck](../examples/animations/animations.html).

```html
<section class="slide"><h2>the parts of a computer</h2><div class="figure" id="fig-parts"></div></section>
<section class="slide"><h2>the parts of a computer</h2>
  <div class="content"><div class="statement" data-morph="cpu">the processor</div>…</div></section>
```

```js
const morphGroup = (key, ...parts) => `<g data-morph="${key}">${parts.join("")}</g>`;
el("fig-parts").innerHTML = d.svg(1680, 600, …, morphGroup("cpu", d.box(660, 120, 360, 140, "processor")), …);
```

Rahmen und Text reisen getrennt: Der Text gleitet von der Mitte des alten zur Mitte des neuen Textes und wächst oder schrumpft dabei. Ein Rahmen, den nur eine Seite hat, blendet aus oder ein. Ändert sich der Wortlaut, geht der alte Text, bevor der neue kommt. Gruppen in zwei Zeichnungen, die in einer Reihe die Plätze tauschen, weichen aus: Was nach rechts wandert, läuft oben herum, was nach links wandert, unten herum. Zum Prüfen zeigt `?slide=N&morph-t=0.4` den Übergang auf Frame N bei 40 % angehalten, mit `&morph-back` den Rückweg von der folgenden Folie. Grenze: Gruppen zwischen zwei Zeichnungen ändern nur Lage und Größe, ihre Farben nicht.

**Signature-Layouts** (wann: `docs/design-rules.md`, „Signature-Layouts setzen Akzente“; Beispiel: `examples/layouts/layouts.html`). Die Klasse an der Folie bestimmt die Form, stagekit setzt den Rest:

```html
<section class="slide number">                 <!-- eine Zahl in Anzeigegröße, zählt beim Weiterblättern hoch -->
  <div class="number-value">73 %</div>         <!-- data-count="off": nicht zählen (Jahreszahl, Code) -->
  <div class="number-text">of the bytes on the web arrive compressed</div>
  <div class="footnote">source: …</div>
</section>
<section class="slide quote">                  <!-- das Anführungszeichen setzt stagekit -->
  <blockquote>the purpose of computing is insight, not numbers.</blockquote>
  <div class="quote-by">richard hamming, 1962</div>
</section>
<section class="slide fullbleed">              <!-- Foto über die ganze Folie, Satz auf dem dunklen Band unten -->
  <img class="photo" src="img/…jpg"><div class="photo-text">question?</div>
  <div class="footnote right">image: ai-generated (gpt-image-2.5-flare)</div>
</section>
<section class="slide timeline"><h2>…</h2>     <!-- höchstens sieben Ereignisse; das zuletzt gezeigte ist gelb -->
  <ol class="events">
    <li data-date="1838">morse code<span class="sub">short codes for frequent letters</span></li>
    <li data-date="1952" data-step="1">huffman</li>
  </ol>
</section>
<section class="slide compare"><h2>…</h2>      <!-- ohne h2 füllt die Ansicht die ganze Folie -->
  <div class="compare-view" data-stops="50 22 78" data-sweep>   <!-- Stellung je Aufbauschritt, in % von links -->
    <img src="img/original.jpg" data-label="original, 2.1 mb">   <!-- links: vorher -->
    <img src="img/quality-4.jpg" data-label="quality 4, 0.25 mb"> <!-- rechts: nachher -->
  </div>
</section>
<section class="slide checklist"><h2>…</h2>
  <ul class="checks">
    <li data-checked>läuft ohne Fehler</li>                  <!-- von Anfang an abgehakt -->
    <li data-check="1">jede Zelle hat eine Aufgabe<span class="sub">Zusatzzeile</span></li>  <!-- abgehakt in Schritt 1 -->
    <li>jemand anderes hat es gelesen</li>                  <!-- bleibt offen -->
  </ul>
</section>
```

`compare` legt zwei Bilder derselben Ansicht übereinander; links der Linie steht das erste, rechts das zweite. Statt Bildern gehen auch zwei Zeichnungen (`<div><svg>…</svg></div>`), die stagekit gleich groß übereinanderlegt. `data-stops` gibt je Aufbauschritt die Stellung der Linie an, beginnend mit Schritt 0; ein Schritt nach vorn gleitet dorthin, ein Sprung, die Druckansicht und der Export zeigen jede Stellung als eigene Seite. Im Vortrag lässt sich die Linie jederzeit mit der Maus ziehen, ohne dass die Folie weiterblättert. `data-sweep` lässt sie beim Erreichen der Folie einmal von selbst über das ganze Bild laufen und zur Stellung zurückkehren, mit R noch einmal (`data-sweep="6"`: sechs statt vier Sekunden). Eine Beschriftung, deren Seite zu schmal wird, blendet sich aus.

`checklist` setzt vor jeden Punkt ein Kästchen. `data-checked` hakt ihn von Anfang an ab, `data-check="2"` im zweiten Aufbauschritt, ohne beides bleibt er offen; ein Punkt kann zusätzlich mit `data-step` erst später erscheinen. Ein Haken, der beim Weiterblättern dazukommt, wird gezeichnet; Druckansicht und Export zeigen je Schritt den Stand. Im Vortrag hakt ein Klick auf einen Punkt ihn ab oder nimmt den Haken weg, ohne dass die Folie weiterblättert; beim nächsten Erreichen der Folie gilt wieder der Stand aus dem Markup. Ab sechs Punkten setzt stagekit den Text klein, mehr als acht meldet `review.py`.

Die Zahl zählt nur, wenn die Folie mit einem Schritt nach vorn erreicht wird; ein Sprung, ein frisches Laden, die Druckansicht und der Export zeigen den Endwert, ebenso bei reduzierter Bewegung. Trennzeichen und Einheit bleiben beim Zählen stehen (`1,250 kb`).

Live-Abfrage (braucht `data-live-url` am `div.deck`):

```html
<section class="slide poll" data-poll="byte-values">
  <div class="poll-q">how many different values can one byte hold?</div>
  <ol class="poll-opts"><li>8</li><li>16</li><li data-correct>256</li><li>no idea</li></ol>
  <aside class="notes">…</aside>
</section>
```

## Diagramme (d.chart)

`d.chart(spec)` zeichnet Balken aus Daten in den Farben und Größen des Themes und wechselt zwischen **Zuständen**, einer je Aufbauschritt. Ein Zustand nennt nur, was sich ändert; alles andere übernimmt er vom vorigen. Die Übergänge laufen über `anim.js` (laden wie bei Animationen), deshalb gelten Export, PDF-Seiten, ← und Sprünge wie dort. Wann: `docs/design-rules.md`, „Diagramme führen zu einer Aussage“. Beispiel: `examples/charts/`.

```js
const c = d.chart({
  type: "bar",                       // "bar" (Säulen) oder "hbar" (Zeilen: lange Beschriftungen, Rangfolgen)
  width: 1680, height: 760,          // Fläche in Zeichnungseinheiten, dazu optional x, y
  labels: ["21/22", "22/23", "23/24", "24/25", "25/26", "26/27"],
  series: [{ name: "business informatics", values: [31, 28, 24, 21, 7, 10] },
           { name: "all programmes", values: [30, 30, 29, 27, 24, 22] }],   // eine Reihe: values: [...]
  unit: " %",                        // an Wertbeschriftungen; dazu min, max, decimals, pad, accent, morph
  states: [
    { show: [] },                                                        // Zustand 0: leere Achse
    { show: ["business informatics"] },                                  // Schritt 1: Balken wachsen
    { highlight: ["26/27"], note: { at: "26/27", text: "first rise" } }, // Schritt 2: die Aussage
    { show: ["business informatics", "all programmes"], note: null },    // Schritt 3: Vergleich
    { zoom: [0, 12] },                                                   // Schritt 4: Ausschnitt
  ],
});
el("fig-enrol").innerHTML = d.svg(1680, 760, c.svg());   // c.svg(k) zeichnet Zustand k
c.steps("fig-enrol");                                    // je Zustand ein Abschnitt; Optionen wie d.anim, dazu dur
```

| Zustand | Wirkung |
|---|---|
| `show: [namen]` | sichtbare Reihen; eine neue wächst aus der Grundlinie, die anderen rücken zusammen |
| `highlight: [labels]` | diese Balken in der Teilfarbe, die übrigen treten zurück; ihre Werte stehen dabei |
| `focus: "name"` | eine ganze Reihe in der Teilfarbe |
| `values: "all" \| "highlight" \| "none"` | Wertbeschriftungen; ohne Angabe nur bei `highlight` und `focus` |
| `note: { at, text }` | ein kurzer Satz über (Säulen) bzw. hinter (Zeilen) einem Balken; `null` nimmt ihn weg |
| `zoom: [min, max]` | Ausschnitt der Werteachse; Gitterlinien gleiten mit, höhere Balken enden oben an der Fläche |
| `sort: "desc" \| "asc" \| null` | ordnet nach der ersten sichtbaren Reihe; die Balken wandern an ihren Platz |

Mehrere Reihen bekommen ihre Namen als farbige Wörter über der Fläche statt einer Legende mit Kästchen. `morph: "enrol"` gibt jedem Balken `data-morph="enrol-<label>"` für Magic Move auf die nächste Folie. Ohne `anim.js` zeichnet `c.svg(k)` jeden Zustand statisch, etwa für eine Abbildung auf einer Webseite.

## Animationen (anim.js)

Eine Animation gehört zu einer Zeichnung und besteht aus Abschnitten. Jeder Abschnitt endet in einem Zwischenstand, der ein Aufbauschritt der Folie ist (Frame, PDF-Seite, Bild im Kontaktbogen). Im Vortrag spielt → den Weg zum nächsten Zwischenstand ab; ← und jeder Sprung zeigen den Zwischenstand sofort. Wann animiert wird, steht in `docs/design-rules.md` („Animationen zeigen Abläufe“).

```html
<script src="…/stagekit/draw.js"></script>
<script src="…/stagekit/anim.js"></script>   <!-- zwischen draw.js und deck.js -->
<script src="deck.js"></script>
<script src="…/stagekit/stagekit.js"></script>
```

```js
const d = window.draw;
el("fig-net").innerHTML = d.svg(1680, 600,
  d.g("link", d.line(240, 300, 1440, 300)),                     // d.g benennt, was sich ändert
  d.g("route", d.line(334, 300, 1346, 300, { color: "none" })), // unsichtbarer Weg für along
  d.g("packet", d.box(244, 272, 180, 56, "request")),           // steht am Anfang der Route
  d.g("time", d.label(840, 540, "0 ms", { anchor: "middle" })));
const a = d.anim("fig-net");                  // { auto, gap, autostart, first, back }
a.step(a.draw("link"), a.show("packet"));     // Abschnitt 1: nacheinander
a.step(a.along("packet", "route"), a.hold(),  // Abschnitt 2: hält, bis → kommt
       a.count("time", 42, { suffix: " ms" }));
a.step(a.camera([1000, 140, 672, 240]));      // Abschnitt 3: Kamerafahrt (viewBox)
```

| Baustein | Wirkung |
|---|---|
| `show(t)` / `hide(t)` | einblenden (beginnt unsichtbar) / ausblenden |
| `draw(t)` | Linien und Rahmen zeichnen sich (beginnt ungezeichnet), Text und Pfeilspitzen erscheinen am Ende |
| `move(t, dx, dy)` / `moveTo(t, x, y)` | verschieben um / Mitte nach x, y |
| `along(t, weg, { reverse })` | Mitte folgt einer Linie oder einem Pfad |
| `scale(t, s)` / `rotate(t, grad)` | um die eigene Mitte |
| `color(t, farbe, { part })` | `part`: `"stroke"` (Rahmen, Standard), `"fill"` oder `"text"`; Farbnamen des Themes (`"yellow"`) |
| `count(t, bis, { from, decimals, prefix, suffix })` | zählt die Zahl in einem Text hoch |
| `pulse(t, { times })` / `swap(alt, neu)` | kurz größer und zurück / überblenden |
| `camera([x, y, w, h])` | Zoom und Schwenk über die viewBox der Zeichnung |
| `value(name, bis)` / `painter(name, fn)` | eine Zahl (Start 0), aus der `fn(wert)` einen Teil selbst neu zeichnet; so arbeitet `d.chart()` |
| `set(t, { opacity, x, y, scale, rotate, draw, idle })` | Startzustand ausdrücklich setzen; `idle: "pulse"` (oder `{ kind, … }`) bewegt t schon im Zwischenstand 0 |
| `idle(t, art, o)` / `still(t, art)` | ab hier Bewegung im Leerlauf / beenden (ohne `art` alle von t), siehe unten |
| `wait(ms)` / `hold()` | Pause / anhalten bis → (halbautomatisch) |
| `par(…)` / `seq(…)` | gleichzeitig / nacheinander (Standard in `step`) |

Gemeinsame Optionen: `dur` in ms (Standard 800), `ease`: `"inOut"` (Standard), `"in"`, `"out"`, `"linear"`. Ziele sind Namen aus `d.g(name, …)` oder CSS-Selektoren innerhalb der Zeichnung. Bilder kommen mit `d.image(x, y, w, h, "img/…jpg", { fit })` in die Zeichnung; ein freigestelltes Objekt als PNG (`image.py --transparent`) lässt sich wie jede Gruppe bewegen, drehen und skalieren.

Optionen der Animation: `auto: true` lässt die Abschnitte nach dem ersten → von selbst aufeinander folgen, mit `gap` ms Pause (Standard 600); `autostart: true` startet den ersten Abschnitt beim Betreten der Folie; `first` ist der Aufbauschritt des ersten Abschnitts (Standard 1), damit andere `data-step`-Elemente der Folie mit einem Abschnitt zusammen erscheinen können; `back: "play"` lässt ← den Abschnitt rückwärts abspielen statt zum vorigen Zwischenstand zu springen, in `backSpeed`-fachem Tempo (Standard 2).

**Bewegung zwischen zwei Klicks prüfen.** `python tools/export.py <deck>.html --motion N` nimmt den Abschnitt auf, dessen Endstand Frame N ist. `motion.png` zeigt Anfang, zeitliche Mitte und Ende. Daneben liegen `start.png`, `midpoint.png` und `end.png` in voller Auflösung. Die Ausgabe liegt wie die Framevorschau in einem eigenen Ordner unter `export-preview/`. Wartezeit an einem manuellen Halt zählt nicht zur Dauer. Für einen gezielten Zeitpunkt im Browser `?slide=N&anim-t=0.3` verwenden.

**Bewegung im Leerlauf** läuft weiter, solange die Zeichnung an einem Zwischenstand oder Haltepunkt wartet, bis `still(t)` sie beendet:

| Art | Wirkung | Optionen |
|---|---|---|
| `"pulse"` | wird ruhig größer und kleiner | `to` (Standard 1,06), `period` in ms (1600) |
| `"blink"` | wird blasser und wieder voll | `min` (Deckkraft, Standard 0,35), `period` (1600) |
| `"flow"` | Striche wandern die Linie entlang, für Leitungen und Datenwege | `dash`, `gap` (je 12), `speed` pro Sekunde (80), `reverse` |

```js
a.step(a.draw("link"), a.show("packet"), a.idle("packet", "pulse"));   // wartet pulsierend auf →
a.step(a.still("packet"), a.along("packet", "route"), a.idle("link", "flow"));
```

`flow` strichelt nur Linien und Pfade der Gruppe; Kästen, Punkte, Pfeilspitzen und Text bleiben ganz. Die Bewegung läuft nur auf der Folie, die gerade gezeigt wird. Im Druck, im Export, im Selbsttest (Chrome headless), mit `?anim-t` und bei der Systemeinstellung „Bewegung reduzieren“ steht sie still: `pulse` und `blink` zeigen dann die Zeichnung unverändert, `flow` eine gestrichelte Linie. Technisch legt sie um jedes Ziel eine Gruppe `<g class="sk-idle">` und bewegt diese, deshalb verträgt sie sich mit allen Bausteinen oben.

Bedienung: → spielt den nächsten Abschnitt; läuft einer, springt er an sein Ende oder an den nächsten Haltepunkt; wartet er an einem Haltepunkt, läuft er weiter. ← zeigt den vorigen Zwischenstand, mit `back: "play"` spult es den Abschnitt dorthin zurück (auch aus einem laufenden Abschnitt heraus), und ein zweites ← springt sofort. **R** spielt die Animation der Folie von vorn. Das Notizfenster zeigt den Stand („animation 2/3 waiting“). `?anim-t=0.3` zeigt beim Laden den Abschnitt des Frames zu 30 % (für Tests). Eine Zeichnung mit Animation wird einmal beim Laden gezeichnet und nicht über `data-on-step` neu geschrieben.

Die [Galerie nach Lernziel](../examples/animations/guide.html) zeigt drei Bildfolgen mit Code und verlinkt direkt in die spielbaren Beispiele.

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
language = "en"    # Sprache aller Folien, auch der Beispiele; einmal festgelegt
lowercase = true   # optional; ohne Angabe: ja bei "en", nein bei "de"
margin = 120
preset = "hsos"    # optional: Grundlage aus themes/<name>.toml, diese Datei gilt darüber
logo = "logo.svg"  # optional: Logo oben rechts (SVG oder PNG, relativ zur toml); false schaltet es ab
logo_height = 56   # optional: Höhe des Logos in px
```

**Vorlagen.** `themes/` enthält fertige Designs als `style.toml`, bisher `hsos.toml`: das Design der Hochschule Osnabrück mit hellem Grund, Roboto und dem Hochschullogo oben rechts. Ein Projekt übernimmt eine Vorlage mit `preset = "hsos"` unter `[stagekit]` und ändert darüber nur, was abweicht, etwa die Sprache oder eine Farbe; `logo = false` nimmt das Logo weg. Ein neues Projekt ohne `style.toml` beginnt mit `python <stagekit>/tools/new_deck.py slides/<name> --theme hsos`. Die Farben behalten auf hellem Grund ihre Rollen: `white` ist die Textfarbe, `background` der Grund, die Akzente sind dunkler, damit sie auf Weiß lesbar bleiben. Dunkle Bänder (Vollbildfoto, `compare` ohne Überschrift) behalten weiße Schrift. Das Logo erscheint auf jeder Folie außer `fullbleed` und `compare` ohne Überschrift; die Knöpfe einer `figcode` rücken links daneben. `theme.py` schreibt das Logo als Daten-URI in die `theme.css`, sie bleibt also eine Datei und funktioniert, wo immer Deck und Framework liegen.
