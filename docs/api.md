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
d.verdict(x, y, w, h, text, ok, opts)   // grüner Rahmen mit Haken (true), roter mit Kreuz (false), ohne Zeichen (null)
d.mark(cx, cy, ok, {size})             // nur das Zeichen, überall gleich groß
d.icon(x, y, size, paths, {color})     // Bootstrap-Icons-Symbol; paths aus `tools/icon.py <name> --js`, Standardfarbe Grau
d.highlight(x, w, centerY, size, {color, opacity, pad, rx})  // Kasten über eine ganze Textstelle, Höhe aus der Schriftgröße
d.ipo(y, input, processing, output, {level, active, monoBox})  // IPO-Zeile mit fester Geometrie: Eingabe, Kasten, Ausgabe
d.color("families-transfer")           // benannte Zusatzfarbe aus [colors.<tabelle>] der style.toml
d.formula(x, y, "H = log_2(N)", {size, color, anchor, centerY})  // _ tief, ^ hoch, {} gruppiert
d.label(x, y, text, {size, color, anchor, mono, lineHeight, centerY})  // "\n" bricht um; centerY: mittig zu dieser Hoehe
d.line(x1, y1, x2, y2, {color, width, dashed});  d.arrow(x1, y1, x2, y2, {color, width})
d.wire([[x,y],…], on);  d.dot(x, y, on);  d.gate("and|or|xor|not|nand|nor", x, y, on)
d.lamp(x, y, on, caption);  d.toggle(x, y, on, label)
d.truthTable(["a","b"], ["out"], [{in:[0,0], out:[0]}, …], nowIndex)   // HTML-Tabelle
```

Hooks: `data-on-show="fn"` und `data-on-step="fn"` auf einer Folie rufen `window.fn(slide, step)`.

Live-Abfrage (braucht `data-live-url` am `div.deck`):

```html
<section class="slide poll" data-poll="byte-values">
  <div class="poll-q">how many different values can one byte hold?</div>
  <ol class="poll-opts"><li>8</li><li>16</li><li data-correct>256</li><li>no idea</li></ol>
  <aside class="notes">…</aside>
</section>
```

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
| `set(t, { opacity, x, y, scale, rotate, draw })` | Startzustand ausdrücklich setzen |
| `wait(ms)` / `hold()` | Pause / anhalten bis → (halbautomatisch) |
| `par(…)` / `seq(…)` | gleichzeitig / nacheinander (Standard in `step`) |

Gemeinsame Optionen: `dur` in ms (Standard 800), `ease`: `"inOut"` (Standard), `"in"`, `"out"`, `"linear"`. Ziele sind Namen aus `d.g(name, …)` oder CSS-Selektoren innerhalb der Zeichnung. Bilder kommen mit `d.image(x, y, w, h, "img/…jpg", { fit })` in die Zeichnung; ein freigestelltes Objekt als PNG (`image.py --transparent`) lässt sich wie jede Gruppe bewegen, drehen und skalieren.

Optionen der Animation: `auto: true` lässt die Abschnitte nach dem ersten → von selbst aufeinander folgen, mit `gap` ms Pause (Standard 600); `autostart: true` startet den ersten Abschnitt beim Betreten der Folie; `first` ist der Aufbauschritt des ersten Abschnitts (Standard 1), damit andere `data-step`-Elemente der Folie mit einem Abschnitt zusammen erscheinen können; `back: "play"` lässt ← den Abschnitt rückwärts abspielen statt zum vorigen Zwischenstand zu springen, in `backSpeed`-fachem Tempo (Standard 2).

Bedienung: → spielt den nächsten Abschnitt; läuft einer, springt er an sein Ende oder an den nächsten Haltepunkt; wartet er an einem Haltepunkt, läuft er weiter. ← zeigt den vorigen Zwischenstand, mit `back: "play"` spult es den Abschnitt dorthin zurück (auch aus einem laufenden Abschnitt heraus), und ein zweites ← springt sofort. **R** spielt die Animation der Folie von vorn. Das Notizfenster zeigt den Stand („animation 2/3 waiting“). `?anim-t=0.3` zeigt beim Laden den Abschnitt des Frames zu 30 % (für Tests). Eine Zeichnung mit Animation wird einmal beim Laden gezeichnet und nicht über `data-on-step` neu geschrieben.

Ein vollständiges Beispiel mit allen drei Betriebsarten liegt in `examples/animations/`.

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
```
