# Changelog

Was sich an stagekit geändert hat, neueste Version oben. Je Eintrag: was sich
geändert hat und, wo nötig, **was bestehende Decks tun müssen**. Gepflegt im
selben Commit wie die Änderung (Regel in `SKILL.md`, Abschnitt „Änderungen an
stagekit selbst“).

Neue Einträge kommen unter **Unveröffentlicht**. `tools/release.py` macht
daraus eine Version: Es setzt die Nummer in `stagekit.js`, benennt den
Abschnitt um und legt das Tag an. Versionsnummern nach SemVer: Patch für
Korrekturen, Minor für Neues, das bestehende Decks nicht verändert, Major für
alles, was ein Deck anfassen muss.

## Unveröffentlicht

- Vier Signature-Layouts für Lehrbeispiele: `prediction`, `trace`, `readings` und `measurement`. Die Galerie zeigt alle vier Formen. Pfeiltasten, direkte Frame-Aufrufe und PDF nutzen dieselben Zwischenstände. Bestehende Decks brauchen keine Änderung.

## 0.14.0 (2026-11-25)

- **Design-Vorlagen und das Design der Hochschule Osnabrück.** Eine `style.toml` kann mit `[stagekit] preset = "hsos"` auf einer Vorlage aus `themes/` aufbauen und ändert darüber nur, was abweicht. Die erste Vorlage `themes/hsos.toml` hat einen hellen Grund, Roboto als Schrift und das Hochschullogo oben rechts auf jeder Folie außer Vollbildfoto und `compare` ohne Überschrift. Ein eigenes Logo geht mit `logo = "logo.svg"` (`logo = false` schaltet es ab); `theme.py` schreibt es als Daten-URI in die `theme.css`. Roboto liegt jetzt im Framework (`fonts/Roboto-Regular.woff`, `fonts/Roboto-Bold.woff`), `new_deck.py` kennt `--theme hsos`, und die Prüfung des Exports auf ungestylte Frames meldet ein Vollbildfoto nicht mehr fälschlich. Beispiel in `examples/hsos/`. Bestehende Decks ändern sich nicht; wer die Vorlage nutzen will, holt mit `tools/sync.py` die neuen Schriftdateien und erzeugt die `theme.css` neu.

## 0.13.0 (2026-11-20)

- **Signature-Layout `checklist`**: eine Liste mit Kästchen, für Regeln, Prüfpunkte oder Aufgaben. `data-checked` hakt einen Punkt von Anfang an ab, `data-check="N"` im Aufbauschritt N, ohne beides bleibt er offen. Ein Haken, der beim Weiterblättern dazukommt, wird gezeichnet; im Vortrag schaltet ein Klick auf einen Punkt den Haken um, ohne weiterzublättern. Druckansicht, PDF und Export zeigen je Schritt den Stand, `review.py` kennt das Layout und warnt ab neun Punkten. Beispiel im Teil „one list to check“ von `examples/layouts/layouts.html`. Bestehende Decks ändern sich nicht; `checklist` braucht einmal `tools/sync.py`.

## 0.12.0 (2026-11-19)

- **Signature-Layout `compare`**: zwei Bilder oder Zeichnungen derselben Ansicht übereinander, getrennt von einer Linie mit Griff. Die Linie steht je Aufbauschritt an einer festen Stelle (`data-stops`) und gleitet beim Weiterblättern dorthin, lässt sich im Vortrag mit der Maus ziehen und läuft mit `data-sweep` beim Erreichen der Folie (und mit R) einmal von selbst über das ganze Bild. Druckansicht, PDF und Export zeigen jede Stellung als Seite, `review.py` kennt das Layout und warnt, wenn eine Seite keine Beschriftung hat. Beispiel im Teil „one change“ von `examples/layouts/layouts.html`. Bestehende Decks ändern sich nicht; `compare` braucht einmal `tools/sync.py`.
- **Diagramme mit `d.chart()`**: Säulen und Zeilen aus Daten in den Farben und Größen des Themes, mit einem Zustand je Aufbauschritt. Zwischen den Zuständen wachsen Balken, treten hervor, bekommen eine Anmerkung, eine Reihe kommt dazu, die Achse zoomt mit gleitenden Gitterlinien, oder die Zeilen sortieren sich. Die Übergänge laufen über `anim.js`, das dafür den neuen Baustein `a.value()` mit `a.painter()` bekommt; Export, PDF und Sprünge zeigen die Zustände wie bei jeder Animation. Regel „Diagramme führen zu einer Aussage“ in `docs/design-rules.md`, Beispiel in `examples/charts/`. Bestehende Decks ändern sich nicht; `d.chart()` braucht einmal `tools/sync.py`.

