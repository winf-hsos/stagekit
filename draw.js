/* stagekit.draw: SVG drawings for slides, in the theme's colours.
 *
 * Every helper returns an SVG string; assemble them inside svg(w, h, ...)
 * and put the result into a <div class="figure">. Coordinates are in the
 * drawing's own units (the viewBox), so a drawing scales with the slide.
 *
 *   svg(w, h, ...parts)               the frame
 *   box(x, y, w, h, text, opts)       rounded box with centred text
 *   verdict(x, y, w, h, text, ok, opts)  box framed green with a check, or red with a cross, centred at its bottom;
 *                                     ok "caution": yellow with a warning sign (a claim not checked yet);
 *                                     ok null keeps the same layout without a mark (no verdict yet)
 *   mark(cx, cy, ok, opts)           just the check, cross or warning sign, same size everywhere
 *   keys(x, cy, names, opts)         keycaps for a shortcut, "+" between them; keys.width(names) is their width
 *   icon(x, y, size, paths, opts)    a Bootstrap Icons symbol (paths from tools/icon.py --js); opts: color
 *   formula(x, y, text, opts)         a set formula: _ subscript, ^ superscript, {} groups
 *   label(x, y, text, opts)           text; opts: size, color, anchor, mono, keepCase,
 *                                     centerY (mittig zu dieser Hoehe statt Grundlinie y)
 *   layers(...groups)                 concatenates groups so wires come first: layers(wires, gates, labels)
 *   line(x1, y1, x2, y2, opts)        opts: color, width, dashed
 *   arrow(x1, y1, x2, y2, opts)       line with a filled triangle head
 *   wire(pts, on)                     polyline, lit (yellow) or not (gray)
 *   dot(x, y, on)                     junction
 *   gate(type, x, y, on)              and/or/xor/not/nand/nor/xnor, 56 x 40, no label
 *   lamp(x, y, on, text, opts)        output lamp with a caption below; opts: size (default 16)
 *   toggle(x, y, on, text, opts)      a switch symbol (static on slides); opts: size (default 18)
 *   truthTable(inputs, outputs, rows, now)   an HTML table (not SVG)
 *   table(x, y, headers, rows, opts)  an SVG table for figures; opts: cw, rh, size, hl
 *   chart(spec)                       bars from data, with states per build-up step (see "charts")
 *
 * ?theme=<name> in the page address selects a palette block of theme.css
 * (:root[data-theme="<name>"]); tools/figures.py renders figures that way.
 *
 * Colours are read from the theme at call time, so a deck with a different
 * theme gets different drawings without touching this file. */

