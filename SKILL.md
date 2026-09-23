---
name: stagekit
description: Foliensätze als HTML mit stagekit entwerfen und bauen (SVG-Zeichnungen, eingebettete Demonstratoren, Design aus theme.css). Erst Basisinfos erfragen, dann Markdown-Entwurf zur Freigabe, erst danach das Deck bauen. Für neue Vorträge, Lehrveranstaltungs-Inputs und Änderungen an bestehenden stagekit-Decks.
---

# stagekit: Foliensätze als HTML entwerfen und bauen

Dieses Skill beschreibt den verbindlichen Arbeitsablauf für Foliensätze mit `stagekit` (Dateien `stagekit.css`, `stagekit.js`, `draw.js`, `tools/`). `<stagekit>` steht im Folgenden für den Ordner, in dem das Repository liegt. Ein Deck ist eine HTML-Datei plus Notizen plus Zeichnungen in einem kleinen Skript; die Designwerte kommen aus der `theme.css` des Decks, erzeugt aus der `style.toml` des Projekts. Fehlt beides, lege die `style.toml` als ersten Schritt an (Vorlage unten) und erzeuge daraus die `theme.css`.

## Der Ablauf, in dieser Reihenfolge

### 1. Basisinfos erfragen (immer zuerst)

Was der Nutzer schon mitgeliefert hat, wird nicht erneut gefragt; der Rest in **einem** kompakten Dialog:

