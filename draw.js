/* stagekit.draw: SVG drawings for slides, in the theme's colours.
 *
 * Every helper returns an SVG string; assemble them inside svg(w, h, ...)
 * and put the result into a <div class="figure">. Coordinates are in the
 * drawing's own units (the viewBox), so a drawing scales with the slide.
 *
 *   svg(w, h, ...parts)               the frame
 *   box(x, y, w, h, text, opts)       rounded box with centred text
 *   verdict(x, y, w, h, text, ok, opts)  box framed green with a check, or red with a cross, centred at its bottom;
 *                                     ok null keeps the same layout without a mark (no verdict yet)
 *   mark(cx, cy, ok, opts)           just the check or cross, same size everywhere
 *   formula(x, y, text, opts)         a set formula: _ subscript, ^ superscript, {} groups
 *   label(x, y, text, opts)           text; opts: size, color, anchor, mono, keepCase,
 *                                     centerY (mittig zu dieser Hoehe statt Grundlinie y)
 *   layers(...groups)                 concatenates groups so wires come first: layers(wires, gates, labels)
 *   line(x1, y1, x2, y2, opts)        opts: color, width, dashed
 *   arrow(x1, y1, x2, y2, opts)       line with a filled triangle head
 *   wire(pts, on)                     polyline, lit (yellow) or not (gray)
 *   dot(x, y, on)                     junction
 *   gate(type, x, y, on)              and/or/xor/not/nand/nor/xnor, 56 x 40, no label
 *   lamp(x, y, on, text)              output lamp with a caption below
 *   toggle(x, y, on, text)            a switch symbol (static on slides)
 *   truthTable(inputs, outputs, rows, now)   an HTML table (not SVG)
 *   table(x, y, headers, rows, opts)  an SVG table for figures; opts: cw, rh, size, hl
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
    let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${o.rounded === false ? 0 : (o.rx || 8)}" fill="${fill}" stroke="${border}" stroke-width="${o.width || 2}"${o.dashed ? ' stroke-dasharray="8 6"' : ""}/>`;
    if (text) {
      // multi-line text is centred as a block: start above the middle by half the extra lines
      const size = o.size || 32, lh = o.lineHeight || 1.3, n = String(text).split("\n").length;
      s += label(x + w / 2, y + h / 2 + size * 0.35 - (n - 1) * size * lh / 2, text, { ...o, anchor: "middle", color: o.color || c.white });
    }
    return s;
  }

  /* Bewertungszeichen: Der Kasten, der die bessere Loesung zeigt, bekommt einen
   * gruenen Rahmen und mittig an seinem unteren Rand einen kleinen gruenen
   * Haken; das Gegenstueck bekommt Rahmen und Kreuz in Rot, in derselben
   * Groesse und an derselben Stelle. Immer ueber verdict() zeichnen, nie von
   * Hand, damit das Zeichen auf jeder Folie gleich aussieht und gleich sitzt. */
  function mark(cx, cy, ok, o = {}) {
    const c = C();
    const col = o.color || (ok ? c.green : c.red);
    const r = (o.size || 34) / 2;
    const w = o.width || 7;
    const stil = `fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;
    if (ok) return `<path d="M${cx - r},${cy + r * 0.1} l${r * 0.6},${r * 0.68} l${r * 1.4},${-r * 1.46}" ${stil}/>`;
    const a = r * 0.72;
    return `<path d="M${cx - a},${cy - a} L${cx + a},${cy + a} M${cx + a},${cy - a} L${cx - a},${cy + a}" ${stil}/>`;
  }

  function verdict(x, y, w, h, text, ok, o = {}) {
    const c = C();
    // Rahmen und Zeichen tragen immer die Bewertungsfarbe; o.color faerbt nur
    // den Text im Kasten, o.size ist seine Schriftgroesse. Das Zeichen behaelt
    // seine eigene Groesse, damit es auf jeder Folie gleich aussieht.
    // ok === null: noch kein Urteil. Gleicher Kasten, gleiche Textlage, kein
    // Zeichen; so springt nichts, wenn das Urteil erst spaeter erscheint.
    const col = ok === null || ok === undefined ? (o.border || c.light) : (ok ? c.green : c.red);
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

  function lamp(x, y, on, text) {
    const c = C();
    return `<circle cx="${x}" cy="${y}" r="13" fill="${on ? c.yellow : c.bg}" stroke="${on ? c.yellow : c.light}" stroke-width="3"/>` +
      (on ? `<circle cx="${x}" cy="${y}" r="21" fill="${c.yellow}" opacity="0.18"/>` : "") +
      (text ? label(x, y + 36, text, { size: 16, color: c.gray, anchor: "middle", mono: true }) : "");
  }

  function toggle(x, y, on, text) {
    const c = C();
    return (text ? label(x - 28, y + 6, text, { size: 18, color: c.light, anchor: "end", mono: true }) : "") +
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

  window.draw = { svg, layers, label, box, verdict, mark, formula, line, arrow, wire, dot, gate, lamp, toggle, truthTable, table, colors: C };
})();
