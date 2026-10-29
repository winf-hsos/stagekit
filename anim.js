/* stagekit.anim: animated drawings on a slide.
 *
 * An animation belongs to one figure and is a list of segments. Every segment
 * ends in a resting state (a keyframe), and every keyframe is a build-up step
 * of the slide: it has a frame number, a page in the PDF and an image in the
 * contact sheet. In the talk, → plays the way from one keyframe to the next;
 * everywhere else (?slide=N, ?print, ← back, jumps) the keyframe is shown at
 * once. So a deck with animations stays printable and checkable.
 *
 * Load after draw.js and before deck.js; define animations while deck.js
 * loads, after drawing the figure:
 *
 *   const d = window.draw;
 *   el("fig-net").innerHTML = d.svg(1680, 600, d.g("link", d.line(...)), d.g("packet", d.box(...)));
 *   const a = d.anim("fig-net");                 // options: auto, gap, autostart, first
 *   a.step(a.draw("link"), a.along("packet", "link"));
 *   a.step(a.show("ack"), a.hold(), a.count("bytes", 1500));
 *
 * Targets are names given with d.g(name, ...) or CSS selectors ("#id", ".c",
 * "[...]"), looked up inside the figure. Items of a step run one after the
 * other; a.par(...) runs items side by side. Durations are in ms.
 *
 *   show(t, o) / hide(t, o)        fade in (starts invisible) / fade out
 *   draw(t, o)                     strokes draw themselves (starts undrawn)
 *   move(t, dx, dy, o)             move by dx, dy
 *   moveTo(t, x, y, o)             move the centre of t to x, y
 *   along(t, path, o)              the centre of t follows a line or path; o.reverse
 *   scale(t, s, o) / rotate(t, deg, o)
 *   color(t, color, o)             o.part: "stroke" (default), "fill" or "text"; colour names of the theme
 *   count(t, to, o)                count the number in a text; o.from, o.decimals, o.prefix, o.suffix
 *   pulse(t, o)                    grow and shrink, o.times (default 2)
 *   swap(out, in, o)               cross-fade two targets
 *   camera([x, y, w, h], o)        zoom and pan: animates the viewBox of the drawing
 *   set(t, props)                  start state: opacity, x, y, scale, rotate, draw
 *   wait(ms), hold()               pause; hold waits for → (semi-automatic)
 *   par(...items), seq(...items)
 *
 * Common options: dur (default 800), ease ("inOut" default, "in", "out", "linear").
 * Animation options: auto (segments follow each other on their own, with gap
 * ms in between), autostart (the first segment starts on entering the slide),
 * first (the build-up step of the first segment, default 1).
 *
 * Everything is computed from the time alone: render(t) starts from the
 * initial state and applies every tween up to t. That makes jumps exact and
 * the export deterministic. ?anim-t=0.5 shows the frame's segment half-way,
 * for the self-test. */