## 0.11.0 (2026-11-19)

- **Signature-Layouts**: vier Folienklassen mit fester Form, `number` (eine Zahl in der neuen Anzeigegröße 200 px, die beim Weiterblättern hochzählt), `quote` (Zitat mit gesetztem Anführungszeichen), `fullbleed` (Foto über die ganze Folie mit Satz auf dunklem Band) und `timeline` (Ereignisse mit Datum, das zuletzt gezeigte gelb). Die Schriftprüfung lässt die Anzeigegröße nur für Zahl und Anführungszeichen zu, `review.py` kennt die Layouts und warnt bei einer Zahl oder einem Zitat ohne Quelle sowie bei demselben Signature-Layout zweimal hintereinander. Der Agent setzt sie selbst ein, wo eine Folie genau diese Form hat (Regel in `docs/design-rules.md`). Beispiel in `examples/layouts/layouts.html`. Bestehende Decks ändern sich nicht; die Layouts brauchen einmal `tools/sync.py`.

## 0.10.0 (2026-11-19)

- **Publikumsprobe** mit `tools/review.py <deck>.html --audience "…" --minutes N`: Das Werkzeug liest das Deck so, wie das Publikum es sieht, und schreibt die Geschichte in Kernsätzen (`story.md`), Kennzahlen mit Warnungen zu Textmenge, Notizen, Layoutfolgen, neuen Begriffen und Sprechzeit (`metrics.md`) sowie einen Auftrag für ein Probepublikum mit Kontaktbogen (`audience.md`, `sheet.png`). Mit `--ask` beantwortet ein Modell über die OpenAI-API diesen Auftrag selbst (`audience-report.md`), für Agenten, die keinen Hilfsagenten starten können. Der Skill macht die Probe zum Schritt vor dem Vorlegen. Bestehende Decks müssen nichts tun.

## 0.9.0 (2026-11-19)

- **Magic Move**: Elemente mit derselben Kennung `data-morph` auf zwei benachbarten Folien gleiten beim Weiterblättern an ihren neuen Platz, in HTML wie in Zeichnungen. Export, PDF und Sprünge bleiben statisch, `?morph=0` schaltet es ab. Beispiel im Teil „between slides“ des Demo-Decks. Bestehende Decks ändern sich nicht, solange sie kein `data-morph` tragen. Der Agent setzt Magic Move von sich aus ein, wo derselbe Gegenstand auf zwei aufeinanderfolgenden Folien vorkommt und die Beziehung zur Aussage gehört (Regel „Magic Move verbindet benachbarte Folien“ in `docs/design-rules.md`).

## 0.8.0 (2026-11-18)

- `d.closeup()` berechnet Kameraziel, Abdunklung, Rahmen und Beschriftung aus einem Zielrechteck. `d.anchor()` und `d.connect()` verbinden Kanten und liefern denselben Weg für Pakete in beiden Richtungen. Netzwerk- und Platinenbeispiel verwenden die neuen Helfer. Bestehende Decks können die Helfer nach `tools/sync.py` nutzen.
- `export.py --motion N` zeigt Anfang, Mitte und Ende des Animationsabschnitts zu Frame N in einem Bildstreifen und als Einzelbilder. Bei mehreren Animationen bleibt eine bereits abgeschlossene Figur beim Abtasten eines späteren Abschnitts in ihrem Endzustand.