1. **Thema und Kernbotschaft:** der eine Satz, den das Publikum behalten soll.
2. **Publikum und Vorwissen.**
3. **Anlass und Dauer** (Faustregel: deutlich unter zwei Minuten je Inhaltsfolie). Dabei klären, ob der Satz einmalig gehalten wird oder wiederkehrt — davon hängt ab, ob ein Datum auf die Titelfolie gehört.
4. **Sprache der Folien** (die Folien in der Sprache des Publikums; Skript und Sprechernotizen dürfen in einer anderen Sprache stehen). Die Antwort wird **einmal** in der `style.toml` des Projekts festgehalten (`[stagekit] language = "en"`), und danach ist **alles auf den Folien** in dieser Sprache: Überschriften, Beschriftungen, Zeichnungen, und auch die Beispiele, Beispielsätze und Beispieldaten. Ein deutscher Beispielsatz auf einer englischen Folie („die sonne scheint") ist ein Fehler, kein Lokalkolorit (Regel vom 14.09.2026). Bei Deutsch gilt die Kleinschreibung nicht: `theme.py` setzt `--lowercase` dann auf `none`, Substantive bleiben groß.
5. **Eröffnung:** jeder Satz beginnt mit einem Symbolfoto samt Geschichte. Das Bild wird erzeugt, nicht gesucht (`tools/image.py`); frag nach dem Motiv, wenn der Nutzer keines nennt.
6. **Design:** gilt die `style.toml` des Projekts, oder braucht dieser Satz eine eigene?
7. **Interaktive Elemente:** gibt es Demonstratoren oder Live-Daten, die auf eine Folie gehören? Das ist die Stärke von stagekit; frag danach.

### 2. Entwurf als Markdown (Diskussionsgrundlage)

Der Satz entsteht zuerst als `entwurf.md` im Satzordner, nicht als HTML. Er wird iteriert, bis der Nutzer ihn **ausdrücklich freigibt**. Vor der Freigabe wird kein Deck gebaut, auch nicht „zur Ansicht“.

Format (verbindlich): Kopf mit `# Entwurf: Input „<titel>“`, Status, Verortung; Symbolschlüssel als Tabelle (🎬 Abschnittsfolie, 📷 Foto, 🖼️ Zeichnung, 📊 Vergleich, 💬 Merksatz, ⌨️ Code, 🪜 Aufbau in Schritten, 🧪 Live-Moment, 🕹️ eingebetteter Demonstrator); dann `# Die Folien`, gegliedert in `## Teil N: <titel> (<X> Folien)`, je Folie ein Block `### Folie N <symbole>` mit Folientext in Backticks, Elementen fett (**Bild:**, **Zeichnung:**, **Titel klein:**, **Text:**, **Demo:**), Sprechernotiz als **Dazu sagen.**, Live-Momente als **Live-Moment:**. Die Kleinschreibung gilt nur für Folientext; die Prosa des Entwurfs ist normales Deutsch.

### 3. Bau des Decks (erst nach Freigabe)

- Deckordner mit `index.html` (aus `template/deck.html`), `deck.js` für die Zeichnungen, `theme.css` (aus der `style.toml`: `python <stagekit>/tools/theme.py style.toml <ordner>/theme.css`), Fotos in `img/`.
- Titelfolie: Titel und Untertitel nennen Modul oder Anlass und den Namen der vortragenden Person. **Ein Datum gehört nur auf einen Satz, der genau einmal gehalten wird** — eine Gremiensitzung, ein Vortrag, eine Verteidigung; dort ist der Termin Teil des Anlasses und benennt die Fassung, über die geredet wurde. **Bei allem, was wiederkehrt, bleibt das Datum weg**: Lehrveranstaltungen, Modul-Inputs, Vorlagen. Dort veraltet es im nächsten Semester und macht aus einem brauchbaren Satz einen, den man erst anfassen muss. Im Zweifel fragen, welcher der beiden Fälle vorliegt; die Frage gehört in den Basisinfo-Dialog zum Anlass (Regel vom 15.09.2026).
- Struktur ist Pflicht: `<section class="slide title">` und `agenda` (leer lassen, stagekit füllt sie aus `data-title`, `data-subtitle`, `data-parts`), je Teil `<section class="slide part" data-part="…">`, Ortsangabe entsteht automatisch. Teilfarben optional über `data-part-colors='{"teil": "#hex"}'`.
- Eröffnungsfoto: `<img class="photo" src="img/…jpg">` rechts, `<div class="photo-text">` links, Fußnote `image: ai-generated (<modell>)`; Bild in 3840x2160 mit schwarzem Grund, erzeugt mit `python <stagekit>/tools/image.py "<beschreibung>" img/<name>.png --size 3840x2160`.
- **Fotos lädt das Deck als JPEG, nicht als PNG.** Der Vektor-PDF-Export bettet jedes Bild so ein, wie das Deck es lädt, und ein 3840er PNG wiegt im PDF rund 8 MB; zwei Fotos machten aus einem Satz ein PDF von 23 MB. Dasselbe Foto als JPEG mit Qualität 92 und ohne Farbunterabtastung (`subsampling=0` in Pillow) behält die volle Auflösung, ist ein Fünftel so groß und sichtbar nicht zu unterscheiden (mittlere Abweichung unter 1 von 255); das PDF desselben Satzes lag danach bei 4 MB. Das PNG aus dem Generator bleibt als Original unter `img/original/` liegen und wird nicht geladen; ein Sync-Skript, das nur geladene Bilder kopiert, lässt es damit von selbst weg. Freigestellte Objekte mit Transparenz bleiben PNG (Regel vom 15.09.2026).
- **Bilder werden erzeugt, nicht gesucht — und zwar großzügig.** `tools/image.py` schreibt aus einer Beschreibung ein Bild (OpenAI `gpt-image-2.5-flare`, der Standard seit dem 08.09.2026; `--model sunburst` für `gpt-image-2.5-sunburst`, wenn Bearbeitungspräzision zählt). Das gilt nicht nur für die Eröffnung: Wo ein Symbolfoto, ein freigestelltes Objekt oder eine Szene eine Aussage trägt, ist ein erzeugtes Bild der Normalfall. Es passt in Format, Farbklima und Bildsprache zum Satz, es kostet Sekunden, und die Rechtefrage stellt sich nicht. Ein Stockfoto oder ein Bild aus der Suche kann das alles nicht. **Also lieber ein Bild zu viel vorschlagen als eines zu wenig** — besonders für die Eröffnung, für einen Themenwechsel und für den Schluss.
- **Ein Bildauftrag wird ausformuliert, nicht gestichwortet.** Motiv, Blickwinkel, Licht, Stimmung, und für Folienfotos ausdrücklich der schwarze Hintergrund, damit das Bild nahtlos in die Folie übergeht. Folienfotos mit `--size 3840x2160`, freigestellte Objekte mit `--transparent`; Qualität `high` ist der Standard, `xhigh` und `max` gibt es für den Fall, dass ein Detail nicht stimmt. Die Fußnote `image: ai-generated (<modell>)` gehört auf jede Folie mit einem erzeugten Bild, mit der Kennung, die das Skript ausgibt (heute `gpt-image-2.5-flare`); ältere Folien behalten die Kennung des Modells, das ihr Bild wirklich erzeugt hat.
- **Fehlt der API-Schlüssel, wird gefragt.** `image.py` bricht dann mit einer Meldung ab, die die drei möglichen Orte nennt (`OPENAI_API_KEY`, `openai.key` im Projekt, `~/.openai.key`). Dann den Nutzer fragen, wo sein Schlüssel liegt oder ob er einen hinterlegen will. **Nicht** die Fotofolie stillschweigend weglassen, **kein** Platzhalterbild, und den Satz nicht ohne Eröffnung bauen und das Fehlen erst am Ende erwähnen. Ein Foliensatz ohne Eröffnungsbild ist eine Entscheidung des Nutzers, kein Ausweichmanöver des Agenten.
- Inhaltsfolie: `<h2>` kleine Überschrift, `.content` mit `.header`, `.statement`, `.lines`, `.code`, `.sidenote`, `.remark`; `.footnote`. Aufbau in Schritten mit `data-step="n"` an den Elementen, die später erscheinen; sie behalten ihren Platz. Ändert ein Schritt Inhalte (Text, Tabelle, Zeichnung per Hook), müssen die Container ihre Größe behalten: feste Höhen, Ausrichtung oben, gleich lange Texte.
- Zeichnungen: SVG-Strings aus `draw.js` in ein `<div class="figure" id="…">`, geschrieben von `deck.js` beim Laden. Für Aufbau in Schritten je Schritt neu zeichnen über `data-on-show="fn"` / `data-on-step="fn"` (globale Funktionen mit `(slide, step)`).
- Demonstratoren: `<div class="embed"><iframe src="…" title="…"></iframe></div>`. Auf der Folie steht sonst nur die kleine Überschrift.
- Notizen: `<aside class="notes">` je Folie; sie erscheinen im Notizfenster (N).
- Parallel zum Bau entsteht `skript.md`: der Text zum Nachlesen in Folienreihenfolge, als eigenständiger Text lesbar.
- Nach dem Bau: `python <stagekit>/tools/export.py <ordner>/index.html` (PDF, PNGs, Kontaktbogen, **Schrittprüfung und Schriftprüfung**), Kontaktbogen und Einzelfolien **ansehen**, erst dann dem Nutzer melden. Die Schrittprüfung (`--steps`) schaltet jede Folie mit Aufbau durch und meldet jedes Element, das zwischen zwei Schritten seine Position ändert. **Ein Deck mit einer springenden Folie ist nicht fertig.** Häufigste Ursache: ein zentrierter Block, dessen Inhalt beim Schritt wächst (längerer Text, neue Tabelle, anderes Bild). Abhilfe: dem wachsenden Element eine feste Höhe (`min-height`) geben oder den Container oben ausrichten, und Texte je Schritt gleich lang halten.
- **Das PDF ist Vektor.** `export.py` lässt Chrome die Druckansicht (`?print`) direkt nach PDF drucken: Text bleibt Text, Zeichnungen bleiben SVG, nichts wird beim Zoomen pixelig, und die Datei ist rund ein Zehntel so groß. **Bei eingebetteten Demonstratoren entscheidet der Blick ins fertige PDF.** Ein `<iframe>` kann leer bleiben, muss aber nicht: Liegt der Demonstrator im selben Ursprung wie das Deck und ist schnell geladen, druckt er vollständig mit, Bedienelemente und Text als Text (am 15.09.2026 an einem Satz mit zwei lokalen Demonstratoren nachgesehen). Ist der Rahmen im PDF dagegen leer, den Satz mit `--pdf-raster` exportieren: Das baut das PDF aus den Frame-PNGs, also aus Bildern der Folien. Für Fotofolien ist beides gleich gut, ein Foto ist ohnehin ein Bild.
- **Die Framework-Kopie im Deckordner muss aktuell sein.** Der Vektorweg braucht die Druckansicht, die je Aufbauschritt zeichnet und danach klont (Marker `print-clone-ids` in `stagekit.js`). Führt ein Deck eine ältere Kopie, fällt der Export von selbst auf den Bildweg zurück und sagt es; dann die drei Framework-Dateien in den Deckordner kopieren.
- Zum Ansehen im Browser einen lokalen Server oberhalb von Deck und Framework starten (`python -m http.server 8800 --bind 127.0.0.1` in dem Ordner, der Deck und Framework enthält), Adresse mit `?slide=N` für einen bestimmten Frame; nach änderungen Strg+F5. Einzelne Frames prüft man mit Chrome headless: `chrome --headless=new --window-size=1200,675 --virtual-time-budget=3000 --screenshot=<png> <url>?slide=N`.
- **Jeder Aufbauschritt ist eine Folie mit eigener Nummer** (Zähler, Adresse, PDF, Kontaktbogen). Folienverweise in `skript.md` zählen deshalb Frames.

### 4. Einbindung in eine Website (der Player)

Ein Deck laedt Framework und Bilder ueber relative Pfade; auf einer fremden Seite muss es fuer sich stehen. Zwei Schritte:

**a) Deck kopieren.** Ein Sync-Skript im einbettenden Projekt (in einer Quarto-Website etwa als `pre-render` eingehaengt) kopiert `index.html`, `deck.js`, `theme.css` und nur die tatsaechlich geladenen Bilder in einen erzeugten Ordner, schreibt die Framework-Pfade auf einen gemeinsamen `stagekit/`-Ordner daneben um und nimmt das PDF aus `export/` als `<name>.pdf` mit. **Nur schreiben, was sich geaendert hat**, sonst dreht ein laufender `quarto preview` endlos, weil jeder Neubau das Skript erneut ausloest.

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