(function () {
  "use strict";

  // ?theme=light (or any name) selects a palette block of theme.css before anything is drawn
  const themeParam = new URLSearchParams(location.search).get("theme");
  if (themeParam) document.documentElement.dataset.theme = themeParam;

  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const C = () => ({ bg: css("--bg"), white: css("--white"), light: css("--gray-light"), gray: css("--gray"),
                     dark: css("--gray-dark"), blue: css("--blue"), green: css("--green"), yellow: css("--yellow"), red: css("--red"),
                     font: css("--font"), mono: css("--mono") });

  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

  /* z-order: pass wires first, then gates, then labels; each group is an array */
  const layers = (...groups) => groups.flat();

  function svg(w, h, ...parts) {
    // only a viewBox: the drawing fills its .figure and scales with the slide
    return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">${parts.join("")}</svg>`;
  }

  function label(x, y, text, o = {}) {
    const c = C();
    const lines = String(text).split("\n");
    const size = o.size || 32, lh = o.lineHeight || 1.3;   // erlaubt: 20, 32, 48, 80 (tiny, small, normal, large)
    const fill = o.color || c.white;
    const family = (o.mono ? c.mono : c.font).replace(/"/g, "'");   // Anfuehrungszeichen im Attribut vermeiden
    const anchor = o.anchor || "start";
    // centerY: die Beschriftung sitzt mittig zu dieser Hoehe, auch mehrzeilig.
    // So richtet man Labels an dem Kasten aus, zu dem sie gehoeren.
    const y0 = o.centerY === undefined ? y
      : o.centerY + size * 0.35 - (lines.length - 1) * size * lh / 2;
    return `<text x="${x}" y="${y0}" text-anchor="${anchor}" font-family="${family}" font-size="${size}" fill="${fill}"${o.weight ? ` font-weight="${o.weight}"` : ""}${o.keepCase ? ' class="keep-case"' : ""}>` +
      lines.map((l, i) => `<tspan x="${x}" dy="${i ? size * lh : 0}">${esc(l) || "&#160;"}</tspan>`).join("") + `</text>`;
  }

  function box(x, y, w, h, text, o = {}) {
    const c = C();
    const border = o.border === null ? "none" : (o.border || c.white);
    // Standardfuellung ist der Hintergrund, nicht "none": So deckt der Kasten
    // die Leitung ab, die in ihn hineinfuehrt, statt sie auf seinem Rand liegen
    // zu lassen. Kaesten werden deshalb immer NACH den Leitungen gezeichnet
    // (layers(wires, boxes, labels)). Fuer einen wirklich transparenten Kasten
    // ausdruecklich fill: "none" setzen.
    const fill = o.fill || c.bg;
    const owner = text ? ' data-sk-box-label=""' : "";
    let s = `<rect${owner} x="${x}" y="${y}" width="${w}" height="${h}" rx="${o.rounded === false ? 0 : (o.rx || 8)}" fill="${fill}" stroke="${border}" stroke-width="${o.width || 2}"${o.dashed ? ' stroke-dasharray="8 6"' : ""}/>`;
    if (text) {
      // multi-line text is centred as a block: start above the middle by half the extra lines
      const size = o.size || 32, lh = o.lineHeight || 1.3, n = String(text).split("\n").length;
      s += label(x + w / 2, y + h / 2 + size * 0.35 - (n - 1) * size * lh / 2, text, { ...o, anchor: "middle", color: o.color || c.white });
    }
    return s;
  }

  /* Hervorhebung einer Textstelle: ein durchscheinender Kasten in einer
   * Bedeutungsfarbe ueber die ganze Stelle, nicht je Zeichen. Die Hoehe kommt
   * aus der Schriftgroesse, der Rand ist oben und unten gleich (0.2 em); die
   * Stelle bleibt lesbar, weil der Kasten nur gefuellt ist, ohne Rand. x und w
   * sind die Ausdehnung des Textes, centerY seine Mitte wie bei label(). */
  function highlight(x, w, centerY, size, o = {}) {
    const c = C();
    const col = o.color || c.yellow;
    const h = size * 1.4, pad = o.pad === undefined ? size * 0.15 : o.pad;
    return `<rect x="${x - pad}" y="${centerY - h / 2}" width="${w + 2 * pad}" height="${h}" rx="${o.rx === undefined ? 4 : o.rx}" ` +
      `fill="${col}" fill-opacity="${o.opacity === undefined ? 0.2 : o.opacity}"/>`;
  }

  /* Das IPO-Modell als Zeile: Eingabe, Pfeil, Kasten mit der Verarbeitung,
   * Pfeil, Ausgabe. Dieselbe Geometrie wie in Deck 03 (Input, Processing,
   * Output), damit das Modell auf jeder Folie gleich aussieht, wo ein Konzept
   * Daten verarbeitet: Kompression, Verschluesselung, Filter, Pruefsumme.
   * y ist die Oberkante der 130 px hohen Zeile; `level` steht klein links davor;
   * `active: false` zeichnet die Zeile zurueckgenommen. Eingabe, Ausgabe und
   * `level` sitzen mittig zum Pfeil (y + 65), auch zweizeilig. */
  function ipo(y, input, processing, output, o = {}) {
    const c = C();
    const col = o.active === false ? c.dark : (o.color || c.light);
    const x = o.x || 0;
    const parts = [];
    if (o.level) parts.push(label(x + 60, 0, o.level, { centerY: y + 65, size: 32, color: o.active === false ? c.dark : c.gray }));
    parts.push(label(x + 300, 0, input, { centerY: y + 65, size: 32, color: col, anchor: "middle", mono: !!o.monoIn }));
    parts.push(arrow(x + 440, y + 65, x + 565, y + 65, { color: col, width: 3, head: 16 }));
    parts.push(box(x + 580, y, 500, 130, processing, { border: col, color: col, size: 32, mono: !!o.monoBox, keepCase: !!o.keepCase, width: 3, rx: 10 }));
    parts.push(arrow(x + 1095, y + 65, x + 1220, y + 65, { color: col, width: 3, head: 16 }));
    parts.push(label(x + 1380, 0, output, { centerY: y + 65, size: 32, color: col, anchor: "middle", mono: !!o.monoOut }));
    return parts.join("");
  }

  /* Bewertungszeichen: Der Kasten, der die bessere Loesung zeigt, bekommt einen
   * gruenen Rahmen und mittig an seinem unteren Rand einen kleinen gruenen
   * Haken; das Gegenstueck bekommt Rahmen und Kreuz in Rot, in derselben
   * Groesse und an derselben Stelle. Immer ueber verdict() zeichnen, nie von
   * Hand, damit das Zeichen auf jeder Folie gleich aussieht und gleich sitzt. */
  function mark(cx, cy, ok, o = {}) {
    const c = C();
    if (ok === "caution") {
      // Warndreieck statt Haken: die Aussage ist noch nicht geprueft. Etwas
      // groesser als Haken und Kreuz, weil das Dreieck seine Flaeche nicht fuellt.
      const size = o.size ? o.size * 40 / 34 : 40;
      return icon(cx - size / 2, cy - size / 2, size, WARNING, { color: o.color || c.yellow });
    }
    const col = o.color || (ok ? c.green : c.red);
    const r = (o.size || 34) / 2;
    const w = o.width || 7;
    const stil = `fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;
    if (ok) return `<path d="M${cx - r},${cy + r * 0.1} l${r * 0.6},${r * 0.68} l${r * 1.4},${-r * 1.46}" ${stil}/>`;
    const a = r * 0.72;
    return `<path d="M${cx - a},${cy - a} L${cx + a},${cy + a} M${cx + a},${cy - a} L${cx - a},${cy + a}" ${stil}/>`;
  }

  // Bootstrap Icons "exclamation-triangle-fill" 1.11.3 (MIT, (c) The Bootstrap Authors)
  const WARNING = '<path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5m.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2"/>';

  /* Symbol aus Bootstrap Icons in einer Zeichnung. `paths` sind die inneren
   * Pfade eines Symbols (viewBox 16 x 16), wie `python tools/icon.py <name> --js`
   * sie ausgibt; x, y ist die linke obere Ecke, size die Kantenlaenge in
   * Zeichnungseinheiten. Farbe nur aus dem Theme, Standard ist Grau: ein Symbol
   * begleitet eine Aussage, es traegt sie nicht. */
  function icon(x, y, size, paths, o = {}) {
    const c = C();
    return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 16 16" fill="${o.color || c.gray}">${paths}</svg>`;
  }

  function verdict(x, y, w, h, text, ok, o = {}) {
    const c = C();
    // Rahmen und Zeichen tragen immer die Bewertungsfarbe; o.color faerbt nur
    // den Text im Kasten, o.size ist seine Schriftgroesse. Das Zeichen behaelt
    // seine eigene Groesse, damit es auf jeder Folie gleich aussieht.
    // ok === null: noch kein Urteil. Gleicher Kasten, gleiche Textlage, kein
    // Zeichen; so springt nichts, wenn das Urteil erst spaeter erscheint.
    // ok === "caution": eine Behauptung, die noch niemand geprueft hat; gelb,
    // mit Warndreieck an der Stelle des Hakens.
    const col = ok === null || ok === undefined ? (o.border || c.light)
      : ok === "caution" ? c.yellow : (ok ? c.green : c.red);
    const inset = o.inset || 44;
    // Der Text sitzt mittig ueber dem Zeichen, nicht mittig im Kasten: sonst
    // rueckt eine lange Aussage dem Haken auf den Leib.
    const size = o.size || 32, lh = o.lineHeight || 1.3;
    const n = String(text || "").split("\n").length;
    let s = box(x, y, w, h, "", { ...o, border: col });
    if (text) s += label(x + w / 2, y + (h - inset) / 2 + size * 0.35 - (n - 1) * size * lh / 2, text,
                         { ...o, anchor: "middle", color: o.color || c.white });
    if (ok === null || ok === undefined) return s;
    return s + mark(x + w / 2, y + h - inset, ok, { size: o.markSize });
  }

  /* Tastenkappen fuer ein Tastenkuerzel: keys(x, cy, ["ctrl", "shift", "m"]).
   * x ist die linke Kante der ersten Kappe, cy die Mitte der Zeile. Jede Kappe
   * ist dunkel mit grauem Rand und einer grauen Kante 6 darunter, die Taste in
   * der Codeschrift 32 (19,2 je Zeichen) plus 36, 56 hoch; dazwischen ein graues
   * "+" in 48 Abstand. keys.width(names) liefert die Gesamtbreite, damit die
   * Erklaerung dahinter ohne Raten sitzt. Ein einzelner Name geht auch als Text. */
  const KEY_GAP = 48;
  const keyWidth = (name) => Math.round(String(name).length * 19.2 + 36);
  function keys(x, cy, names, o = {}) {
    const c = C();
    const parts = [];
    let at = x;
    [].concat(names).forEach((name, i) => {
      if (i) {
        parts.push(label(at + KEY_GAP / 2, 0, "+", { size: 32, color: c.gray, anchor: "middle", centerY: cy }));
        at += KEY_GAP;
      }
      const w = keyWidth(name), y = cy - 28;
      parts.push(`<rect x="${at}" y="${y + 6}" width="${w}" height="56" rx="8" fill="${c.gray}"/>` +
        `<rect x="${at}" y="${y}" width="${w}" height="56" rx="8" fill="${c.dark}" stroke="${c.gray}" stroke-width="2"/>` +
        label(at + w / 2, 0, name, { size: 32, mono: true, anchor: "middle", centerY: cy, keepCase: true, color: o.color || c.white }));
      at += w;
    });
    return parts.join("");
  }
  keys.width = (names) => [].concat(names).reduce((sum, n, i) => sum + keyWidth(n) + (i ? KEY_GAP : 0), 0);

  /* Formelsatz. Die Projektregel verlangt gesetzte Formeln statt getippter
   * ("log2(x)" ist keine Formel). Notation: `_` stellt tief, `^` hoch, und
   * geschweifte Klammern fassen zusammen: "H_{before} = log_2(N)".
   * Tief- und Hochgestelltes nimmt die naechstkleinere der vier erlaubten
   * Groessen, damit die Schriftpruefung des Exports nichts zu melden hat. */
  const GROESSEN = [20, 32, 48, 80];

  function formula(x, y, text, o = {}) {
    const c = C();
    const size = o.size || 48;
    const klein = GROESSEN[Math.max(0, GROESSEN.indexOf(size) - 1)] || 20;
    const fill = o.color || c.white;
    const family = c.mono.replace(/"/g, "'");

    const teile = [];
    let i = 0;
    while (i < text.length) {
      const z = text[i];
      if (z === "_" || z === "^") {
        let inhalt;
        if (text[i + 1] === "{") {
          const ende = text.indexOf("}", i + 2);
          inhalt = text.slice(i + 2, ende);
          i = ende + 1;
        } else {
          inhalt = text[i + 1];
          i += 2;
        }
        teile.push({ art: z, text: inhalt });
      } else {
        let ende = i;
        while (ende < text.length && text[ende] !== "_" && text[ende] !== "^") ende += 1;
        teile.push({ art: "", text: text.slice(i, ende) });
        i = ende;
      }
    }

    // centerY wie bei label(): die Formel sitzt mittig zu dieser Hoehe
    const yBasis = o.centerY === undefined ? y : o.centerY + size * 0.35;

    let dy = 0;
    const spans = teile.map((t) => {
      const ziel = t.art === "_" ? size * 0.24 : t.art === "^" ? -size * 0.42 : 0;
      const schritt = ziel - dy;
      dy = ziel;
      const gr = t.art ? klein : size;
      return `<tspan dy="${schritt.toFixed(1)}" font-size="${gr}">${esc(t.text)}</tspan>`;
    }).join("");

    // Formeln behalten ihre Schreibweise: N ist nicht n, und die
    // Kleinschreibungsregel der Folien gilt fuer Folientext, nicht fuer Mathematik
    return `<text x="${x}" y="${yBasis}" text-anchor="${o.anchor || "start"}" font-family="${family}" ` +
      `font-size="${size}" fill="${fill}" class="keep-case">${spans}</text>`;
  }

  function line(x1, y1, x2, y2, o = {}) {
    const c = C();
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${o.color || c.white}" stroke-width="${o.width || 2}"${o.dashed ? ' stroke-dasharray="8 6"' : ""}/>`;
  }

  // Midpoints of rectangle edges in the coordinate system of the drawing.
  function anchor({ x, y, width, height }, side) {
    switch (side) {
      case "left": return { x, y: y + height / 2, side };
      case "right": return { x: x + width, y: y + height / 2, side };
      case "top": return { x: x + width / 2, y, side };
      case "bottom": return { x: x + width / 2, y: y + height, side };
      default: throw new Error("anchor: expected left, right, top or bottom");
    }
  }

  function connect(from, to, o = {}) {
    const dx = to.x - from.x, dy = to.y - from.y;
    const outward = { right: dx, left: -dx, bottom: dy, top: -dy };
    if (!(outward[from.side] > 0 && outward[to.side] < 0)) {
      throw new Error("connect: choose edges facing the straight connection");
    }
    return line(from.x, from.y, to.x, to.y, o)
      .replace("<line ", `<line data-sk-from="${from.side}" data-sk-to="${to.side}" `);
  }

  // The camera and its three overlays share figure coordinates. Prefer a
  // side label; fall back to a centred caption above or below the detail.
  function closeup(w, h, target, caption, { zoom = 2.5 } = {}) {
    const { x, y, width, height } = target;
    if (!(width > 0 && height > 0 && x >= 0 && y >= 0 && x + width <= w && y + height <= h)) {
      throw new Error("closeup: the target rectangle must be inside the figure");
    }
    if (![1, 1.5, 2.5].includes(zoom)) throw new Error("closeup: expected zoom 1, 1.5 or 2.5");
    const colors = C(), size = 32, pad = 10;
    const ctx = document.createElement("canvas").getContext("2d");
    ctx.font = size + "px " + colors.font;
    const lines = String(caption).split("\n");
    const labelW = Math.ceil(Math.max(...lines.map(s => ctx.measureText(s).width))) + 2 * pad;
    const labelH = lines.length * size * 1.3 + 2 * pad;
    const cx = x + width / 2, cy = y + height / 2;
    for (const k of [2.5, 1.5, 1].filter(k => k <= zoom)) {
      const vw = w / k, vh = h / k;
      if (width > vw || height > vh || labelW > vw || labelH > vh) continue;
      const left = Math.max(0, Math.min(cx - vw / 2, w - vw));
      const top = Math.max(0, Math.min(cy - vh / 2, h - vh));
      const labelX = Math.max(left, Math.min(cx - labelW / 2, left + vw - labelW));
      const labelY = Math.max(top, Math.min(cy - labelH / 2, top + vh - labelH));
      const positions = [[x - labelW - pad, labelY], [x + width + pad, labelY],
        [labelX, y - labelH - pad], [labelX, y + height + pad]];
      const position = positions.find(([px, py]) => px >= left && py >= top &&
        px + labelW <= left + vw && py + labelH <= top + vh);
      if (!position) continue;
      const [px, py] = position;
      return {
        view: [left, top, vw, vh],
        shade: `<path fill="black" opacity=".7" fill-rule="evenodd" d="M0 0H${w}V${h}H0Z M${x} ${y}h${width}v${height}h${-width}Z"/>`,
        outline: box(x, y, width, height, "", { border: colors.yellow, fill: "none" }),
        caption: box(px, py, labelW, labelH, caption, { size, border: null, keepCase: true }),
      };
    }
    throw new Error("closeup: leave space beside the target for the caption or break it into shorter lines");
  }

  function arrow(x1, y1, x2, y2, o = {}) {
    const c = C();
    const col = o.color || c.white, w = o.width || 2, head = o.head || 14;
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
    const bx = x2 - ux * head, by = y2 - uy * head;
    const px = -uy * head * 0.45, py = ux * head * 0.45;
    return `<line x1="${x1}" y1="${y1}" x2="${bx}" y2="${by}" stroke="${col}" stroke-width="${w}"/>` +
           `<polygon points="${x2},${y2} ${bx + px},${by + py} ${bx - px},${by - py}" fill="${col}"/>`;
  }

  function wire(pts, on) {
    const c = C();
    const d = pts.map((p, i) => (i ? "L" : "M") + p[0] + "," + p[1]).join(" ");
    return `<path d="${d}" fill="none" stroke="${on ? c.yellow : c.dark}" stroke-width="${on ? 4 : 2.5}" stroke-linejoin="round"/>`;
  }
  const dot = (x, y, on) => { const c = C(); return `<circle cx="${x}" cy="${y}" r="5" fill="${on ? c.yellow : c.dark}"/>`; };

  /* gates: 56 x 40 at (x, y); inputs at y+10 and y+30 (not: y+20), output at x+56, y+20 */
  function gate(type, x, y, on) {
    const c = C();
    const stroke = on ? c.yellow : c.light, sw = 3, fill = c.bg;
    let b = "";
    if (type === "and" || type === "nand") {
      b = `<path d="M${x},${y} h28 a20,20 0 0 1 0,40 h-28 z" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
    } else if (type === "or" || type === "nor" || type === "xor" || type === "xnor") {
      const x2 = type === "xor" || type === "xnor";
      b = `<path d="M${x + (x2 ? 6 : 0)},${y} q14,20 0,40 q30,0 46,-20 q-16,-20 -46,-20 z" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
      if (x2) b += `<path d="M${x},${y} q14,20 0,40" fill="none" stroke="${stroke}" stroke-width="${sw}"/>`;
    } else if (type === "not") {
      b = `<path d="M${x},${y} l40,20 l-40,20 z" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
    }
    if (type === "nand" || type === "nor" || type === "xnor" || type === "not") {
      const bx = type === "not" ? x + 44 : type === "xnor" ? x + 57 : x + 52;
      b += `<circle cx="${bx}" cy="${y + 20}" r="4" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
    }
    return b;
  }

  /* lamp() und toggle() sind fuer Schaltungen gebaut, die vergroessert in eine
   * Zeichnung kommen (<g transform="scale(2)">). Die Beschriftung muss dann so
   * klein sein, dass sie nach dem Vergroessern eine der vier Groessen trifft:
   * bei scale(2) { size: 16 } fuer 32. Die Standardwerte 16 und 18 sind alt und
   * bleiben, damit bestehende Zeichnungen nicht springen. */
  function lamp(x, y, on, text, o = {}) {
    const c = C();
    const size = o.size || 16;
    return `<circle cx="${x}" cy="${y}" r="13" fill="${on ? c.yellow : c.bg}" stroke="${on ? c.yellow : c.light}" stroke-width="3"/>` +
      (on ? `<circle cx="${x}" cy="${y}" r="21" fill="${c.yellow}" opacity="0.18"/>` : "") +
      (text ? label(x, y + 20 + size, text, { size, color: c.gray, anchor: "middle", mono: true }) : "");
  }

  function toggle(x, y, on, text, o = {}) {
    const c = C();
    const size = o.size || 18;
    return (text ? label(x - 28, y + Math.round(size * 0.35), text, { size, color: c.light, anchor: "end", mono: true }) : "") +
      `<rect x="${x - 20}" y="${y - 10}" width="40" height="20" rx="10" fill="${on ? c.yellow : c.bg}" stroke="${on ? c.yellow : c.light}" stroke-width="2"/>` +
      `<circle cx="${on ? x + 10 : x - 10}" cy="${y}" r="7" fill="${on ? c.bg : c.light}"/>`;
  }

  function truthTable(inputs, outputs, rows, now) {
    let h = `<table class="tt"><tr>${inputs.map((x) => `<th>${esc(x)}</th>`).join("")}${outputs.map((x) => `<th>${esc(x)}</th>`).join("")}</tr>`;
    rows.forEach((r, i) => {
      h += `<tr${now === i ? ' class="now"' : ""}>${[...r.in, ...r.out].map((v) => `<td class="${v ? "on" : ""}">${v}</td>`).join("")}</tr>`;
    });
    return h + "</table>";
  }

  /* an SVG table for figures (the HTML truthTable is for slides): headers gray,
   * values in the code font, ones in the accent colour, one column optionally
   * highlighted; opts: cw (column width), rh (row height), size, hl (column index) */
  function table(x, y, headers, rows, o = {}) {
    const c = C();
    const cw = o.cw || 90, rh = o.rh || 54, size = o.size || 32;
    let s = "";
    if (o.hl !== undefined) s += `<rect x="${x + o.hl * cw}" y="${y}" width="${cw}" height="${rh * (rows.length + 1)}" rx="6" fill="${c.dark}" opacity="0.35"/>`;
    headers.forEach((h, j) => { s += label(x + j * cw + cw / 2, y + rh * 0.68, h, { size, color: o.hl === j ? c.yellow : c.gray, anchor: "middle", mono: true }); });
    s += line(x, y + rh, x + cw * headers.length, y + rh, { color: c.dark, width: 2 });
    rows.forEach((r, i) => r.forEach((v, j) => {
      s += label(x + j * cw + cw / 2, y + rh * (i + 1) + rh * 0.68, String(v), { size, color: Number(v) === 1 ? c.yellow : c.light, anchor: "middle", mono: true });
    }));
    return s;
  }
  table.width = (n, cw = 90) => n * cw;

  /* --- charts -----------------------------------------------------------------------
   * chart(spec) draws bars from data in the deck's colours and sizes, and moves
   * between states: one state per build-up step, each saying what is shown,
   * what stands out and which part of the axis is in view. A state only names
   * what changes; everything else carries over from the state before.
   *
   *   const c = d.chart({ type: "bar", width: 1680, height: 620,
   *     labels: ["21/22", "22/23", "23/24"], unit: " %",
   *     series: [{ name: "ours", values: [31, 28, 10] }, { name: "all", values: [30, 30, 22] }],
   *     states: [{ show: ["ours"] }, { highlight: ["23/24"] }, { show: ["ours", "all"] }, { zoom: [0, 15] }] });
   *   el("fig").innerHTML = d.svg(1680, 620, c.svg());   // state 0
   *   c.steps("fig");                                    // with anim.js: state k is build-up step k
   *
   * spec: type "bar" (columns) or "hbar" (rows, for long labels and rankings),
   * x, y, width, height (the area in drawing units), labels, series (or values
   * for a single series), min (default 0), max (default: a round number above
   * the largest value), unit (appended to value labels), decimals, pad
   * ({ left, right, top, bottom } to override the margins), accent (a colour
   * name; default: the colour of the part), morph (a prefix: every bar gets
   * data-morph="<prefix>-<label>" for magic move to the next slide).
   *
   * state: show (series names), highlight (labels whose bars take the accent),
   * focus (a series in the accent), values ("all", "highlight", "none"),
   * zoom ([min, max] of the value axis), sort ("desc", "asc" or null),
   * note ({ at: label, text } above that bar, or null).
   * Colours follow the rule "one colour for the message, the rest grey". */
  let charts = 0;
  const numberFormat = (decimals) => new Intl.NumberFormat(document.documentElement.lang || "en", { maximumFractionDigits: decimals, minimumFractionDigits: 0 });
  function niceTicks(lo, hi, n = 4) {
    const raw = (hi - lo) / n, p = Math.pow(10, Math.floor(Math.log10(raw || 1)));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= raw) || 10 * p;
    const out = [];
    for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + step * 1e-6; v += step) out.push(+v.toFixed(10));
    return { ticks: out, step };
  }
  const paintCtx = () => paintCtx.c || (paintCtx.c = document.createElement("canvas").getContext("2d"));
  function rgbOf(col) {
    const ctx = paintCtx();
    ctx.fillStyle = "#000"; ctx.fillStyle = col || "#000";
    const h = ctx.fillStyle;
    return h[0] === "#" ? [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) : h.match(/[\d.]+/g).slice(0, 3).map(Number);
  }
  const mixRgb = (a, b, p) => { const x = rgbOf(a), y = rgbOf(b); return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * p)).join(",")})`; };
  const textWidth = (s, size) => String(s).length * size * 0.55;

  function chart(spec) {
    const id = spec.id || "chart" + (++charts);
    const horizontal = spec.type === "hbar";
    const X = spec.x || 0, Y = spec.y || 0, W = spec.width || 1680, H = spec.height || 600;
    const labels = spec.labels || [];
    const series = spec.series || [{ name: "", values: spec.values || [] }];
    const all = series.flatMap((s) => s.values);
    const lo0 = spec.min === undefined ? Math.min(0, ...all) : spec.min;
    // the axis ends on the first round tick at or above the largest value
    const top0 = Math.max(...all), step0 = niceTicks(lo0, top0).step;
    const hi0 = spec.max === undefined ? Math.ceil(top0 / step0 - 1e-9) * step0 : spec.max;
    const decimals = spec.decimals === undefined ? (all.some((v) => !Number.isInteger(v)) ? 1 : 0) : spec.decimals;
    const fmt = (v) => numberFormat(decimals).format(v);
    const S = 32, LH = S * 1.3;
    // states carry over: a state names only what changes
    const states = [];
    (spec.states && spec.states.length ? spec.states : [{}]).forEach((st, k) => {
      states.push(Object.assign({ show: series.map((s) => s.name), highlight: [], focus: null, values: null, zoom: null, sort: null, note: null }, k ? states[k - 1] : {}, st));
    });
    const tickLabelWidth = Math.max(...niceTicks(lo0, hi0).ticks.map((t) => textWidth(fmt(t), S)));
    const pad = Object.assign(horizontal
      ? { left: Math.max(...labels.map((l) => textWidth(l, S))) + 32, right: 240, top: 70, bottom: 80 }
      : { left: tickLabelWidth + 40, right: 20, top: 110, bottom: 80 }, spec.pad || {});
    const P = { x0: X + pad.left, x1: X + W - pad.right, y0: Y + pad.top, y1: Y + H - pad.bottom };

    // one state as items in value space; inner() maps them with the axis of the moment
    function layout(k, c) {
      const st = states[k], items = new Map();
      const visible = series.filter((s) => st.show.includes(s.name));
      const lead = visible[0] || series[0];
      const order = labels.map((l, i) => i);
      if (st.sort) order.sort((a, b) => (st.sort === "asc" ? 1 : -1) * (lead.values[a] - lead.values[b]));
      const along = horizontal ? P.y1 - P.y0 : P.x1 - P.x0, slot = along / labels.length;
      const group = slot * (visible.length > 1 ? 0.78 : 0.6), gap = visible.length > 1 ? 8 : 0;
      const thick = visible.length ? (group - gap * (visible.length - 1)) / visible.length : group;
      const greys = [c.light, c.gray, c.dark];
      const accentSoft = mixRgb(c.accent, c.bg, 0.45);
      const showValues = st.values || (st.highlight.length || st.focus ? "highlight" : "none");
      order.forEach((li, pos) => {
        const name = labels[li], centre = (horizontal ? P.y0 : P.x0) + slot * (pos + 0.5);
        const marked = st.highlight.includes(name);
        items.set("cat|" + name, { kind: "cat", c: centre, text: name, color: marked ? c.white : c.gray, op: 1 });
        series.forEach((s, si) => {
          const vi = visible.indexOf(s), on = vi >= 0;
          const offset = on ? -group / 2 + thick / 2 + vi * (thick + gap) : 0;
          // a single series steps back to grey around the highlight; several keep the
          // greys of the legend, so the names still match their bars
          let color = greys[Math.min(si, 2)];
          if (st.highlight.length) color = marked ? (vi === 0 ? c.accent : accentSoft) : visible.length > 1 ? color : c.gray;
          if (st.focus) color = s.name === st.focus ? c.accent : greys[Math.min(si + 1, 2)];
          const v = s.values[li];
          items.set(`bar|${si}|${name}`, { kind: "bar", v: on ? v : 0, c: centre + offset, w: on ? thick : 0, color, op: on ? 1 : 0, key: name });
          const labelled = on && (showValues === "all" || (showValues === "highlight" && (marked || s.name === st.focus)));
          items.set(`val|${si}|${name}`, { kind: "val", v: on ? v : 0, c: centre + offset, text: fmt(v) + (spec.unit || ""),
            color: color === c.accent ? c.accent : c.light, op: labelled ? 1 : 0 });
        });
        if (st.note && st.note.at === name) {
          const v = lead.values[li];
          const offset = visible.length ? -group / 2 + thick / 2 : 0;
          items.set("note|" + st.note.text, { kind: "note", v, c: centre + offset, text: st.note.text, op: 1 });
        }
      });
      if (visible.length > 1) {
        let x = 0;
        series.forEach((s, si) => {
          const on = visible.includes(s);
          const color = st.focus ? (s.name === st.focus ? c.accent : c.gray) : [c.light, c.gray][Math.min(si, 1)];
          items.set("leg|" + s.name, { kind: "leg", x, text: s.name, color, op: on ? 1 : 0 });
          if (on) x += textWidth(s.name, S) + 48;
        });
      }
      return { items, domain: st.zoom || [lo0, hi0] };
    }

    const lerp = (a, b, p) => a + (b - a) * p;
    // a label that a grid line must not cross: a rim in the background colour behind its glyphs
    const halo = (t, bg) => t.replace("<text ", `<text stroke="${bg}" stroke-width="10" stroke-linejoin="round" paint-order="stroke" `);
    function inner(value, el) {
      const c = C();
      const scope = el ? getComputedStyle(el) : null;
      c.accent = (spec.accent ? css("--" + spec.accent) : "") || (scope && scope.getPropertyValue("--part-color").trim()) || css("--part-color") || c.blue;
      const k0 = Math.max(0, Math.min(states.length - 1, Math.floor(value))), k1 = Math.min(states.length - 1, k0 + 1);
      const p = Math.max(0, Math.min(1, value - k0));
      const A = layout(k0, c), B = k1 === k0 ? A : layout(k1, c);
      const lo = lerp(A.domain[0], B.domain[0], p), hi = lerp(A.domain[1], B.domain[1], p);
      const scale = horizontal ? (v) => P.x0 + (v - lo) / (hi - lo) * (P.x1 - P.x0) : (v) => P.y1 - (v - lo) / (hi - lo) * (P.y1 - P.y0);
      const base = scale(Math.max(lo, Math.min(hi, 0)));
      const r = (v) => +v.toFixed(2);
      let grid = "", ticks = "", bars = "", text = "";
      // ticks: those of both states slide with the axis, the others fade
      const tA = niceTicks(A.domain[0], A.domain[1]).ticks, tB = niceTicks(B.domain[0], B.domain[1]).ticks;
      Array.from(new Set([...tA, ...tB])).sort((a, b) => a - b).forEach((t) => {
        const op = (tA.includes(t) ? 1 - p : 0) + (tB.includes(t) ? p : 0);
        const at = scale(t);
        if (op <= 0.01 || at < (horizontal ? P.x0 : P.y0) - 1 || at > (horizontal ? P.x1 : P.y1) + 1) return;
        const o = op < 0.999 ? ` opacity="${r(op)}"` : "";
        if (horizontal) {
          grid += `<line x1="${r(at)}" y1="${P.y0}" x2="${r(at)}" y2="${P.y1}" stroke="${c.dark}" stroke-width="1"${o}/>`;
          ticks += `<g${o}>${label(r(at), P.y1 + 48, fmt(t), { size: S, color: c.gray, anchor: "middle" })}</g>`;
        } else {
          grid += `<line x1="${P.x0}" y1="${r(at)}" x2="${P.x1}" y2="${r(at)}" stroke="${c.dark}" stroke-width="1"${o}/>`;
          ticks += `<g${o}>${label(P.x0 - 20, 0, fmt(t), { size: S, color: c.gray, anchor: "end", centerY: r(at) })}</g>`;
        }
      });
      const keys = Array.from(new Set([...A.items.keys(), ...B.items.keys()]));
      keys.forEach((key) => {
        const a = A.items.get(key), b = B.items.get(key);
        const m = a && b ? {
          kind: a.kind, v: lerp(a.v || 0, b.v || 0, p), c: lerp(a.c || 0, b.c || 0, p), w: lerp(a.w || 0, b.w || 0, p),
          x: lerp(a.x || 0, b.x || 0, p), op: lerp(a.op, b.op, p), color: a.color && b.color ? mixRgb(a.color, b.color, p) : (b.color || a.color),
          text: p < 0.5 ? a.text : b.text, key: b.key } : Object.assign({}, a || b, { op: (a || b).op * (a ? 1 - p : p) });
        // an item that changes place (sorting) gets thinner on the way and its text steps
        // back, so two rows crossing each other do not pile up their labels
        if (a && b && Math.abs((a.c || 0) - (b.c || 0)) > 1) {
          const dip = Math.sin(Math.PI * p);
          if (m.kind === "bar") m.w *= 1 - 0.45 * dip;
          else m.op *= 1 - 0.8 * dip;
        }
        if (m.op <= 0.01) return;
        const o = m.op < 0.999 ? ` opacity="${r(m.op)}"` : "";
        const top = scale(m.v), clipped = horizontal ? top > P.x1 + 1 : top < P.y0 - 1;
        if (m.kind === "bar" && m.w > 0.5) {
          // cut to the plot area by computation, not with a clipPath: the print
          // view strips ids from its cloned pages, and the clip would go with them
          const end = horizontal ? Math.max(P.x0, Math.min(P.x1, top)) : Math.max(P.y0, Math.min(P.y1, top));
          const rect = horizontal
            ? `<rect x="${r(Math.min(base, end))}" y="${r(m.c - m.w / 2)}" width="${r(Math.abs(end - base))}" height="${r(m.w)}" fill="${m.color}"${o}/>`
            : `<rect x="${r(m.c - m.w / 2)}" y="${r(Math.min(base, end))}" width="${r(m.w)}" height="${r(Math.abs(base - end))}" fill="${m.color}"${o}/>`;
          bars += spec.morph ? `<g data-morph="${spec.morph}-${m.key}">${rect}</g>` : rect;
        } else if (m.kind === "val" && !clipped) {
          text += `<g${o}>` + (horizontal
            ? halo(label(r(top + 16), 0, m.text, { size: S, color: m.color, centerY: r(m.c) }), c.bg)
            : halo(label(r(m.c), r(top - 16), m.text, { size: S, color: m.color, anchor: "middle" }), c.bg)) + "</g>";
        } else if (m.kind === "note") {
          const y = horizontal ? m.c : Math.max(P.y0, top) - 16 - LH;
          text += `<g${o}>` + (horizontal
            ? halo(label(r(Math.min(top, P.x1) + 16 + textWidth(fmt(m.v) + (spec.unit || ""), S) + 32), 0, m.text, { size: S, color: c.white, centerY: r(y) }), c.bg)
            : halo(label(r(m.c), r(y), m.text, { size: S, color: c.white, anchor: "middle" }), c.bg)) + "</g>";
        } else if (m.kind === "cat") {
          text += `<g${o}>` + (horizontal
            ? label(P.x0 - 20, 0, m.text, { size: S, color: m.color, anchor: "end", centerY: r(m.c) })
            : label(r(m.c), P.y1 + 48, m.text, { size: S, color: m.color, anchor: "middle" })) + "</g>";
        } else if (m.kind === "leg") {
          text += `<g${o}>${label(r(P.x0 + m.x), Y + S, m.text, { size: S, color: m.color })}</g>`;
        }
      });
      const axis = horizontal
        ? `<line x1="${r(base)}" y1="${P.y0}" x2="${r(base)}" y2="${P.y1}" stroke="${c.gray}" stroke-width="2"/>`
        : `<line x1="${P.x0}" y1="${r(base)}" x2="${P.x1}" y2="${r(base)}" stroke="${c.gray}" stroke-width="2"/>`;
      return `${grid}${bars}${axis}${ticks}${text}`;
    }

    return {
      id, states: states.length,
      // the chart in state k (an SVG group for d.svg)
      svg: (k = 0) => `<g data-chart="${id}">${inner(k, null)}</g>`,
      // with anim.js: one animation segment per state after the first
      steps(figure, o = {}) {
        if (!window.draw.anim) throw new Error("stagekit: d.chart().steps needs anim.js (load it after draw.js)");
        const a = window.draw.anim(figure, o);
        a.painter(id, (v) => {
          const g = document.querySelector(`#${figure} [data-chart="${id}"]`);
          if (g) g.innerHTML = inner(v, g);
        });
        for (let k = 1; k < states.length; k++) a.step(a.value(id, k, { dur: o.dur || 900 }));
        return a;
      },
    };
  }

  /* color(name) liest eine benannte Zusatzfarbe des Themes, etwa "families-transfer"
   aus [colors.families] der style.toml; so bleibt ein Deck frei von Hex-Werten. */
  const color = (name) => css("--" + name);
  window.draw = { svg, layers, label, box, anchor, connect, closeup, verdict, mark, keys, icon, highlight, ipo, formula, line, arrow, wire, dot, gate, lamp, toggle, truthTable, table, chart, colors: C, color };
})();