- Vollständiger Export und Framevorschau melden sichtbaren Text außerhalb der Folie sowie Beschriftungen außerhalb ihres `d.box()`-Kastens, mit Framenummer, Kante und Abstand in Folienpixeln. `--overflow` führt die Prüfung allein aus. Für die Kastenprüfung brauchen Projekte mit eigener Framework-Kopie einmal `tools/sync.py`.

- Mit `export.py --frames N` prüft der Agent alle Aufbauschritte der Folie zu Frame N, mit `--frames N-M` genau den angegebenen Bereich. Vorschauen enthalten PNGs und einen kompakten Kontaktbogen mit den ursprünglichen Framenummern und liegen getrennt vom vollständigen Export.

- `tools/new_deck.py` legt einen spielbaren Satz mit Projekttheme, relativen Framework-Pfaden, Zeichnung, Notizen und Startskript an. Startskript und Export unterstützen auch Projektunterordner mit Leerzeichen und Umlauten. Vorhandene Decks erfordern keine Anpassung.

- Eine Animationsgalerie verbindet Lernziele mit Bildfolgen, spielbaren Beispielen und Code. Der erste Bubble-Sort-Durchlauf zeigt einen Vergleich ohne Tausch und drei mit Tausch. In der Detailansicht der Platine steuert ein gemeinsames Zielrechteck die Kamerafahrt und Markierung.

- Der Skill wählt die Dramaturgie neuer Decks nach dem Publikumsziel. Sechs kurze Strategien beschreiben Einstieg, Beleg, Aufdeckung und Schluss. Ein lauffähiges Beispiel zeigt Befund und Einschränkung am selben Diagramm. Bei punktuellen Änderungen beginnt die Arbeit am betroffenen Frame. Bestehende Decks müssen nichts anpassen.

## 0.7.2 (2026-11-16)

- **`d.ipo()` richtet Eingabe und Ausgabe mittig zum Pfeil aus:** Bisher
  standen sie (und `level`) ab einer festen Grundlinie, sodass zweizeilige
  Texte unter dem Pfeil hingen; jetzt sitzen sie wie der Text im Kasten
  mittig auf Höhe `y + 65` (gemeldet von Hands-on Computer Science).
  Einzeilige Zeilen verschieben sich um 0,2 px, also nicht sichtbar.
  *Decks:* nichts zu tun; wer eine IPO-Zeile wegen zweizeiliger Texte selbst
  zeichnet, kann nach `tools/sync.py` wieder `d.ipo()` nehmen.

## 0.7.1 (2026-11-15)

- **Decks werden direkt gebaut:** Der Ablauf in `SKILL.md` geht nach den
  Basisinfos gleich zum Bau; das gebaute Deck mit Kontaktbogen und PDF ist
  das Feedback-Material, Rückmeldungen nennen Frames und laufen direkt in
  HTML, `deck.js` und `skript.md`. Ein Markdown-Entwurf (`entwurf.md`)
  entsteht nur noch, wenn der Nutzer ihn ausdrücklich verlangt; sein Format
  bleibt dasselbe.
  *Decks:* nichts zu tun; betrifft nur, wie Agenten neue Sätze anlegen.

## 0.7.0 (2026-11-04)

- **Bewegung im Leerlauf für Animationen:** `a.idle(t, "flow" | "pulse" |
  "blink", o)` lässt ein Ziel weiterlaufen, solange die Zeichnung an einem
  Zwischenstand oder Haltepunkt wartet, etwa Strom, der durch eine Leitung
  fließt; `a.still(t)` beendet es, `a.set(t, { idle: "pulse" })` setzt es schon
  für den Zwischenstand 0. Die Bewegung läuft nur im Vortrag auf der gezeigten
  Folie und steht im Druck, im Export, im Selbsttest und bei „Bewegung
  reduzieren“ still (`flow` dann als gestrichelte Linie). Regel in
  `docs/design-rules.md`.
  *Decks:* nichts zu tun.