- **Benannte Zusatzfarben, wenn Farbe Struktur ist.** Trägt ein Satz Farben, die etwas bezeichnen statt zu bewerten (Konzeptfamilien einer Karte, Gruppen, Teile), stehen sie als eigene Tabelle in der `style.toml`, etwa `[colors.families]` mit `transfer = "D6336C"`. `theme.py` schreibt daraus `--families-transfer`, und `deck.js` liest sie mit `d.color("families-transfer")`; so bleibt das Deck frei von Hex-Werten, und die Website-Fassung bekommt dieselben Werte (oder eigene unter `[colors.light.families]`). Solche Farben tragen dann **nur** diese Bedeutung: In derselben Zeichnung urteilt nichts über Rot oder Gelb aus der Achterpalette (Regel vom 15.09.2026).
- `[colors.light]` in der `style.toml` mit denselben Schlüsseln wie `[colors]`; `theme.py` schreibt daraus `:root[data-theme="light"]`, und `draw.js` schaltet den Block ein, wenn `?theme=light` in der Adresse steht. Die Rollen bleiben: „yellow“ ist weiter die Farbe für 1, aktuell und Strom, „white“ die des Wichtigsten.
- Zeichenfunktionen in `deck.js` geben ihr SVG **zurück** und schreiben es nur in ihr Element, wenn es das gibt (`if ($("fig-x")) …`); der Start des Decks steht unter `if ($("erstes-element"))`, damit `deck.js` auch ohne Folien lädt. Was die Website braucht, wird als `window.deckNN = {…}` veröffentlicht.
- `figures.js` im Deckordner: `window.figures = { "name": () => svg, "anderes": async () => svg }`. Jede Funktion liefert ein komplettes SVG aus `draw.js`; für Tafeln gibt es `d.table(x, y, headers, rows, {cw, rh, size, hl})` als SVG-Fassung der HTML-Wahrheitstafel. Beschriftungen in der Sprache des Satzes (`[stagekit] language`), Codeschrift für Bits, dieselben Größen wie auf den Folien.
- `python <stagekit>/tools/figures.py <deck>/index.html --out <ordner> --theme light` schreibt je Abbildung `<name>.svg` (Roboto Mono eingebettet, Breite und Höhe aus der viewBox). **Das Skript misst dabei jede Abbildung** und meldet am Ende, was über die viewBox hinausläuft („links 22 px abgeschnitten“) und was unter der Zeichnung leer bleibt. Beides sieht man der SVG-Datei nicht an: Der Text steht vollständig darin, der Browser schneidet ihn nur ab. Gemessen wird mit den echten Schriftbreiten, nachdem die Codeschrift geladen ist, also genau das, was der Leser sieht. **Ein Deck mit einem Befund ist nicht fertig**: Abgeschnittenes wird enger gesetzt, Leerraum wird aus der viewBox-Höhe herausgenommen. Trägt eine Zeichnung einen Aufbau in Schritten, ruft `figures.js` sie im letzten Schritt auf, damit die viewBox zum vollen Inhalt passt. **Jede Abbildung danach trotzdem als Screenshot auf Weiß ansehen** (Chrome headless mit `--default-background-color=ffffffff` auf die SVG-Datei): zu enge Spalten, Kollisionen und Farben, die auf hellem Grund verschwinden, findet keine Messung.

