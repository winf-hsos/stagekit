# API und Vorlagen

Nachschlagedatei zum Skill `stagekit` (`SKILL.md`): das Gerüst eines Decks, die
Zeichenfunktionen aus `draw.js`, Live-Abfragen und die Vorlage der
`style.toml`. Beim Schreiben von HTML und `deck.js` daneben offen halten.

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