## 0.6.0 (2026-11-04)

- **Schriftprüfung sieht vergrößerte Gruppen:** `export.py --fonts` rechnet
  SVG-Text jetzt über seine Bildschirmmatrix um, also einschließlich jedes
  `scale()` einer umgebenden Gruppe. Bisher zählte nur die viewBox, und eine
  Beschriftung von 18 in `<g transform="scale(2)">` ging als 18 durch statt
  als 36.
  *Decks:* nichts zu tun; die Prüfung meldet solche Stellen jetzt.
- **`d.lamp` und `d.toggle` mit Schriftgröße:** `{size}` als fünftes
  Argument, damit eine vergrößert gezeichnete Schaltung eine der vier Größen
  trifft (bei `scale(2)` `{size: 16}` für 32). Ohne die Option bleibt alles
  wie bisher.
  *Decks:* nichts zu tun.

## 0.5.0 (2026-11-04)

- **Drittes Bewertungszeichen „Vorsicht“** (Vorschlag Hands-on Computer
  Science auf Anregung von Nicolas, 03.11.2026): `d.verdict(…, "caution")`
  zeichnet den Kasten gelb mit einem gelben Warndreieck an der Stelle von
  Haken und Kreuz, für eine Behauptung, die noch niemand geprüft hat;
  `d.mark(cx, cy, "caution")` zeichnet nur das Dreieck. Textlage wie bei den
  anderen Urteilen.
  *Decks:* nichts zu tun. Wer sich mit `verdict(…, null, {border: yellow})`
  plus `d.icon` beholfen hat, kann auf `"caution"` umstellen.
- **Tastenkappen für Tastenkürzel** (Vorschlag Hands-on Computer Science auf
  Anregung von Nicolas, 30.10.2026): `d.keys(x, cy, ["ctrl", "shift", "m"])`
  zeichnet Kappen mit grauem „+“ dazwischen, `d.keys.width(names)` liefert
  ihre Gesamtbreite; im Fließtext `<kbd>ctrl</kbd> + <kbd>c</kbd>` im selben
  Aussehen.
  *Decks:* nichts zu tun.

## 0.4.0 (2026-10-30)

- **Animationen rückwärts abspielen** (Nicolas, 30.10.2026): Mit
  `back: "play"` spielt ← den Abschnitt in doppeltem Tempo rückwärts bis
  zum vorigen Zwischenstand, auch aus einem laufenden Abschnitt heraus; ein
  zweites ← springt sofort. Ohne die Option springt ← wie bisher. Regel in
  `docs/design-rules.md`: nur für umkehrbare Abläufe wie Kamerafahrten, nie
  für Abläufe mit Richtung. Im Demo-Deck bei der Kamerafahrt.
  *Decks:* nichts zu tun.

## 0.3.0 (2026-10-30)

- **Selbsttest auf GitHub fest auf Ubuntu 26.04** statt `ubuntu-latest`, dem
  System, auf dem die Linux-Referenzbilder entstanden sind; ein anderes Abbild
  könnte Schriften anders zeichnen und den Bildvergleich ohne Grund rot
  machen. Die Actions laufen jetzt in Version 7 auf Node 24.
  *Decks:* nichts zu tun.

- **Mit Zahl und Enter zu einer Folie springen** (Nicolas, 30.10.2026), wie in
  Google Slides: „45“ und Enter geht zu Frame 45, „1“ und Enter an den Anfang.
  Die Zahl ist die des Zählers unten rechts (Frames, wie `#45`); während des
  Tippens zeigt der Zähler sie gelb an. Rücktaste löscht eine Ziffer, Escape,
  jede andere Taste oder drei Sekunden Pause verwerfen die Eingabe; eine Zahl
  über dem Ende führt zum letzten Frame. *Decks:* nichts zu tun; Projekte mit
  eigener Kopie bekommen es mit `tools/sync.py`.