### 6. Danach: die HTML-Datei ist die Quelle

Änderungen laufen direkt an `index.html` und `deck.js`, nicht über einen Neubau. Jede inhaltliche Änderung zieht dieselbe Änderung in `skript.md` nach sich, im selben Arbeitsgang.

## Gestaltungsregeln (Kurzfassung)

- Folientext kleingeschrieben (`--lowercase` im Theme; **nur bei englischen Sätzen**, ein deutscher Satz behält seine Großbuchstaben, `language = "de"` in der `style.toml` schaltet es ab), kein Kursiv, keine Übergänge. Code, Eigennamen und Abkürzungen wie RAM, CPU, LLM bleiben groß: im HTML mit `class="keep-case"`, in Zeichnungen mit `keepCase: true`.
- Acht Farben, **genau vier Schriftgrößen**, nur aus dem Theme: `var(--tiny)`, `var(--small)`, `var(--normal)`, `var(--large)` (20, 32, 48, 80 px auf der 1920er Leinwand) und in Zeichnungen `size: 20 | 32 | 48 | 80`. Keine anderen Pixelwerte, auch nicht „ein bisschen kleiner, damit es passt“: Passt es nicht, wird das Layout geändert, nicht die Größe. Der Export prüft das (`--fonts`) und meldet jede fremde Größe. Nie Hex-Werte im Deck. Farbe ist Bedeutung: Blau verweist, Gelb merkt an und zeigt „aktuell“, Rot ist der sparsame Hingucker.
- **Codeschrift für alles, was der Rechner liest:** Bits, Bytes, Hex-Adressen, Binärzahlen, Bezeichner, Formeln (`var(--mono)` bzw. `mono: true`), ohne Ausnahme und auf jeder Folie gleich. Bitfolgen in Vierergruppen mit Leerzeichen; Bytes, die untereinander stehen (Addition, Vergleich), Stelle für Stelle ausgerichtet: Bits rechtsbündig an einer gemeinsamen Kante, Gleichheitszeichen fest, Dezimalzahlen rechtsbündig.
- **Zeigt eine Zeichnung echte Farben, trägt daneben keine Palettenfarbe Bedeutung.** Sobald die Flächen für sich selbst stehen, also für rotes, grünes, blaues Licht statt für eine Rolle, konkurrieren zwei Lesarten um dieselbe Farbe: Rot ist dann gleichzeitig das gesendete Symbol und der Warnhinweis. Die Zeichnung verliert dadurch nicht an Schönheit, sondern an Eindeutigkeit. In so einer Zeichnung sind Beschriftungen, Zeiger und Marken deshalb **weiß**, und das Urteil trägt die Punchline darunter, nicht die Farbe im Bild. Rot im Kasten auf rotem Grund ist ohnehin schlecht lesbar; das ist nur das sichtbare Symptom. **Ausnahmen sind erlaubt, wenn sie begründet sind** und die Begründung als Kommentar neben der Zeichenfunktion steht: etwa wenn genau ein Element markiert werden muss, das in keiner der gezeigten echten Farben vorkommt (ein gelber Taktimpuls über roten und grünen Symbolen), oder wenn eine Zeichnung nur teilweise echte Farben zeigt und der bewertete Teil sauber davon getrennt liegt.
- **Gelb heißt 1 oder „aktuell“**, sonst nichts: leuchtende Leitungen, gesetzte Bits, die markierte Zelle, die aktuelle Tafelzeile. Braucht eine zweite Betonung eine Farbe (etwa aufgefüllte Nullen), nimmt sie Grün; Rot bleibt der Warnhinweis.
- **Verbinder liegen hinter dem Shape, in das sie führen.** Kein Strich darf auf einem Rahmen oder in einem Kasten sichtbar bleiben: erst alle Linien zeichnen, dann die Kaesten (`layers(wires, boxes, labels)`), und Kaesten mit Hintergrundfüllung, die den Linienrest abdeckt (`box()` füllt dafür seit dem 08.09.2026 standardmässig mit `--bg`). Dasselbe gilt für Pfeile: Die Spitze endet an der Kante, nicht darin.
- Zeichnungen: Linien und Rahmen in `--white` oder `--gray-light`, Strom in Gelb, Inaktives in `--gray-dark`. Leitungen nur waagerecht und senkrecht, mit `d.layers(wires, gates, labels)` hinter den Gattern; Eingaben als Kippschalter (`d.toggle`), Ausgaben als Lampen (`d.lamp`); Zeichnung so groß wie die Fläche erlaubt, nur über die viewBox skaliert.
- Tabellen: Wahrheitstafeln mit `.tt` (`.tt.large` neben großen Zeichnungen), schriftliche Addition mit `table.sum` (Zeile `carries` für die überträge in Bitgröße, Summenzeile mit Strich). Tabellen ohne Rahmenlinien-Wildwuchs: Kopf und Zeilen aus dem Framework, keine eigenen Rahmen.
- **Der `.content`-Block deckt die ganze Folie ab** und zentriert senkrecht; ein hoher Block läuft deshalb unter die überschrift. Dann `style="top: 150px"` (oder eine Klasse) setzen, damit der Block unter der überschrift zentriert. Abstände zwischen Zeilen und Spalten großzügig (40 bis 60 px), zwischen Beschriftung und Wert mindestens 100 px.
- **Formeln werden gesetzt, nicht getippt.** Kein `log2(x)`, kein `x^2` im Fließtext: `d.formula(x, y, "H = log_2(N)")` setzt die Formel in Codeschrift, `_` stellt tief, `^` hoch, geschweifte Klammern fassen zusammen (`H_{before}`). Tief- und Hochgestelltes läuft automatisch in der nächstkleineren der vier erlaubten Größen, die Schriftprüfung bleibt also still. Für alles, was darüber hinausgeht (Brüche, Summen, Wurzeln), gibt es in HTML-Decks bewusst nichts: Solche Formeln gehören in dieser Lehre auf die Konzeptseite, wo Quarto sie satzt, nicht auf eine Folie.
- **Mehrere Zeilen in einem Kasten stehen linksbündig, nicht zentriert.** Sobald in einem Kasten mehr als eine Zeile steht (eine Codetabelle, mehrere Zuweisungen, eine Aufzählung), werden die Zeilen an einer gemeinsamen linken Kante ausgerichtet, damit Gleichheitszeichen, Doppelpunkte und Werte untereinander liegen; der Block als ganzes sitzt optisch mittig im Kasten. Zentriert wird nur eine einzelne Zeile. Praktisch: die linke Kante aus der längsten Zeile ausrechnen (`x + (breite - laengste.length * size * 0.6) / 2`) und alle Zeilen dort mit `d.label(links, …)` absetzen, ohne `anchor`. Zentrierte Codezeilen sehen aus wie ein Textabsatz und sind an der Stelle, an der man vergleichen will, unlesbar.

