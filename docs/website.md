# Decks auf Webseiten

Nachschlagedatei zum Skill `stagekit` (`SKILL.md`, Schritte 4 und 5): wie ein
Deck in eine Website kommt und wie seine Zeichnungen dort als Abbildungen
dienen. Nur nötig, wenn ein Projekt eine Website mit Decks führt.

## Einbindung in eine Website (der Player)

Ein Deck laedt Framework und Bilder ueber relative Pfade; auf einer fremden Seite muss es fuer sich stehen. Zwei Schritte:

**a) Deck kopieren.** Ein Sync-Skript im einbettenden Projekt (in einer Quarto-Website etwa als `pre-render` eingehaengt) kopiert `<deck>.html`, `deck.js`, `theme.css` und nur die tatsaechlich geladenen Bilder in einen erzeugten Ordner, schreibt die Framework-Pfade auf einen gemeinsamen `stagekit/`-Ordner daneben um und nimmt das PDF aus `export/` als `<name>.pdf` mit. **Nur schreiben, was sich geaendert hat**, sonst dreht ein laufender `quarto preview` endlos, weil jeder Neubau das Skript erneut ausloest.

**b) Player einsetzen.** Das Deck bringt seine Bedienung selbst mit: `?bar=1` blendet oben rechts eine Leiste ein mit zurueck, Zaehler, vor, Vollbild, "in eigenem Tab oeffnen" und, wenn `?pdf=<pfad>` mitgegeben wird, dem PDF. Alles als Symbol mit Tooltip; unter dem Rahmen steht dadurch kein Link mehr. Im Iframe hat die Tastatur erst nach einem Klick den Fokus, deshalb ist die Leiste dort Pflicht.

In Quarto in einem `{=html}`-Block (Markdown-Links wuerden im Rohblock nicht gerendert):

```html
<div class="deck-embed">
  <iframe src="../assets/decks/<name>/<name>.html?bar=1&pdf=../<name>.pdf"
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

Der `pdf`-Pfad ist relativ zur HTML-Datei des Decks, nicht zur einbettenden Seite. `allowfullscreen` ist noetig, damit der Vollbildknopf und die Taste F wirken. Fotos, die ein Deck per Canvas ausliest, muessen aus demselben Ursprung kommen (ins `img/` des Decks kopieren), sonst verweigert der Browser die Pixel.

## Abbildungen für Webseiten aus dem Deck

Die Zeichnungen eines Decks sind reine SVG-Strings und können als Abbildungen einer Website dienen, in einer hellen Palette. Dazu:

- **Benannte Zusatzfarben, wenn Farbe Struktur ist.** Trägt ein Satz Farben, die etwas bezeichnen statt zu bewerten (Konzeptfamilien einer Karte, Gruppen, Teile), stehen sie als eigene Tabelle in der `style.toml`, etwa `[colors.families]` mit `transfer = "D6336C"`. `theme.py` schreibt daraus `--families-transfer`, und `deck.js` liest sie mit `d.color("families-transfer")`; so bleibt das Deck frei von Hex-Werten, und die Website-Fassung bekommt dieselben Werte (oder eigene unter `[colors.light.families]`). Solche Farben tragen dann **nur** diese Bedeutung: In derselben Zeichnung urteilt nichts über Rot oder Gelb aus der Achterpalette (Regel vom 15.09.2026).
- `[colors.light]` in der `style.toml` mit denselben Schlüsseln wie `[colors]`; `theme.py` schreibt daraus `:root[data-theme="light"]`, und `draw.js` schaltet den Block ein, wenn `?theme=light` in der Adresse steht. Die Rollen bleiben: „yellow“ ist weiter die Farbe für 1, aktuell und Strom, „white“ die des Wichtigsten.
- Zeichenfunktionen in `deck.js` geben ihr SVG **zurück** und schreiben es nur in ihr Element, wenn es das gibt (`if ($("fig-x")) …`); der Start des Decks steht unter `if ($("erstes-element"))`, damit `deck.js` auch ohne Folien lädt. Was die Website braucht, wird als `window.deckNN = {…}` veröffentlicht.
- `figures.js` im Deckordner: `window.figures = { "name": () => svg, "anderes": async () => svg }`. Jede Funktion liefert ein komplettes SVG aus `draw.js`; für Tafeln gibt es `d.table(x, y, headers, rows, {cw, rh, size, hl})` als SVG-Fassung der HTML-Wahrheitstafel. Beschriftungen in der Sprache des Satzes (`[stagekit] language`), Codeschrift für Bits, dieselben Größen wie auf den Folien.
- `python <stagekit>/tools/figures.py <ordner>/<deck>.html --out <ordner> --theme light` schreibt je Abbildung `<name>.svg` (Roboto Mono eingebettet, Breite und Höhe aus der viewBox). **Das Skript misst dabei jede Abbildung** und meldet am Ende, was über die viewBox hinausläuft („links 22 px abgeschnitten“) und was unter der Zeichnung leer bleibt. Beides sieht man der SVG-Datei nicht an: Der Text steht vollständig darin, der Browser schneidet ihn nur ab. Gemessen wird mit den echten Schriftbreiten, nachdem die Codeschrift geladen ist, also genau das, was der Leser sieht. **Ein Deck mit einem Befund ist nicht fertig**: Abgeschnittenes wird enger gesetzt, Leerraum wird aus der viewBox-Höhe herausgenommen. Trägt eine Zeichnung einen Aufbau in Schritten, ruft `figures.js` sie im letzten Schritt auf, damit die viewBox zum vollen Inhalt passt. **Jede Abbildung danach trotzdem als Screenshot auf Weiß ansehen** (Chrome headless mit `--default-background-color=ffffffff` auf die SVG-Datei): zu enge Spalten, Kollisionen und Farben, die auf hellem Grund verschwinden, findet keine Messung.