## 0.2.0 (2026-10-29)

- **Animationen auf Folien (`anim.js`):** Eine Zeichnung kann in Abschnitten
  ablaufen: zeichnen, ein- und ausblenden, verschieben, entlang einer Leitung
  fahren, drehen, skalieren, umfärben, hochzählen, pulsieren, überblenden,
  Kamerafahrt über die viewBox. Jeder Abschnitt endet in einem Zwischenstand,
  der ein Aufbauschritt ist, also eine eigene Seite im PDF und ein Bild im
  Kontaktbogen. → spielt den nächsten Abschnitt (läuft er schon, springt er an
  sein Ende), ← springt zum vorigen Zwischenstand, **R** spielt die Animation
  der Folie von vorn. Haltepunkte (`hold()`) machen einen Abschnitt
  halbautomatisch, `auto: true` lässt Abschnitte von selbst aufeinander folgen.
  `draw.g(name, …)` benennt Teile einer Zeichnung, `draw.image()` setzt ein Bild
  hinein. Das Notizfenster zeigt den Stand der Animation.
  *Decks:* nichts zu tun; nur wer animiert, bindet `anim.js` zwischen `draw.js`
  und `deck.js` ein. `tools/sync.py` kopiert `anim.js` mit in die Projekte.
  *Projekte mit Website:* Ein `sync_decks.py`, das die Framework-Dateien für
  die Website kopiert, muss `anim.js` mitnehmen, sobald ein Deck animiert.
- **Regeln und Beispiel zu Animationen:** `docs/design-rules.md` regelt, wann
  ein Agent von sich aus animiert (nur Abläufe, jeder Zwischenstand für sich
  verständlich, höchstens rund drei Sekunden je Abschnitt, Zoom um 1,5 oder
  2,5, Text auf Fotos auf abgedunkeltem Grund); die Regel „keine Übergänge“
  gilt weiter für Folienwechsel und Text (Nicolas, 29.10.2026). API in
  `docs/api.md`, Symbol 🎞️ im Entwurf, Demo-Deck in `examples/animations/`
  (schrittweise, halbautomatisch, automatisch). *Decks:* nichts zu tun.
- **`export.py` zählt Frames im fertig aufgebauten Deck** statt im Quelltext,
  weil Animationen ihre Schritte erst zur Laufzeit anmelden; die
  Schrittprüfung schaltet mit `showFrame` statt `next` weiter.
  *Decks:* nichts zu tun.

- **Referenzframes für Linux** (`tests/reference/linux/`, erzeugt vom
  Workflow auf GitHub): Der Selbsttest vergleicht dort jetzt auch die Bilder.
  *Decks:* nichts zu tun.

## 0.1.0 (2026-10-29)

Die erste Version, **0.1.0**, umfasst auch alles unter „Vor den Versionen“.

- **Versionen:** `stagekit.js` trägt eine Versionsnummer (`window.stagekit.version`),
  `tools/release.py` macht aus diesem Abschnitt ein Release mit Tag, und ein
  Tag auf GitHub erzeugt dort das Release mit diesen Notizen. *Decks:* nichts zu tun.
- **`tools/sync.py` erneuert die Framework-Kopie eines Projekts:** kopiert die
  Laufzeitdateien samt Codeschrift und schreibt in jedes Deck, das diese Kopie
  lädt, die Cache-Kennung `?v=<version>-<prüfsumme>`; `--check` meldet nur.
  `export.py` weist darauf hin, wenn ein Deck eine abweichende Kopie lädt.
  *Projekte:* Kopien künftig damit erneuern statt von Hand; das
  `sync_framework.py` von LiFi wird damit entbehrlich.