- **Text in einem Kasten hält Abstand zum unteren Rand.** Ein Kasten wird nach seinem Inhalt bemessen, nicht der Inhalt nach dem Kasten. Faustregel: unter der letzten Zeile bleibt mindestens eine halbe Zeilenhöhe frei, bei `size: 48` also rund 40 Einheiten zwischen der Mitte der letzten Zeile und der Unterkante. Wer nur bis zur Grundlinie rechnet, vergisst die Unterlängen, und der Text klebt am Rahmen.

- **Ein Textblock in einem Kasten hält oben und unten denselben Abstand zur Kante.** Gemessen wird an der sichtbaren Ober- und Unterkante des Textes, also an der Mitte der ersten Zeile minus ihrer halben Schriftgröße und an der Mitte der letzten plus deren halber Größe, nicht an den Grundlinien und nicht an den Zeilenmitten. Eine Zeile in 48 px reicht 24 px über und unter ihre Mitte hinaus, eine in 32 px nur 16: Wer die Zeilenmitten gleichmäßig verteilt, bekommt unten zu wenig Luft, sobald die letzte Zeile größer ist als die erste, und genau das fällt an einem Kasten sofort auf. Passt der Block nicht, wächst der Kasten; die Zeilenabstände bleiben. Die Rechnung gehört als Kommentar neben den Kasten, damit die nächste Änderung sie nachziehen kann.
- **Das IPO-Modell als fertiges Element.** Zeigt eine Zeichnung eine Verarbeitung, also Eingabe, Kasten, Ausgabe, wird sie mit `d.ipo(y, input, processing, output, {level, active, monoBox})` gezeichnet und nicht von Hand: eine Zeile mit fester Geometrie, damit dieselbe Aussage in jedem Satz gleich aussieht. Ob ein Projekt das Modell zu einem wiederkehrenden Element macht und wo es stehen soll, entscheidet das Projekt; diese Regel gehört in dessen eigene Anweisungen, nicht hierher.
- **Eine Textstelle hervorheben heißt: ein Kasten über die ganze Stelle.** Wer in einem Satz „the sun" markiert, legt einen durchscheinenden Kasten in der Bedeutungsfarbe (Gelb: das, worum es gerade geht) über die sieben Zeichen zusammen, nicht sieben Kästchen nebeneinander, und die Zeichen darin wechseln in dieselbe Farbe. Immer über `d.highlight(x, w, centerY, size, {color})`: Die Höhe kommt aus der Schriftgröße (1,4 em), der Rand ist oben und unten gleich, der Kasten hat keinen Rahmen. Höhe oder Ränder von Hand zu raten ist der Fehler, den dieses Element verhindert (Regel vom 14.09.2026).
- **Beschriftungen sitzen mittig zu dem, was sie beschriften.** Ein Label neben einem Kasten wird nicht an einer selbst ausgerechneten Grundlinie abgesetzt, sondern an der Mitte des Kastens: `d.label(x, y, text, { centerY: kastenMitte })` bestimmt die Grundlinie selbst, auch bei mehreren Zeilen. Von Hand gesetzte Grundlinien sind der häufigste Grund dafür, dass ein zweizeiliges Label sichtbar zu tief steht: Eine Zeile sitzt auf der Mitte, zwei Zeilen hängen darunter. Dasselbe gilt für Werte neben Formen, Erklärzeilen an Kästen und Achsenbeschriftungen an Balken. **Abweichungen nur mit Grund** und dann sichtbar begründet: wenn mehrere Beschriftungen an einer gemeinsamen Kante ausgerichtet werden (Eingabe-Labels rechtsbündig vor dem Pfeil), wenn eine Beschriftung bewusst an der Oberkante einer Spalte steht, oder wenn zwei Labels sonst kollidieren würden.
- **Bewertung: grüner Rahmen mit Haken, roter Rahmen mit Kreuz.** Die bessere Lösung, die richtige Antwort, der Weg, der trägt: Der Kasten bekommt einen grünen Rahmen und mittig an seinem unteren Rand einen kleinen grünen Haken. Das Gegenstück bekommt Rahmen und Kreuz in Rot, in derselben Größe und an derselben Stelle. Immer über `d.verdict(x, y, w, h, text, ok, opts)` zeichnen, nie von Hand, damit das Zeichen auf jeder Folie gleich aussieht und gleich sitzt; `ok` ist `true`, `false` oder `null` für den Fall, dass das Urteil erst in einem späteren Schritt erscheint (gleicher Kasten, gleiche Textlage, nur ohne Zeichen). Steht ein bewerteter Kasten neben unbewerteten, bekommen auch die `verdict(..., null, {border: …})`, sonst sitzt ihr Text höher als der der Nachbarn. Kein zweites Zeichen für dieselbe Aussage: Die Farbe des Rahmens sagt es schon, der Haken wiederholt sie für den, der sie nicht sieht.
- **Demonstratoren auf Folien** laden mit `?embed=1` (Kopfzeile, Fußzeile und Hinweise ausgeblendet) und ihren Startparametern in der Adresse, in `.embed.z125` oder `.z150`, damit die Bedienelemente auf der Leinwand lesbar sind. Die Folie trägt nur die kleine überschrift `try it: …`. **Nach dem Export einmal ins PDF sehen**: Lokale, schnell geladene Demonstratoren drucken mit; bleibt der Rahmen leer, hilft `--pdf-raster`.
- **Foto-Folien:** Eröffnung und Schluss als Symbolfoto rechts, Frage oder Satz links (`.photo` und `.photo-text`), Fußnote `image: ai-generated (<modell>)`. Pfeile in einen Kasten liegen auf dessen Mittelachse; Eingabe-Labels rechtsbündig vor dem Pfeil, Ausgabe-Labels linksbündig dahinter.
- Eine Aussage je Folie. Wenig Text; die Aussage steckt im Bild, der Rest in den Notizen.
- **Symbole aus Bootstrap Icons, wo ein Symbol etwas sagt.** Für kleine, eindeutige Zeichen (Kalender für einen Termin, Kreislauf für eine Schleife, Schloss für Sicherheit, Uhr für Zeit) gibt es Bootstrap Icons (https://icons.getbootstrap.com, MIT-Lizenz). `python <stagekit>/tools/icon.py --search <begriff>` findet passende Namen, `python <stagekit>/tools/icon.py <name>` gibt ein `<svg>` für das HTML aus, `--js` die Pfade für `d.icon(x, y, size, paths, {color})` in einer Zeichnung. Regeln: **dezent** — das Symbol begleitet eine Aussage, es trägt sie nicht; neben einer Überschrift so groß wie deren Schrift und in ihrer Farbe (Grau, etwa `display: flex; gap: 16px` in der `.header`-Zeile), in einer Zeichnung in `--gray` oder in der Bedeutungsfarbe des Elements, das es markiert (die Schleife gelb, wenn die Schleife gelb ist). **Sparsam** — eines je Folie, nie als Aufzählungszeichen, nie als Schmuck einer Folie ohne Aussage. Farbe nur aus dem Theme (`fill="currentColor"` mit `color: var(--gray)`), nie Hex. Der Kommentar mit Name, Version und Lizenz, den das Werkzeug mitliefert, bleibt im HTML bzw. in `deck.js` stehen. Ein Symbol ersetzt kein erzeugtes Foto: Stimmung und Szene kommen weiter aus `tools/image.py`, das Symbol ist das kleine Zeichen daneben (Regel vom 23.09.2026).
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