(function () {
  "use strict";

  const all = [];
  const params = new URLSearchParams(location.search);
  const EASE = {
    linear: (t) => t,
    in: (t) => t * t * t,
    out: (t) => 1 - Math.pow(1 - t, 3),
    inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  };
  const DUR = 800;
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, p) => a + (b - a) * p;

  // --- colours ------------------------------------------------------------------
  function resolveColor(c) {
    if (!c) return c;
    if (/^(#|rgb|hsl)/.test(c)) return c;
    const v = getComputedStyle(document.documentElement).getPropertyValue("--" + c).trim();
    return v || c;
  }
  function rgb(c) {
    const ctx = rgb.ctx || (rgb.ctx = document.createElement("canvas").getContext("2d"));
    ctx.fillStyle = "#000";
    ctx.fillStyle = resolveColor(c) || "#000";
    const h = ctx.fillStyle;   // normalised: #rrggbb or rgba(...)
    if (h[0] === "#") return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    return h.match(/[\d.]+/g).slice(0, 3).map(Number);
  }
  const mixColor = (a, b, p) => { const x = rgb(a), y = rgb(b); return `rgb(${x.map((v, i) => Math.round(lerp(v, y[i], p))).join(",")})`; };

  // --- building the timeline -------------------------------------------------------
  // An item is a plain object; layout() turns it into tweens with start times.
  function layout(item, t0, out) {
    if (item.type === "seq") { let t = t0; item.items.forEach((c) => { t = layout(c, t, out); }); return t; }
    if (item.type === "par") return item.items.reduce((m, c) => Math.max(m, layout(c, t0, out)), t0);
    if (item.type === "wait") return t0 + item.dur;
    if (item.type === "hold") { out.holds.push(t0); return t0; }
    out.tweens.push(Object.assign({}, item, { start: t0 }));
    return t0 + item.dur;
  }

  function anim(figure, opts = {}) {
    const a = {
      figure, auto: !!opts.auto, gap: opts.gap === undefined ? 600 : opts.gap,
      autostart: !!opts.autostart, first: opts.first || 1,
      segments: [], initial: [],
    };
    const tw = (t, prop, to, o = {}, extra = {}) => Object.assign({ type: "tw", t, prop, to, dur: o.dur === undefined ? DUR : o.dur, ease: o.ease || "inOut" }, extra);

    // --- the vocabulary ----------------------------------------------------------
    a.show = (t, o) => tw(t, "opacity", 1, o, { implicit: { opacity: 0 } });
    a.hide = (t, o) => tw(t, "opacity", 0, o);
    a.draw = (t, o) => tw(t, "draw", 1, o, { implicit: { draw: 0 } });
    a.move = (t, dx, dy, o) => ({ type: "par", items: [tw(t, "x", dx, o, { rel: true }), tw(t, "y", dy, o, { rel: true })] });
    a.moveTo = (t, x, y, o) => tw(t, "center", [x, y], o);
    a.along = (t, path, o = {}) => tw(t, "along", 1, o, { path, reverse: !!o.reverse });
    a.scale = (t, s, o) => tw(t, "scale", s, o);
    a.rotate = (t, deg, o) => tw(t, "rotate", deg, o);
    a.color = (t, c, o = {}) => tw(t, "color:" + (o.part || "stroke"), c, o);
    a.count = (t, to, o = {}) => tw(t, "num", to, o, { from: o.from, decimals: o.decimals || 0, prefix: o.prefix || "", suffix: o.suffix || "" });
    a.camera = (box, o) => tw(null, "view", box, o);
    a.pulse = (t, o = {}) => {
      const d = (o.dur || 600) / 2, items = [];
      for (let i = 0; i < (o.times || 2); i++) items.push(tw(t, "scale", o.to || 1.08, { dur: d, ease: "out" }), tw(t, "scale", 1, { dur: d, ease: "in" }));
      return { type: "seq", items };
    };
    a.swap = (out, inn, o) => ({ type: "par", items: [a.hide(out, o), a.show(inn, o)] });
    a.wait = (ms) => ({ type: "wait", dur: ms });
    a.hold = () => ({ type: "hold" });
    a.par = (...items) => ({ type: "par", items });
    a.seq = (...items) => ({ type: "seq", items });
    a.set = (t, props) => { a.initial.push({ t, props }); return a; };
    a.step = (...items) => {
      const out = { tweens: [], holds: [] };
      out.dur = layout({ type: "seq", items }, 0, out);
      a.segments.push(out);
      return a;
    };
    Object.defineProperty(a, "steps", { get: () => a.segments.length });

    // --- resolving targets (lazily: the figure is drawn when deck.js runs) -------------
    let ready = false, root, svgRoot, T = [0], tweens = [], holds = [], init = {}, numFmt = {};
    const nodes = {};
    function find(sel) {
      if (sel === null) return svgRoot ? [svgRoot] : [];
      if (!nodes[sel]) {
        const css = /^[#.[]/.test(sel) ? sel : `[data-a="${sel}"]`;
        nodes[sel] = Array.from(root.querySelectorAll(css));
        if (!nodes[sel].length) console.warn(`stagekit.anim: nothing matches "${sel}" in #${figure}`);
      }
      return nodes[sel];
    }
    function setup() {
      root = document.getElementById(figure);
      if (!root) return false;
      svgRoot = root.querySelector("svg");
      // absolute times: segment k runs from T[k-1] to T[k]
      T = [0]; tweens = []; holds = [];
      a.segments.forEach((s, k) => {
        s.tweens.forEach((x, i) => tweens.push(Object.assign({}, x, { start: T[k] + x.start, order: k * 1e4 + i })));
        s.holds.forEach((h) => holds.push(T[k] + h));
        T.push(T[k] + s.dur);
      });
      tweens.sort((x, y) => x.start - y.start || x.order - y.order);
      // initial state: what the first tween of a property implies (show starts
      // invisible, draw undrawn, count at its from), then a.set() on top
      init = {}; numFmt = {};
      const seen = new Set();
      tweens.forEach((x) => {
        const key = x.t === null ? "@view" : x.t, id = key + "|" + x.prop;
        if (x.prop === "num" && !numFmt[key]) numFmt[key] = x;
        if (seen.has(id)) return;
        seen.add(id);
        const implied = x.implicit || (x.prop === "num" && x.from !== undefined ? { num: x.from } : null);
        if (implied) init[key] = Object.assign(init[key] || {}, implied);
      });
      a.initial.forEach(({ t, props }) => { init[t] = Object.assign(init[t] || {}, props); });
      ready = true;
      return true;
    }

    // --- what each node looked like before the animation touched it ------------------
    const memo = new WeakMap();
    function base(n) {
      let m = memo.get(n);
      if (!m) {
        let c = { x: 0, y: 0 };
        try { const b = n.getBBox(); c = { x: b.x + b.width / 2, y: b.y + b.height / 2 }; } catch (e) { /* not rendered */ }
        m = { transform: n.getAttribute("transform") || "", c, view: n.getAttribute && n.getAttribute("viewBox") };
        memo.set(n, m);
      }
      return m;
    }
    const geometry = (n) => [n, ...n.querySelectorAll("*")].filter((e) => typeof e.getTotalLength === "function" && e.tagName !== "text" && e.tagName !== "tspan");
    function startValue(sel, prop) {
      const ns = find(sel);
      if (prop === "opacity" || prop === "scale" || prop === "draw" || prop === "along") return 1;
      if (prop === "x" || prop === "y" || prop === "rotate") return 0;
      if (prop === "view") { const v = ns[0] && base(ns[0]).view; return v ? v.split(/[\s,]+/).map(Number) : [0, 0, 100, 100]; }
      if (prop === "num") { const tx = ns[0] && (ns[0].querySelector("tspan:last-child") || ns[0].querySelector("text") || ns[0]); return tx ? parseFloat(tx.textContent.replace(/[^\d.-]/g, "")) || 0 : 0; }
      if (prop.startsWith("color:")) {
        const part = prop.slice(6), n = ns[0];
        if (!n) return "#000";
        const e = part === "text" ? (n.tagName === "text" ? n : n.querySelector("text")) : [n, ...n.querySelectorAll("*")].find((x) => x.getAttribute(part === "fill" ? "fill" : "stroke") && x.tagName !== "text");
        return (e && e.getAttribute(part === "stroke" ? "stroke" : "fill")) || "#000";
      }
      return 0;
    }

    // read once, before the animation has touched anything
    const starts = {};
    const start = (key, prop) => {
      const id = key + "|" + prop;
      if (!(id in starts)) starts[id] = startValue(key === "@view" ? null : key, prop);
      return starts[id];
    };

    // --- render: the state at time t, computed from scratch ---------------------------
    const keyOfTween = (x) => (x.t === null ? "@view" : x.t);
    const propsOf = (x) => (x.prop === "center" || x.prop === "along" ? ["x", "y"] : [x.prop]);
    function render(t) {
      if (!ready && !setup()) return;
      const state = {};
      const get = (key, prop) => {
        const s = state[key] || (state[key] = {});
        if (!(prop in s)) s[prop] = (init[key] && prop in init[key]) ? init[key][prop] : start(key, prop);
        return s[prop];
      };
      // every property any tween touches gets its start value first, so that a
      // jump back in time also undoes what later tweens did
      Object.entries(init).forEach(([k, props]) => Object.keys(props).forEach((p) => get(k, p)));
      tweens.forEach((x) => propsOf(x).forEach((p) => get(keyOfTween(x), p)));
      tweens.forEach((x) => {
        const key = keyOfTween(x);
        // a tween that begins exactly at t has done nothing yet (unless it takes no time)
        if (x.start > t || (x.start === t && x.dur > 0)) return;
        const p = EASE[x.ease] ? EASE[x.ease](x.dur ? clamp((t - x.start) / x.dur) : 1) : 1;
        if (x.prop === "center") {
          const c = base(find(x.t)[0] || document.body).c;
          const fx = get(key, "x"), fy = get(key, "y");
          state[key].x = lerp(fx, x.to[0] - c.x, p); state[key].y = lerp(fy, x.to[1] - c.y, p);
        } else if (x.prop === "along") {
          const path = geometry(find(x.path)[0] || document.createElementNS("http://www.w3.org/2000/svg", "g"))[0];
          const n = find(x.t)[0];
          get(key, "x"); get(key, "y");
          if (path && n) {
            const L = path.getTotalLength(), pt = path.getPointAtLength((x.reverse ? 1 - p : p) * L), c = base(n).c;
            state[key].x = pt.x - c.x; state[key].y = pt.y - c.y;
          }
        } else if (x.prop.startsWith("color:")) {
          state[key][x.prop] = mixColor(get(key, x.prop), x.to, p);
        } else if (x.prop === "view") {
          const f = get(key, "view");
          state[key].view = f.map((v, i) => lerp(v, x.to[i], p));
        } else if (x.prop === "num") {
          state[key].num = lerp(x.from === undefined ? get(key, "num") : x.from, x.to, p);
        } else {
          const f = get(key, x.prop);
          state[key][x.prop] = lerp(f, x.rel ? f + x.to : x.to, p);
        }
      });
      flush(state);
    }

    function flush(state) {
      Object.entries(state).forEach(([key, s]) => {
        const ns = key === "@view" ? (svgRoot ? [svgRoot] : []) : find(key);
        ns.forEach((n) => {
          if (key === "@view") { if (s.view) n.setAttribute("viewBox", s.view.map((v) => +v.toFixed(2)).join(" ")); return; }
          const b = base(n);
          if ("x" in s || "y" in s || "scale" in s || "rotate" in s) {
            const x = s.x || 0, y = s.y || 0, r = s.rotate || 0, k = s.scale === undefined ? 1 : s.scale;
            n.setAttribute("transform", `translate(${+x.toFixed(2)} ${+y.toFixed(2)}) ${b.transform} translate(${b.c.x} ${b.c.y}) rotate(${+r.toFixed(2)}) scale(${+k.toFixed(4)}) translate(${-b.c.x} ${-b.c.y})`.replace(/\s+/g, " "));
          }
          if ("opacity" in s) n.style.opacity = +s.opacity.toFixed(3);
          if ("draw" in s) {
            const p = s.draw;
            geometry(n).forEach((g) => {
              const L = g._skLen || (g._skLen = g.getTotalLength() || 1);
              const filled = g.tagName === "polygon" || g.tagName === "circle" && g.getAttribute("stroke") === null;
              if (filled) { g.style.opacity = clamp((p - 0.85) / 0.15); return; }
              g.style.strokeDasharray = p >= 1 ? "" : `${L} ${L}`;
              g.style.strokeDashoffset = p >= 1 ? "" : String(L * (1 - p));
            });
            n.querySelectorAll("text").forEach((e) => { e.style.opacity = clamp((p - 0.6) / 0.4); });
          }
          Object.keys(s).filter((p) => p.startsWith("color:")).forEach((p) => {
            const part = p.slice(6), c = s[p];
            if (part === "text") (n.tagName === "text" ? [n] : n.querySelectorAll("text")).forEach((e) => e.setAttribute("fill", c));
            else [n, ...n.querySelectorAll("*")].filter((e) => e.tagName !== "text" && e.tagName !== "tspan" && e.getAttribute(part) && e.getAttribute(part) !== "none").forEach((e) => e.setAttribute(part, c));
          });
          if ("num" in s) {
            const f = numFmt[key] || { decimals: 0, prefix: "", suffix: "" };
            const e = n.querySelector("tspan:last-child") || n.querySelector("text") || n;
            e.textContent = f.prefix + s.num.toFixed(f.decimals) + f.suffix;
          }
        });
      });
    }

    // --- playing -------------------------------------------------------------------
    let key = 0, t = 0, stopAt = 0, playing = false, waiting = false, raf = 0, last = 0, autoTimer = 0;
    const N = () => a.segments.length;
    const keyOf = (step) => clamp(step - a.first + 1, 0, N());
    function stop() { cancelAnimationFrame(raf); raf = 0; clearTimeout(autoTimer); playing = false; waiting = false; }
    function seek(k, frac) {
      stop(); key = k;
      t = frac === undefined || k === 0 ? T[k] : lerp(T[k - 1], T[k], frac);
      render(t);
    }
    // where playback pauses next: the next hold inside the segment, else its end
    const nextStop = () => Math.min(T[key], ...holds.filter((h) => h > t + 1e-6 && h <= T[key]));
    // playback reached stopAt: wait at a hold, or end the segment (and, with
    // auto, let the next one follow after the gap)
    function arrived() {
      cancelAnimationFrame(raf); raf = 0; playing = false;
      waiting = t < T[key];
      if (a.onchange) a.onchange();                       // the notes window shows the state
      if (waiting) return;
      if (a.auto && key < N()) {
        const k = key;
        autoTimer = setTimeout(() => { if (key === k && !playing && window.stagekit) window.stagekit.next(); }, a.gap);
      }
    }
    function run() {
      cancelAnimationFrame(raf);
      playing = true; waiting = false; stopAt = nextStop(); last = performance.now();
      const tick = (now) => {
        t = Math.min(stopAt, t + (now - last)); last = now;
        render(t);
        if (t < stopAt) raf = requestAnimationFrame(tick);
        else arrived();
      };
      raf = requestAnimationFrame(tick);
    }
    let firstCall = true;
    // called by stagekit.js whenever the slide shows a frame
    a.frame = (step, play) => {
      if (!ready && !setup()) return;                      // T, the segment times, come from setup
      const k = keyOf(step);
      const frac = firstCall && params.has("anim-t") ? clamp(parseFloat(params.get("anim-t"))) : undefined;
      firstCall = false;
      if (play && k === key + 1) { seek(key); key = k; run(); }
      else seek(k, frac);
    };
    // → while the animation is busy: true when it took the key
    // → while it is playing skips to the next hold or the end of the segment;
    // → while it waits at a hold plays on
    a.next = () => {
      if (waiting) { run(); return true; }
      if (playing) { t = stopAt; render(t); arrived(); return true; }
      return false;
    };
    a.stop = stop;
    a.status = () => `animation ${key}/${N()}${playing ? " running" : waiting ? " waiting" : ""}`;
    all.push(a);
    return a;
  }

  // a named group: the handle animations use to find a part of a drawing
  const g = (name, ...parts) => `<g data-a="${name}">${parts.flat().join("")}</g>`;
  // an image inside a drawing, e.g. a generated photo or a cut-out (transparent PNG)
  const image = (x, y, w, h, href, o = {}) =>
    `<image href="${href}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="${o.fit || "xMidYMid meet"}"${o.opacity === undefined ? "" : ` opacity="${o.opacity}"`}/>`;

  if (!window.draw) throw new Error("stagekit: load draw.js before anim.js");
  Object.assign(window.draw, { anim, g, image });
  window.stagekitAnim = { all };
})();