- **Selbsttest:** `python tools/selftest.py` prüft die Syntax aller Dateien,
  `theme.py`, `sync.py`, `start_script.py` und `release.py`, exportiert das
  Testdeck `tests/deck/selftest.html` (jede Folienart, jeder Baustein) mit
  Schritt- und Schriftprüfung und vergleicht jeden Frame mit
  `tests/reference/<plattform>/`. Auf GitHub läuft er bei jedem Push.
  *Decks:* nichts zu tun.
- **Vorlage:** Die Beispielzeichnung in `template/deck.html` ist jetzt 1680
  breit; vorher kam ihre Beschriftung durch die Skalierung mit 90 px heraus,
  außerhalb der vier Größen. *Decks:* nichts zu tun.
- **`tools/figures.py`:** ungültige Escape-Sequenz im eingebetteten JavaScript
  behoben, die Python 3.14 schon anmahnt und eine spätere Fassung ablehnen
  wird. *Decks:* nichts zu tun.
- **`SKILL.md` aufgeteilt:** Sie behält Ablauf, Regeln in Kurzform und den Weg
  für Änderungen (47 KB auf 18 KB). Die Gestaltungsregeln stehen vollständig
  in `docs/design-rules.md` (vor dem Bau ganz lesen), Gerüst, Zeichen-API,
  Live-Abfragen und `style.toml`-Vorlage in `docs/api.md`, Player und
  Website-Abbildungen in `docs/website.md`. Am Inhalt der Regeln ändert sich
  nichts außer der Cache-Kennung, die jetzt `tools/sync.py` setzt.
  *Decks:* nichts zu tun.
- **Weg für Änderungswünsche:** Nur der stagekit-Agent ändert und committet im
  Repository; andere Agenten melden Wünsche in ihrer `STATUS.md` oder fragen
  die Sitzung `stagekit` (in `SKILL.md` und `CONTRIBUTING.md`).
  *Agenten:* nicht mehr selbst im Repository ändern.
- **README auf Englisch**, mit den neuen Werkzeugen. *Decks:* nichts zu tun.
- **`tools/image.py` liest den Schlüssel nur noch aus `OPENAI_API_KEY`**
  (Nicolas, 29.10.2026). Dateien wie `openai.key` im Projekt oder
  `~/.openai.key` werden nicht mehr gesucht. Ohne die Variable bricht das
  Werkzeug ab, mit einer Meldung, die sagt, wie man sie setzt.
  *Projekte:* eine Schlüsseldatei, die noch irgendwo liegt, wird nicht mehr
  gebraucht und kann nach Rücksprache weg.

## Vor den Versionen

Bis zum 29.10.2026 nach Datum gegliedert. Die Einträge bis zum 30.09.2026 sind
am 01.10.2026 aus der Git-Historie nachgetragen.

### 2026-10-29

- **Beschreibbare Felder behalten ihre Tasten:** In einem Element mit
  `contenteditable` blättern Leertaste und Pfeile nicht mehr weiter, und N, F,
  P und M schalten nichts mehr um; ein Klick hinein blättert auch am Rand nicht.
  Bisher galt das nur für `input` und `textarea` (Befund LiFi vom 25.09.2026,
  Deck `protocols`). *Decks:* nichts zu tun.

### 2026-10-08

- **Regel: keine Zeitbezüge in Decks** in `SKILL.md` (Gestaltungsregeln): kein
  „next week“, „this semester“, kein Datum und kein Verweis auf vorige oder
  folgende Sitzungen in Folien, Notizen und Skripten, damit ein Deck an jeder
  Stelle jedes Plans läuft (Nicolas, 07.10.2026, für alle Lehrdecks).
  *Decks:* bei der nächsten Änderung auf Zeitbezüge durchsehen.

### 2026-10-06

- **Untertitel auf Trennfolien:** `<section class="slide part" data-part="…" data-subtitle="…">`
  setzt unter den Teilnamen eine graue Zeile in der Größe des Untertitels der
  Titelfolie (`.part-sub`). *Decks:* nichts zu tun; ohne `data-subtitle` bleibt
  die Trennfolie, wie sie war.

### 2026-10-05

- **Regel gegen übergelaufenen Text** in `SKILL.md` (Gestaltungsregeln): Breiten
  von Kästen, Spalten, Abfrageantworten und Fototext werden vor dem Bau
  gerechnet, mit konkreten Grenzwerten (Zeichen × Größe × 0,6; `verdict` mit
  zwei Zeilen mindestens 164 hoch; Abfrageantworten bis rund 26 Zeichen; Fotos
  für Text links auf 64 % Höhe; Kästen und Linien um die halbe Strichbreite vom Rand der Zeichenfläche einrücken, sonst schneidet die viewBox den Rahmen ab). Anlass: fünf Überläufe in einem Satz, die
  weder Schritt- noch Schriftprüfung finden. *Decks:* nichts zu tun; bestehende
  Sätze bei der nächsten Änderung gegen die Regel ansehen.

### 2026-10-01

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

### 2026-09-30

- **Taste M** schaltet den Mauszeiger durch: normal, Laserpointer, ganz
  ausgeblendet; mit gedrückter Maustaste zieht der Laserpointer eine
  verblassende Spur statt Text zu markieren. *Decks:* Framework-Dateien
  neu kopieren.
- **Druckansicht:** `figcode` wird im Druck ausgeblendet, Folien werden
  beschnitten.

### 2026-09-29

- **Code-Folien:** Hervorhebung des Neuen mit `.hl`; Abbildungen aus Code
  tragen den Code unsichtbar (`.figcode`) mit Kopierknopf und Augensymbol
  („show code“), das ihn als Fenster über die Folie legt.
- **Punchline** verschiebt den Inhalt nicht mehr (`has-punch` kürzt oben und
  unten gleich).
- **Adressen auf Folien** sind Links, Hover unterstreicht.
- **Live-Abfragen:** `data-live-module` ordnet Sitzungen dem jüngsten Kurs
  eines Moduls zu; Referenzserver ist `classroom-live`.
- **SKILL:** R-Code auf Folien, nach jeder Pipe eine neue Zeile.

### 2026-09-28

- **Live-Abfragen als Baustein:** `.slide.poll` mit QR-Code, Sitzungscode,
  Live-Zeichen und Ergebnisbalken.
- **Kopierknopf an jedem Codeblock** (Symbol statt Text), Regel im SKILL.
- **export.py:** abgewiesene Verbindungen behoben (große Warteschlange),
  ungestylte Frames werden erkannt und nachgeholt.

### 2026-09-24

- **Deck-Dateien heißen nach dem Titel** statt `index.html`; das PDF
  übernimmt den Namen.

### 2026-09-23

- **Bootstrap Icons:** `tools/icon.py`, `draw.icon()` und Regel im SKILL.

### 2026-09-16

- **image.py** auf GPT Image 2.5 umgestellt: `flare` als Standard,
  `sunburst` wahlweise.

### 2026-09-15

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

### 2026-09-14

- **Roboto Mono liegt im Framework** (`fonts/`, `@font-face`); `theme.py`
  ohne Google-Import.
- **Sprache des Satzes** in der `style.toml`; alles auf den Folien folgt ihr,
  Kleinschreibung nur bei Englisch.
- **draw.ipo** (das IPO-Modell als festes Element) und **draw.highlight**.
- **export.py:** schwarze Frames aus dem parallelen Aufnehmen werden einzeln
  nachgeholt.

### 2026-09-13

- **export.py:** Frames, Schritt- und Schriftprüfung parallel.
- **figures.py** misst jede Abbildung (Abgeschnittenes, Leerraum); Regel zum
  Innenabstand in Kästen.

### 2026-09-08 bis 2026-09-11

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
