/* stagekit: a small presentation runtime for HTML decks.
 *
 * A deck is one HTML file: <div class="deck" data-title data-subtitle
 * data-parts='[...]'> with one <section class="slide"> per slide. stagekit
 * adds what every deck needs and nothing else:
 *
 *   - title slide and agenda, generated from the deck's data attributes
 *     (put an empty <section class="slide title"> / "agenda" where they go)
 *   - section slides: <section class="slide part" data-part="name">, which
 *     also set the current part for the location bar
 *   - a location bar on every content slide (part name, progress)
 *   - steps: any element with data-step="n" appears on step n of its slide
 *     (space/arrow advance steps before slides; the layout never jumps
 *     because hidden steps keep their space)
 *   - keyboard: → ↓ space PgDn next, ← ↑ PgUp back, Home/End, F fullscreen,
 *     N notes window (speaker notes of the current and next slide, kept in
 *     sync over a BroadcastChannel), P print view, Esc leaves fullscreen
 *   - every build-up step is a frame with its own number: the counter, the
 *     hash (#12 is frame 12), ?slide=12 and the export count frames, so a
 *     slide with two steps takes three numbers
 *   - ?print shows all frames stacked (steps as clones) for a quick print
 *   - hooks: a slide may carry data-on-show="fn" / data-on-step="fn"; the
 *     named global functions are called with (slide, step)
 *   - live polls: <section class="slide poll" data-poll="id"> with a question
 *     and options; the audience answers on their phones (see "live polls")
 *
 * Design values come from theme.css; stagekit.js never sets a colour. */

(function () {
  "use strict";

  // set by tools/release.py; tools/sync.py and tools/export.py read it from here
  const VERSION = "0.14.0";

  const $ =(sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const params = new URLSearchParams(location.search);
  const reducedMotion = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
  let ready = false;     // true once the first frame is up: nothing counts or glides on load

  const deck = $(".deck");
  if (!deck) return;
  const title = deck.dataset.title || document.title;
  const subtitle = deck.dataset.subtitle || "";
  let parts = [];
  try { parts = JSON.parse(deck.dataset.parts || "[]"); } catch (e) { parts = []; }
  const partColors = (() => { try { return JSON.parse(deck.dataset.partColors || "{}"); } catch (e) { return {}; } })();

  // --- generated slides ------------------------------------------------------
  const bare = (s) => !$(".content", s);          // only notes inside: generate the content
  const titleSlide = $(".slide.title", deck);
  if (titleSlide && bare(titleSlide)) {
    titleSlide.insertAdjacentHTML("afterbegin", `<div class="content"><div class="title-text">${title}</div><div class="subtitle-text">${subtitle}</div></div>`);
  }
  const agenda = $(".slide.agenda", deck);
  if (agenda && bare(agenda)) {
    agenda.insertAdjacentHTML("afterbegin", `<div class="content">${parts.map((p, i) => `<div class="agenda-item"><span class="n">${i + 1}</span>${p}</div>`).join("")}</div>`);
  }
  $$(".slide.part", deck).forEach((s) => {
    if (!bare(s)) return;
    const name = s.dataset.part;
    const n = parts.indexOf(name) + 1;
    s.insertAdjacentHTML("afterbegin", `<div class="content"><div class="part-n">${n ? "part " + n : ""}</div><div class="part-text">${name}</div>${s.dataset.subtitle ? `<div class="part-sub">${s.dataset.subtitle}</div>` : ""}</div>`);
  });

  /* --- signature layouts ----------------------------------------------------------
   * Signature slide classes with a fixed form, so a deck gets variety from tested
   * pieces instead of a new drawing each time (when: docs/design-rules.md):
   *
   *   number     <div class="number-value">73 %</div><div class="number-text">…</div>
   *              one figure at display size, counting up when the slide is reached
 *              (data-count="off" on the figure for a year, a code, a phone number)
   *   quote      <blockquote>…</blockquote><div class="quote-by">who, year</div>
   *   fullbleed  <img class="photo" src="…"><div class="photo-text">question?</div>
   *   timeline   <ol class="events"><li data-date="1952">huffman</li>…</ol>,
   *              the latest event shown is marked as the current one
   *   compare    <div class="compare-view" data-stops="50 15 85"><img><img></div>,
   *              before and after with a line between them (see below)
   *   checklist  <ul class="checks"><li data-checked>…</li><li data-check="1">…</li><li>…</li></ul>,
   *              boxes ticked from the start, on a step, or left open
   *
   * stagekit only wraps the pieces of number and quote into a .content block
   * and adds the quotation mark; compare is built further down; everything
   * else is stagekit.css. */
  const wrap = (s, sel) => {
    if ($(".content", s)) return;
    const box = document.createElement("div");
    box.className = "content";
    $$(sel, s).forEach((e) => box.appendChild(e));
    s.insertBefore(box, $(".footnote, .notes", s));
  };
  $$(".slide.number", deck).forEach((s) => wrap(s, ":scope > .number-value, :scope > .number-text"));
  $$(".slide.quote", deck).forEach((s) => {
    wrap(s, ":scope > blockquote, :scope > .quote-by");
    const c = $(".content", s);
    if (c && !$(".quote-mark", c)) c.insertAdjacentHTML("afterbegin", '<div class="quote-mark" aria-hidden="true">“</div>');
  });
  $$(".slide.timeline ol.events", deck).forEach((ol) => {
    const items = $$(":scope > li", ol);
    ol.style.setProperty("--n", String(items.length));
    ol.classList.toggle("dense", items.length > 4);
    items.forEach((li) => {
      if ($(".date", li)) return;
      li.insertAdjacentHTML("afterbegin", `<span class="date">${li.dataset.date || ""}</span><span class="dot"></span>`);
    });
  });
  // A trace state is a complete snapshot. A repeated line number can describe a loop.
  $$(".slide.trace .trace-code", deck).forEach((block) => block.classList.add("code"));
  $$(".slide.trace .trace-states", deck).forEach((states) => {
    $$(":scope > [data-line]", states).forEach((state, step) => {
      if (step) state.dataset.step = String(step);
    });
  });
  // Each observation has its own addressable frame. Picking a measurement uses
  // the same navigation path as arrows, jumps and the embedded control bar.
  $$(".slide.measurement .measurements > li", deck).forEach((item) => {
    const button = $(":scope > button", item);
    const result = $(":scope > span", item);
    if (!button || !result) return;
    const step = Array.from(item.parentElement.children).indexOf(item) + 1;
    result.dataset.step = String(step);
    button.addEventListener("click", () => show(index, step));
    button.addEventListener("keydown", (event) => {
      // Let the native button activate on Space while it has keyboard focus.
      if (event.key === " ") event.stopPropagation();
    });
  });
  function teachingStep(s) {
    if (s.classList.contains("trace")) {
      const states = $$(".trace-states > [data-line]", s);
      const current = states.filter((state) => Number(state.dataset.step || 0) <= s._step).pop();
      states.forEach((state) => { state.hidden = state !== current; });
      $$(".trace-code > :is(div, li)", s).forEach((line, i) => {
        line.classList.toggle("trace-current", i + 1 === Number(current?.dataset.line));
      });
    }
    if (s.classList.contains("measurement")) {
      $$(".measurements > li", s).forEach((item) => {
        const result = $(":scope > span", item);
        const button = $(":scope > button", item);
        if (!result || !button) return;
        const selected = Number(result.dataset.step) === s._step;
        // Reserve the result's place even when another observation is chosen.
        result.classList.toggle("unselected", !selected);
        button.setAttribute("aria-expanded", String(selected));
      });
    }
  }
  // a checklist: each item gets a box, and a tick drawn in SVG, so the export's
  // step check sees nothing move. data-checked ticks it from the start,
  // data-check="2" on step 2; the tick then carries the data-step itself.
  $$(".slide.checklist ul.checks", deck).forEach((ul) => {
    const items = $$(":scope > li", ul);
    ul.classList.toggle("dense", items.length > 5);
    ul.dataset.noAdvance = "1";
    items.forEach((li) => {
      if ($(".check-box", li)) return;
      const at = Number(li.dataset.check) > 0 ? Number(li.dataset.check) : undefined;
      const tick = '<svg class="check-tick" viewBox="0 0 24 24" aria-hidden="true"' +
                   (at !== undefined ? ` data-step="${at}"` : "") + '><path d="M5 12.5 L10 17.5 L19 7"/></svg>';
      li.classList.toggle("open", li.dataset.checked === undefined && li.dataset.check === undefined);
      // the text and its .sub stay together as one block next to the box
      const text = document.createElement("span");
      text.className = "check-text";
      while (li.firstChild) text.appendChild(li.firstChild);
      li.append(text);
      li.insertAdjacentHTML("afterbegin", `<span class="check-box">${tick}</span>`);
      // in the talk a click on an item ticks it or takes the tick away; the
      // slide forgets this when it is reached again
      li.addEventListener("click", () => {
        const on = !li.classList.contains("ticked") && (li.classList.contains("unticked") || !checkedNow(li));
        li.classList.toggle("ticked", on);
        li.classList.toggle("unticked", !on);
        if (on) drawTick(li);
      });
    });
  });
  const checkedNow = (li) => {
    const t = $(".check-tick", li);
    return !li.classList.contains("open") && (!t.dataset.step || t.classList.contains("shown"));
  };
  function drawTick(li) {
    if (reducedMotion) return;
    const t = $(".check-tick", li);
    t.classList.remove("draw");
    void t.getBoundingClientRect();
    t.classList.add("draw");
  }
  // how: "glide" (one step forward) draws the ticks that just appeared; a new
  // arrival at the slide clears the clicks of the last visit
  function checkStep(s, how, fresh) {
    $$("ul.checks > li", s).forEach((li) => {
      if (fresh) li.classList.remove("ticked", "unticked");
      const t = $(".check-tick", li);
      if (t && how === "glide" && t.dataset.step && Number(t.dataset.step) === s._step) drawTick(li);
    });
  }
  // the current event of a timeline: the last one shown, if the list is built up in steps
  function markNow(s) {
    $$("ol.events", s).forEach((ol) => {
      const items = $$(":scope > li", ol);
      if (!items.some((li) => li.dataset.step)) return;
      const shown = items.filter((li) => !li.dataset.step || li.classList.contains("shown"));
      items.forEach((li) => li.classList.toggle("now", li === shown[shown.length - 1]));
      ol.style.setProperty("--last", String(items.indexOf(shown[shown.length - 1])));
    });
  }
  // a number counts up from zero when the slide is reached by one step forward;
  // a jump, a fresh load, the print view and the export show the final figure
  function countUp(s) {
    const e = $(".number-value", s);
    if (!e || e._counting || e.dataset.count === "off") return;     // a year or a code must not count
    const full = e.textContent;
    const m = full.match(/^(\D*?)(\d[\d.,\s]*\d|\d)(.*)$/s);
    if (!m) return;
    const digits = m[2].replace(/[\s.,]/g, "");
    const target = Number(digits);
    if (!isFinite(target) || target === 0) return;
    // keep the separators of the original: the count fills the same pattern
    const shape = (v) => {
      let out = String(v).padStart(digits.length, "0").split(""), r = "";
      for (const ch of m[2].split("").reverse()) r = (/\d/.test(ch) ? out.pop() || "" : ch) + r;
      return r.replace(/^[0.,\s]+(?=\d)/, "") || "0";
    };
    const t0 = performance.now(), dur = 900;
    e._counting = true;
    e.textContent = m[1] + shape(0) + m[3];     // at once, so the final figure never flashes first
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / dur), eased = 1 - Math.pow(1 - p, 3);
      if (!s.classList.contains("current") || p >= 1) { e.textContent = full; e._counting = false; return; }
      e.textContent = m[1] + shape(Math.round(target * eased)) + m[3];
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /* compare: two pictures of the same view, one over the other, and a line
   * between them that shows the first (left) on one side and the second
   * (right) on the other:
   *
   *   <section class="slide compare">
   *     <div class="compare-view" data-stops="50 12 88" data-sweep>
   *       <img src="before.jpg" data-label="original">
   *       <img src="after.jpg" data-label="jpeg, quality 10">
   *     </div>
   *   </section>
   *
   * data-stops sets the line in percent from the left, one value per build-up
   * step (step 0 first); one step forward glides to the next stop, a jump goes
   * there at once, and the print view and the export show each stop as a page.
   * In the talk the line can be dragged with the mouse at any time. data-sweep
   * lets the line run across the whole picture by itself when the slide is
   * reached, and again on R (data-sweep="6": six seconds instead of four).
   * The pieces may also be figures (a div with an SVG) instead of images.
   * The line is drawn in an SVG over the view, so the export's step check
   * does not count it as a jumping element. */
  const SVGNS = "http://www.w3.org/2000/svg";
  $$(".slide.compare .compare-view", deck).forEach((v) => {
    if (v._compare) return;
    const parts = $$(":scope > :not(.compare-line):not(.compare-label)", v);
    if (parts.length < 2) return;
    parts[0].classList.add("compare-before");
    parts[1].classList.add("compare-after");
    const stops = (v.dataset.stops || "50").trim().split(/[\s,]+/).map(Number).filter(isFinite);
    const labels = [0, 1].map((k) => {
      const t = parts[k].dataset.label;
      if (!t) return null;
      const l = document.createElement("span");
      l.className = "compare-label " + (k ? "after" : "before");
      l.textContent = t;
      v.appendChild(l);
      return l;
    });
    const svg = document.createElementNS(SVGNS, "svg");
    svg.setAttribute("class", "compare-line");
    svg.setAttribute("aria-hidden", "true");
    svg.innerHTML = '<line y1="0" y2="100%"/><svg y="50%" overflow="visible"><circle r="34"/>' +
                    '<path d="M -8 -12 L -18 0 L -8 12 M 8 -12 L 18 0 L 8 12"/></svg>';
    v.appendChild(svg);
    v.dataset.noAdvance = "1";
    v._compare = { stops: stops.length ? stops : [50], at: null, raf: 0, labels,
                   line: svg.querySelector("line"), knob: svg.querySelector("svg") };
    const s = v.closest(".slide");
    for (let k = 1; k < v._compare.stops.length; k++) s.insertAdjacentHTML("beforeend", `<span class="compare-step" data-step="${k}"></span>`);
    // drag: the line follows the pointer anywhere over the view
    const toPercent = (ev) => { const r = v.getBoundingClientRect(); return Math.max(0, Math.min(100, (ev.clientX - r.left) / r.width * 100)); };
    v.addEventListener("pointerdown", (ev) => {
      if (ev.button !== 0) return;
      cancelAnimationFrame(v._compare.raf);
      v.setPointerCapture(ev.pointerId);
      v.classList.add("dragging");
      compareAt(v, toPercent(ev));
      ev.preventDefault();
    });
    v.addEventListener("pointermove", (ev) => { if (v.classList.contains("dragging")) compareAt(v, toPercent(ev)); });
    const up = () => v.classList.remove("dragging");
    v.addEventListener("pointerup", up);
    v.addEventListener("pointercancel", up);
  });
  function compareAt(v, at) {
    const c = v._compare;
    c.at = at;
    v.style.setProperty("--at", at.toFixed(2) + "%");
    c.line.setAttribute("x1", at.toFixed(2) + "%");
    c.line.setAttribute("x2", at.toFixed(2) + "%");
    c.knob.setAttribute("x", at.toFixed(2) + "%");
    // a label fades when its side gets too narrow to hold it
    if (c.labels[0]) c.labels[0].classList.toggle("hidden", at < 18);
    if (c.labels[1]) c.labels[1].classList.toggle("hidden", at > 82);
  }
  // move the line along a path of stops; each leg takes time by its length
  function compareGlide(v, path, dur) {
    const c = v._compare;
    cancelAnimationFrame(c.raf);
    const from = c.at === null ? path[0] : c.at, pts = [from, ...path];
    const lens = pts.slice(1).map((p, k) => Math.abs(p - pts[k])), total = lens.reduce((a, b) => a + b, 0);
    if (!total) { compareAt(v, path[path.length - 1]); return; }
    const t0 = performance.now(), ease = (p) => p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
    const tick = (now) => {
      let d = Math.min(1, (now - t0) / dur) * total, k = 0;
      while (k < lens.length - 1 && d > lens[k]) { d -= lens[k]; k++; }
      const p = lens[k] ? Math.min(1, d / lens[k]) : 1;
      compareAt(v, pts[k] + (pts[k + 1] - pts[k]) * ease(p));
      if (now - t0 < dur && v.closest(".slide").classList.contains("current")) c.raf = requestAnimationFrame(tick);
      else compareAt(v, pts[pts.length - 1]);
    };
    c.raf = requestAnimationFrame(tick);
  }
  const compareStop = (v, step) => { const st = v._compare.stops; return st[Math.min(step, st.length - 1)]; };
  // how: "glide" (one step forward), "sweep" (across and back to the stop), else at once
  function compareStep(s, how) {
    $$(".compare-view", s).forEach((v) => {
      if (!v._compare) return;
      const to = compareStop(v, s._step);
      if (how === "sweep" && v.dataset.sweep !== undefined) {
        const secs = Number(v.dataset.sweep) || 4;
        compareAt(v, to);
        compareGlide(v, [100, 0, to], secs * 1000);
      } else if (how === "glide") compareGlide(v, [to], 700);
      else { cancelAnimationFrame(v._compare.raf); compareAt(v, to); }
    });
  }

  /* --- live polls ---------------------------------------------------------------
   * A slide <section class="slide poll" data-poll="id"> asks the audience a
   * question they answer on their phones; the slide shows a QR code, a session
   * code, a live counter and, one step later, the result as bars. It needs a
   * poll server (API: see SKILL.md), named on the deck: data-live-url, and a
   * series name for the deck's questions: data-live-series (default: the file
   * name), and optionally the module the deck belongs to: data-live-module.
   * Authoring is two elements, stagekit builds the rest:
   *
   *   <div class="poll-q">how many values can one byte hold?</div>
   *   <ol class="poll-opts"><li>8</li><li>16</li><li data-correct>256</li></ol>
   *
   * Step 0 opens the question (red "live", shimmering bars), step 1 closes it and
   * reveals the bars, step 2 (only if an option has data-correct) marks the right
   * answer green. Opening needs the server's admin key in this browser: key L
   * enters it (localStorage, never in a file), key C starts a new session. A
   * session (six-digit code) lasts for the day; the deck reports its whole
   * question set to the server when the key is present. Without a key the slide
   * only shows what the server has; in the print view nothing goes to the net.
   * Icon: Bootstrap Icons "bar-chart" 1.11.3 (MIT, (c) The Bootstrap Authors). */
  const ICON_POLL = '<svg class="icon" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M4 11H2v3h2zm5-4H7v7h2zm5-5v12h-2V2zm-2-1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1zM6 7a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1zm-5 4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1z"/></svg>';
  const live = (() => {
    const url = (deck.dataset.liveUrl || "").replace(/\/+$/, "");
    const series = deck.dataset.liveSeries || location.pathname.split("/").pop().replace(/\.html?$/, "") || "deck";
    const module = deck.dataset.liveModule || "";   // files the sessions under the newest course of this module
    const polls = $$(".slide.poll", deck);
    const KEY = "stagekit-live-key:" + url;
    const SESSION = "stagekit-live-session:" + url + ":" + series;
    const isPrint = params.has("print");
    const nb = " ";

    // build the slide from .poll-q and .poll-opts, before the steps are counted
    polls.forEach((s) => {
      if ($(".poll-side", s)) return;
      const opts = $(".poll-opts", s);
      const items = opts ? Array.from(opts.children) : [];
      const quiz = items.some((li) => li.hasAttribute("data-correct"));
      const box = document.createElement("div");
      box.className = "poll-opts";
      items.forEach((li) => {
        const row = document.createElement("div");
        row.className = "opt";
        if (li.hasAttribute("data-correct")) row.setAttribute("data-correct", "");
        row.innerHTML = `<span class="label">${li.innerHTML}</span><span class="track"><span class="fill"></span></span><span class="pct"></span>`;
        box.appendChild(row);
      });
      const main = document.createElement("div");
      main.className = "poll-main";
      const q = $(".poll-q", s);
      if (q) main.appendChild(q);
      main.appendChild(box);
      if (opts) opts.remove();
      if (!$("h2", s)) s.insertAdjacentHTML("afterbegin", `<h2>${ICON_POLL}${quiz ? "quick quiz" : "quick poll"}</h2>`);
      s.insertBefore(main, $(".notes", s));
      const host = url.replace(/^https?:\/\//, "");
      s.insertBefore(Object.assign(document.createElement("div"), { className: "poll-side", innerHTML:
        `<img class="qr" alt="QR code">` +
        `<div class="url keep-case">${host}/q</div><div class="code">${nb}</div>` +
        `<div class="live-badge"><span class="pulse"></span>live</div>` +
        `<div class="count">${nb}</div><div class="live-state">${nb}</div>` }), $(".notes", s));
      s.insertAdjacentHTML("beforeend", '<span data-step="1"></span>' + (quiz ? '<span data-step="2"></span>' : ""));
    });

    const key = () => { try { return localStorage.getItem(KEY) || ""; } catch (e) { return ""; } };
    const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
    function storedSession() {
      try { const x = JSON.parse(localStorage.getItem(SESSION) || "null"); return x && x.day === today() ? x.code : null; }
      catch (e) { return null; }
    }
    function forget() { try { localStorage.removeItem(SESSION); } catch (e) {} }

    async function call(path, body) {
      const opts = body === undefined ? { cache: "no-store" }
        : { method: "POST", headers: { "Content-Type": "application/json", "X-Admin-Key": key() },
            body: body === null ? undefined : JSON.stringify(body) };
      const r = await fetch(url + path, opts);
      if (!r.ok) {
        let detail = "";
        try { detail = (await r.json()).detail || ""; } catch (e) {}
        throw Object.assign(new Error(String(r.status)), { status: r.status, detail });
      }
      return r.json();
    }

    async function session(create) {
      let code = storedSession();
      if (code || !create || !key()) return code;
      code = (await call("/api/live/sessions", { series, title, module })).code;
      try { localStorage.setItem(SESSION, JSON.stringify({ code, day: today() })); } catch (e) {}
      return code;
    }

    function def(s) {
      const rows = $$(".poll-opts .opt", s);
      return {
        id: s.dataset.poll, kind: "single",
        question: ($(".poll-q", s) || { textContent: "" }).textContent.replace(/\s+/g, " ").trim(),
        options: rows.map((o) => $(".label", o).textContent.replace(/\s+/g, " ").trim()),
        correct: rows.map((o, i) => (o.hasAttribute("data-correct") ? i : -1)).filter((i) => i >= 0),
      };
    }

    function render(s, res, reveal) {
      const n = res ? res.total : 0;
      s.classList.toggle("open", !!res && res.state === "open" && !reveal);
      $(".count", s).textContent = res ? (n === 1 ? "1 answer" : n + " answers") : nb;
      $$(".poll-opts .opt", s).forEach((o, i) => {
        const share = n ? (res.counts[i] || 0) / n : 0;
        $(".fill", o).style.width = reveal ? (share * 100).toFixed(1) + "%" : "0";
        $(".pct", o).textContent = reveal && res ? Math.round(share * 100) + " %" : "";
      });
    }
    const state = (s, text) => { $(".live-state", s).textContent = text || nb; };
    function join(s, code) {
      const qr = $(".qr", s);
      const want = url ? url + "/api/live/" + (code ? code + "/" : "") + "qr.svg" : "";
      if (want && qr.getAttribute("src") !== want) qr.setAttribute("src", want);
      $(".code", s).textContent = code ? "code " + code : nb;
    }

    async function update(s, step) {
      clearInterval(s._liveTimer);
      s.classList.remove("open");
      s.classList.toggle("reveal", step >= 1);
      s.classList.toggle("right", step >= 2);
      if (!url) { state(s, "no poll server (data-live-url)"); return; }
      if (isPrint) { join(s, null); render(s, null, false); return; }
      const d = def(s), k = key();
      const still = () => s.classList.contains("current") && s._step === step;
      try {
        const code = await session(k && step === 0);
        join(s, code);
        if (!code) { state(s, k ? "no session yet" : "not live (press L)"); render(s, null, false); return; }
        const base = "/api/live/" + code;
        const results = () => call(base + "/results/" + encodeURIComponent(d.id));
        if (step === 0) {
          let res;
          if (k) {
            try { res = await call(base + "/open", d); }
            catch (e) {
              // the stored session is gone (deleted on the server): start a new one
              if (e.status === 404 && e.detail === "unknown session") { forget(); return update(s, step); }
              throw e;
            }
            state(s, "open · answer on your phone");
          } else { state(s, "not live (press L)"); res = await results().catch(() => null); }
          render(s, res, false);
          s._liveTimer = setInterval(async () => {
            if (!still()) { clearInterval(s._liveTimer); return; }
            try { render(s, await results(), false); if (k) state(s, "open · answer on your phone"); }
            catch (e) { state(s, e.status === 404 ? (k ? "not opened" : "not live (press L)") : "offline"); }
          }, 1000);
        } else {
          let res;
          if (k) { res = await call(base + "/close/" + encodeURIComponent(d.id), null); state(s, "closed"); }
          else res = await results().catch(() => null);
          render(s, res, true);
        }
      } catch (e) {
        state(s, e.status === 401 ? "wrong key (press L)" : "offline");
      }
    }

    async function syncSet() {
      if (!url || !polls.length || !key() || isPrint) return;
      try { await call("/api/live/sets", { series, title, questions: polls.map(def) }); } catch (e) { /* not critical */ }
    }

    function refresh() { const s = $(".slide.poll.current", deck); if (s) update(s, s._step || 0); }
    function askKey() {
      if (!url || !polls.length) return;
      const k = window.prompt(`live key: the admin key of ${url} (empty removes it)`, key());
      if (k === null) return;
      try { if (k.trim()) localStorage.setItem(KEY, k.trim()); else localStorage.removeItem(KEY); } catch (e) {}
      syncSet(); refresh();
    }
    function newSession() {
      if (!url || !polls.length) return;
      if (!window.confirm("start a new live session with a new code for this deck?")) return;
      forget(); refresh();
    }
    return { update, syncSet, askKey, newSession, active: polls.length > 0 };
  })();

  // --- animations (anim.js): every segment is a build-up step ------------------
  // Like a poll, an animation announces its steps with empty data-step markers,
  // so frames, PDF pages and the contact sheet count its keyframes.
  (window.stagekitAnim ? window.stagekitAnim.all : []).forEach((a) => {
    const fig = document.getElementById(a.figure), s = fig && fig.closest(".slide");
    if (!s) return;
    s._anims = (s._anims || []).concat(a);
    a.onchange = () => broadcast();
    for (let k = 0; k < a.steps; k++) s.insertAdjacentHTML("beforeend", `<span class="anim-step" data-step="${a.first + k}"></span>`);
  });

  // --- assign parts and location bars ----------------------------------------
  const slides = $$(".slide", deck);
  let currentPart = null;
  slides.forEach((s, i) => {
    s.dataset.index = String(i);
    if (s.classList.contains("part")) currentPart = s.dataset.part;
    if (currentPart && !s.dataset.part) s.dataset.part = currentPart;
    const isPlain = !s.classList.contains("title") && !s.classList.contains("agenda") && !s.classList.contains("part");
    if (isPlain && parts.length && s.dataset.part) {
      const k = parts.indexOf(s.dataset.part);
      const loc = document.createElement("div");
      loc.className = "location";
      const ticks = parts.map((_, j) => j ? `<span class="tick" style="left:${(j / parts.length) * 100}%"></span>` : "").join("");
      const segs = parts.map((p, j) => `<span class="seg" data-part="${p}" title="${p}" style="left:${(j / parts.length) * 100}%; width:${100 / parts.length}%"></span>`).join("");
      loc.innerHTML = `<div class="bar"><div class="fill" style="width:${((k + 1) / parts.length) * 100}%"></div>${ticks}${segs}</div><span>${s.dataset.part}</span>`;
      loc.dataset.noAdvance = "1";
      s.appendChild(loc);
    }
    if (s.dataset.part && partColors[s.dataset.part]) s.style.setProperty("--part-color", partColors[s.dataset.part]);
    // steps: collect the distinct step numbers of the slide
    const steps = new Set($$("[data-step]", s).map((e) => Number(e.dataset.step)));
    s._steps = Array.from(steps).sort((a, b) => a - b);
    s._step = 0;
  });

  // --- scaling ---------------------------------------------------------------
  const W = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--slide-w")) || 1920;
  const H = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--slide-h")) || 1080;
  function fit() {
    const scale = Math.min(window.innerWidth / W, window.innerHeight / H);
    document.documentElement.style.setProperty("--scale", String(scale));
  }
  window.addEventListener("resize", fit);
  fit();

  // --- frames: every build-up step is a slide of its own ------------------------
  // The numbering, the counter, the hash and the export all count frames, not
  // slides: a slide with two steps occupies three of them.
  const frames = [];
  slides.forEach((s, i) => { [0, ...s._steps].forEach((st) => frames.push({ slide: i, step: st })); });

  /* --- magic move: an element glides from one slide to the next -----------------
   * Two neighbouring slides that both hold an element with the same
   * data-morph="key" are linked. On → or ← the element travels from its place,
   * size and colours on the old slide to those on the new one; the rest of the
   * old slide fades out, the rest of the new one fades in a moment later. HTML
   * elements and groups in a drawing (<g data-morph="key">) both work, also
   * mixed: a box in a drawing can become the statement of the next slide.
   *
   * Only the live talk moves. A jump, a fresh load, the export and the PDF show
   * every slide as it is, so each slide stays a page of its own. ?morph=0 and
   * the system setting "reduce motion" switch it off. A slide without
   * data-morph behaves exactly as before. */
  const morph = (() => {
    const DUR = 700, FADE = 350, EASE = "cubic-bezier(.65, 0, .35, 1)";
    const ease = (p) => p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
    const off = params.get("morph") === "0" || params.has("print") || params.has("notes") ||
      !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
    const ID = { sx: 1, sy: 1, tx: 0, ty: 0 };
    let run = null, ready = false;

    const visible = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== "hidden"; };
    function keyed(s) {
      const m = new Map();
      $$("[data-morph]", s).forEach((e) => { if (!m.has(e.dataset.morph) && visible(e)) m.set(e.dataset.morph, e); });
      return m;
    }
    const paint = (v) => (!v || v === "none" || v.startsWith("url")) ? "rgba(0, 0, 0, 0)" : v;

    // where an element sits and how it looks, in slide pixels (1920 x 1080)
    function look(slide, e) {
      const sr = slide.getBoundingClientRect(), k = sr.width / W, r = e.getBoundingClientRect();
      const l = { x: (r.left - sr.left) / k, y: (r.top - sr.top) / k, w: r.width / k, h: r.height / k, svg: e instanceof SVGElement };
      if (!l.svg) {
        const cs = getComputedStyle(e);
        return Object.assign(l, { font: parseFloat(cs.fontSize), color: cs.color, bg: cs.backgroundColor,
          border: cs.borderTopColor, bw: parseFloat(cs.borderTopWidth) || 0, radius: parseFloat(cs.borderTopLeftRadius) || 0 });
      }
      // a group in a drawing: the colours of its first shape and its first text
      const ctm = e.getScreenCTM(), s = ctm ? Math.hypot(ctm.a, ctm.b) / k : 1;
      const shape = $("rect, circle, ellipse, polygon, path", e), text = $("text", e);
      const sc = shape && getComputedStyle(shape), tc = text && getComputedStyle(text);
      return Object.assign(l, { font: tc ? parseFloat(tc.fontSize) * s : 32, color: tc ? paint(tc.fill) : "rgba(0, 0, 0, 0)",
        bg: sc ? paint(sc.fill) : "rgba(0, 0, 0, 0)", border: sc ? paint(sc.stroke) : "rgba(0, 0, 0, 0)",
        bw: sc ? (parseFloat(sc.strokeWidth) || 0) * s : 0, radius: shape && shape.getAttribute("rx") ? parseFloat(shape.getAttribute("rx")) * s : 0 });
    }
    const clear = (c) => !c || c === "transparent" || /rgba\(.*,\s*0\)$/.test(c);

    // The stand-ins: an element is split into its frame (fill, border) and its
    // text. The frame travels from box to box, the text from the middle of the
    // old text to the middle of the new one, growing or shrinking on the way;
    // so the words never sit in a corner of a box, and a box can fade away
    // around a text that stays.
    function add(on, cls, style) {
      const g = document.createElement("div");
      g.className = "morph-ghost " + cls;
      Object.assign(g.style, { position: "absolute", margin: "0", padding: "0", boxSizing: "border-box", pointerEvents: "none" }, style);
      on.appendChild(g);
      run.undo.push(() => g.remove());
      return g;
    }
    const frameKey = (l) => ({ left: l.x + "px", top: l.y + "px", width: l.w + "px", height: l.h + "px",
      backgroundColor: l.bg, borderColor: l.border, borderWidth: l.bw + "px", borderRadius: l.radius + "px" });
    const framed = (l) => !clear(l.bg) || (l.bw > 0 && !clear(l.border));
    function frameGhost(on, lo, ln) {
      const a = framed(lo), b = framed(ln);
      if (!a && !b) return;
      // a frame that exists on one side only keeps its look and fades instead
      // of thinning out: a hairline that lingers around a text reads as a mistake
      const src = a ? lo : ln, dst = b ? ln : lo;
      const g = add(on, "morph-frame", { borderStyle: "solid", zIndex: "20" });
      run.anims.push(g.animate([frameKey(Object.assign({}, src, { x: lo.x, y: lo.y, w: lo.w, h: lo.h })),
                                frameKey(Object.assign({}, dst, { x: ln.x, y: ln.y, w: ln.w, h: ln.h }))], { duration: DUR, easing: EASE, fill: "both" }));
      if (a !== b) run.anims.push(g.animate(a ? [{ opacity: 1 }, { opacity: 0, offset: 0.55 }, { opacity: 0 }]
                                              : [{ opacity: 0 }, { opacity: 0, offset: 0.45 }, { opacity: 1 }], { duration: DUR, easing: "linear", fill: "both" }));
    }
    // the text of an element and where it stands, in slide pixels
    function text(slide, e, l) {
      const sr = slide.getBoundingClientRect(), k = sr.width / W;
      const t = l.svg ? $("text", e) : e;
      if (!t) return null;
      let r;
      if (l.svg) r = t.getBoundingClientRect();
      else { const range = document.createRange(); range.selectNodeContents(t); r = range.getBoundingClientRect(); }
      if (!r.width) return null;
      const cs = getComputedStyle(t);
      const lines = l.svg ? Math.max(1, $$("tspan", t).length) : Math.round(r.height / (l.font * 1.15)) || 1;
      return { e: t, svg: l.svg, cx: (r.left - sr.left + r.width / 2) / k, cy: (r.top - sr.top + r.height / 2) / k, w: r.width / k,
        font: l.font, color: l.color, lines, cs, words: t.textContent.replace(/\s+/g, " ").trim() };
    }
    const textKey = (t, w) => ({ left: t.cx + "px", top: t.cy + "px", fontSize: t.font + "px", color: t.color, ...(w ? { width: t.w + "px" } : {}) });
    function textGhost(on, own, a, b, fade) {
      const multi = own.lines > 1 && !own.svg;
      const g = add(on, "morph-text", { transform: "translate(-50%, -50%)", zIndex: "21", lineHeight: "1.15",
        fontFamily: own.cs.fontFamily, fontWeight: own.cs.fontWeight, fontStyle: own.cs.fontStyle,
        letterSpacing: own.cs.letterSpacing, textTransform: own.cs.textTransform,
        whiteSpace: multi ? "normal" : "pre", textAlign: own.svg ? "center" : own.cs.textAlign });
      if (own.svg) g.textContent = $$("tspan", own.e).length ? $$("tspan", own.e).map((s) => s.textContent).join("\n") : own.e.textContent;
      else { g.innerHTML = own.e.innerHTML; $$("[id]", g).forEach((n) => n.removeAttribute("id")); }
      run.anims.push(g.animate([textKey(a, multi), textKey(b, multi)], { duration: DUR, easing: EASE, fill: "both" }));
      if (fade) run.anims.push(g.animate(fade, { duration: DUR, easing: "linear", fill: "both" }));
    }

    // the transform, in the parent's coordinates, that lays a group's own box onto another box
    function mapping(slide, e, self, target) {
      const sr = slide.getBoundingClientRect(), k = sr.width / W;
      const inv = e.parentNode.getScreenCTM().inverse();
      const user = (x, y) => new DOMPoint(sr.left + x * k, sr.top + y * k).matrixTransform(inv);
      const u0 = user(self.x, self.y), u1 = user(self.x + self.w, self.y + self.h);
      const v0 = user(target.x, target.y), v1 = user(target.x + target.w, target.y + target.h);
      const sx = (v1.x - v0.x) / ((u1.x - u0.x) || 1), sy = (v1.y - v0.y) / ((u1.y - u0.y) || 1);
      return { sx, sy, tx: v0.x - sx * u0.x, ty: v0.y - sy * u0.y };
    }
    // a group moves through its transform attribute (as in anim.js), in front of what it had
    // arc: a sideways lift in the parent's units at the middle of the way, so
    // that groups changing places pass each other instead of through each other
    function tween(e, a, b, fade, arc) {
      const base = e.getAttribute("transform") || "", op = e.style.opacity;
      run.undo.push(() => { if (base) e.setAttribute("transform", base); else e.removeAttribute("transform"); e.style.opacity = op; });
      const at = (p) => {
        // up first, then across, then down: the neighbour is passed early in the way
        const q = ease(p), L = (u, v) => +(u + (v - u) * q).toFixed(4), lift = arc ? arc * Math.min(1, 3 * Math.sin(Math.PI * q)) : 0;
        e.setAttribute("transform", `matrix(${L(a.sx, b.sx)} 0 0 ${L(a.sy, b.sy)} ${L(a.tx, b.tx)} ${+(L(a.ty, b.ty) + lift).toFixed(4)}) ${base}`.trim());
        if (fade) { const f = Math.min(1, p / 0.6); e.style.opacity = String(fade === "in" ? f : 1 - f); }
      };
      at(0);
      run.tweens.push(at);
    }
    function hide(e) { const v = e.style.visibility; e.style.visibility = "hidden"; run.undo.push(() => { e.style.visibility = v; }); }

    // what fades in on the new slide: everything except the linked elements,
    // the location bar and a heading that reads the same on both slides
    function rest(root, keep, heading) {
      const out = [];
      Array.from(root.children).forEach((c) => {
        if (c.matches(".location, .notes, .morph-ghost, .anim-step, .compare-step") || keep.includes(c)) return;
        if (c.tagName === "H2" && c.textContent.trim() === heading) return;
        if (keep.some((k) => c.contains(k))) out.push(...rest(c, keep, heading)); else out.push(c);
      });
      return out;
    }

    function finish() {
      if (!run) return;
      const r = run; run = null;
      clearTimeout(r.timer); cancelAnimationFrame(r.raf);
      r.anims.forEach((a) => a.cancel());
      r.undo.reverse().forEach((f) => f());
    }

    function play(from, to) {
      finish();
      if (off || !ready || !from || from === to) return;
      // the old slide stays visible underneath while it fades out
      Object.assign(from.style, { display: "block", zIndex: "1", pointerEvents: "none" });
      const A = keyed(from), B = keyed(to);
      const pairs = [...B.keys()].filter((k) => A.has(k)).map((k) => [A.get(k), B.get(k)]);
      if (!pairs.length) { Object.assign(from.style, { display: "", zIndex: "", pointerEvents: "" }); return; }
      run = { anims: [], tweens: [], undo: [], timer: 0, raf: 0 };
      const toBg = to.style.background;
      Object.assign(to.style, { zIndex: "2", background: "transparent" });
      run.undo.push(() => { Object.assign(from.style, { display: "", zIndex: "", pointerEvents: "" }); Object.assign(to.style, { zIndex: "", background: toBg }); });
      // the old words leave before the new ones come, so the two never stand
      // half visible on top of each other
      const fadeOut = [{ opacity: 1 }, { opacity: 0, offset: 0.35 }, { opacity: 0 }];
      const fadeIn = [{ opacity: 0 }, { opacity: 0, offset: 0.3 }, { opacity: 1, offset: 0.65 }, { opacity: 1 }];

      pairs.forEach(([o, n]) => {
        const lo = look(from, o), ln = look(to, n);
        // two groups of drawings: the group itself moves, as in anim.js
        // two groups of drawings: the group itself moves, as in anim.js. One
        // that overtakes others on a row goes over the top when it moves right
        // and underneath when it moves left, as in the sorting example
        if (lo.svg && ln.svg) {
          const dx = ln.x - lo.x, dy = ln.y - lo.y;
          let arc = 0;
          if (Math.abs(dx) > ln.w * 1.2 && Math.abs(dy) < ln.h / 2) {
            const ctm = n.parentNode.getScreenCTM(), k = to.getBoundingClientRect().width / W;
            arc = (dx > 0 ? -1 : 1) * ln.h * 1.2 * (ctm ? k / ctm.d : 1);
          }
          hide(o); tween(n, mapping(to, n, ln, lo), ID, null, arc);
          return;
        }
        // otherwise stand-ins for frame and text take over both elements
        const to_ = text(to, n, ln), from_ = text(from, o, lo);
        frameGhost(to, lo, ln);
        if (from_ && to_ && from_.words === to_.words && !from_.svg && !to_.svg) textGhost(to, to_, from_, to_, null);
        else {
          if (from_) textGhost(to, from_, from_, to_ || from_, fadeOut);
          if (to_) textGhost(to, to_, from_ || to_, to_, fadeIn);
        }
        hide(o); hide(n);
      });

      run.anims.push(from.animate([{ opacity: 1 }, { opacity: 0 }], { duration: FADE, easing: "ease-out", fill: "both" }));
      const heading = (($("h2", from) || {}).textContent || "").trim();
      rest(to, pairs.map((p) => p[1]), heading).forEach((e) => {
        run.anims.push(e.animate([{ opacity: 0 }, { opacity: 0, offset: 0.55 }, { opacity: 1 }], { duration: DUR + 250, easing: "ease-out", fill: "both" }));
      });

      const t0 = performance.now(), r = run;
      const tick = (now) => {
        const p = Math.min(1, (now - t0) / DUR);
        r.tweens.forEach((f) => f(p));
        if (p < 1 && run === r) r.raf = requestAnimationFrame(tick);
      };
      r.raf = requestAnimationFrame(tick);
      r.timer = setTimeout(() => { if (run === r) finish(); }, DUR + 250);
    }
    // a still of a running move at progress p (0..1), for checking it frame by frame
    function seek(p) {
      if (!run) return false;
      clearTimeout(run.timer); cancelAnimationFrame(run.raf);
      run.anims.forEach((a) => { a.pause(); a.currentTime = p * DUR; });
      run.tweens.forEach((f) => f(p));
      return true;
    }
    return { play, finish, seek, start() { ready = true; } };
  })();

  // --- navigation --------------------------------------------------------------
  let index = 0;      // slide index
  let frame = 0;      // frame index
  const counter = document.createElement("div");
  counter.className = "counter";
  document.body.appendChild(counter);

  function applySteps(s, how, fresh) {
    $$("[data-step]", s).forEach((e) => e.classList.toggle("shown", Number(e.dataset.step) <= s._step));
    markNow(s);
    compareStep(s, how);
    teachingStep(s);
    checkStep(s, how, fresh);
  }

  function showFrame(f) {
    const before = frame;
    frame = Math.max(0, Math.min(frames.length - 1, f));
    const fr = frames[frame];
    const sameSlide = fr.slide === index && slides[index].classList.contains("current");
    morph.finish();
    // magic move only for one step to the neighbouring slide, never on a jump
    const morphFrom = !sameSlide && Math.abs(fr.slide - index) === 1 && Math.abs(frame - before) === 1 ? slides[index] : null;
    if (!sameSlide && slides[index]._anims) slides[index]._anims.forEach((a) => a.stop());
    index = fr.slide;
    const s = slides[index];
    s._step = fr.step;
    if (!sameSlide) slides.forEach((x, k) => x.classList.toggle("current", k === index));
    // a compare line glides one step forward and sweeps on arrival; else it is there at once
    const forward = ready && !reducedMotion && frame === before + 1;
    applySteps(s, forward ? (sameSlide ? "glide" : "sweep") : null, !sameSlide);
    counter.textContent = `${frame + 1} / ${frames.length}`;
    history.replaceState(null, "", "#" + (frame + 1));
    if (!sameSlide && s.dataset.onShow && typeof window[s.dataset.onShow] === "function") window[s.dataset.onShow](s, s._step);
    else if (sameSlide && s.dataset.onStep && typeof window[s.dataset.onStep] === "function") window[s.dataset.onStep](s, s._step);
    if (s.classList.contains("poll")) live.update(s, s._step);
    // an animation plays one frame forward on the same slide, and with
    // back: "play" one frame back as well; any other way here (a jump, a fresh
    // load) shows its keyframe at once
    if (s._anims) {
      const how = !sameSlide ? null : frame === before + 1 ? "play" : frame === before - 1 ? "back" : null;
      s._anims.forEach((a) => a.frame(s._step, how));
      if (!sameSlide && s._step === 0 && s._anims.some((a) => a.autostart)) {
        const here = frame;
        setTimeout(() => { if (frame === here) next(); }, 400);
      }
    }
    if (morphFrom) morph.play(morphFrom, s);
    if (ready && !sameSlide && frame === before + 1 && s.classList.contains("number") && !reducedMotion) countUp(s);
    broadcast();
  }
  const frameOf = (slideIndex, step) => Math.max(0, frames.findIndex((fr) => fr.slide === slideIndex && fr.step === (step === undefined ? 0 : step)));
  function show(i, step) { showFrame(frameOf(Math.max(0, Math.min(slides.length - 1, i)), step === 99 ? slides[i]._steps[slides[i]._steps.length - 1] || 0 : step)); }
  function next() {
    // a running animation takes the key first: skip to its next stop, or go on after a hold
    const s = slides[index];
    if (s._anims && s._anims.some((a) => a.next())) { broadcast(); return; }
    if (frame < frames.length - 1) showFrame(frame + 1);
  }
  function prev() {
    // an animation running backwards takes ← first and jumps to its keyframe
    const s = slides[index];
    if (s._anims && s._anims.some((a) => a.prev && a.prev())) { broadcast(); return; }
    if (frame > 0) showFrame(frame - 1);
  }
  // R: the animations of this slide from the start (keyframe 0, then play on),
  // and a compare line with data-sweep runs across once more
  function replay() {
    const s = slides[index];
    if (s.classList.contains("compare")) compareStep(s, "sweep");
    if (!s._anims) return;
    showFrame(frameOf(index, 0));
    next();
  }

  // --- notes window ------------------------------------------------------------
  const channel = ("BroadcastChannel" in window) ? new BroadcastChannel("stagekit-" + location.pathname) : null;
  function notesOf(s) { const n = s && $(".notes", s); return n ? n.innerHTML : ""; }
  function headingOf(s) {
    if (!s) return "";
    const h = $("h2", s); if (h) return h.textContent;
    if (s.classList.contains("title")) return title;
    if (s.classList.contains("agenda")) return "agenda";
    if (s.classList.contains("part")) return "part: " + s.dataset.part;
    const st = $(".statement", s); return st ? st.textContent : "";
  }
  function broadcast() {
    if (!channel) return;
    channel.postMessage({ index: frame, total: frames.length, step: slides[index]._step,
      anim: slides[index]._anims ? slides[index]._anims.map((a) => a.status()).join(" · ") : "",
      heading: headingOf(slides[index]), notes: notesOf(slides[index]),
      nextHeading: headingOf(slides[index + 1]), nextNotes: notesOf(slides[index + 1]) });
  }
  function openNotes() {
    const w = window.open(location.pathname + "?notes", "stagekit-notes", "width=900,height=700");
    if (w) setTimeout(broadcast, 800);
  }

  if (params.has("notes")) {
    document.body.className = "notes-view";
    document.body.innerHTML = `<div class="nv-clock" id="nv-clock"></div><h1 id="nv-h">notes</h1><div class="nv-current" id="nv-c">waiting for the deck…</div><div class="nv-next"><h1 id="nv-nh">next</h1><div id="nv-n"></div></div>`;
    if (channel) channel.onmessage = (ev) => {
      const m = ev.data;
      $("#nv-h").textContent = `${m.index + 1} / ${m.total} · ${m.heading}${m.step ? " · step " + m.step : ""}${m.anim ? " · " + m.anim : ""}`;
      $("#nv-c").innerHTML = m.notes || "<span style='color:#4a5259'>(no notes)</span>";
      $("#nv-nh").textContent = "next: " + (m.nextHeading || "end");
      $("#nv-n").innerHTML = m.nextNotes || "";
    };
    setInterval(() => { $("#nv-clock").textContent = new Date().toLocaleTimeString(); }, 1000);
    return;
  }

  /* --- copy buttons on code blocks -------------------------------------------
   * Every .code block gets a small button with a copy icon in its top right
   * corner: one click puts the code on the clipboard, so the audience can take
   * it straight into their editor. The icon turns into a check mark for a
   * moment. Lines written as <div>s are joined with line breaks. The button is
   * hidden in the print view (and so in the PDF). Icons: Bootstrap Icons
   * "copy" and "check2" 1.11.3 (MIT, (c) The Bootstrap Authors). */
  const ICON_COPY = '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M4 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zm2-1a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1zM2 5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1h1v1a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1v1z"/></svg>';
  const ICON_CHECK = '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0"/></svg>';
  // Rows keep their build steps and indentation. Older trace decks used list items.
  const codeRows = (block) => $$(":scope > div, :scope.trace-code > li", block);
  function codeText(block) {
    const lines = codeRows(block);
    if (lines.length) return lines.map((l) => l.textContent).join("\n");
    const clone = block.cloneNode(true);
    clone.querySelectorAll(".copy, .show").forEach((b) => b.remove());
    return clone.textContent.replace(/^\n+|\s+$/g, "");
  }
  // Colour only marked blocks. Match against the complete source so a string
  // spanning several rows stays a string. Write spans into existing text
  // nodes, preserving the author's build steps, manual emphasis and literal text.
  const syntaxKeywords = {
    python: new Set("False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield".split(" ")),
    r: new Set("if else repeat while function for in next break TRUE FALSE NULL Inf NaN NA NA_integer_ NA_real_ NA_complex_ NA_character_".split(" ")),
  };
  function highlightCode(block, language) {
    const keywords = syntaxKeywords[language];
    if (!(keywords instanceof Set)) return;
    const nodes = [];
    let source = "";
    const rows = codeRows(block);
    (rows.length ? rows : [block]).forEach((row, i) => {
      if (i) source += "\n";
      const walker = document.createTreeWalker(row, NodeFilter.SHOW_TEXT);
      for (let node; (node = walker.nextNode());) {
        nodes.push({ node, start: source.length });
        source += node.data;
      }
    });
    const words = language === "python"
      ? /(?<comment>#[^\n]*)|(?<string>(?:\b(?:[bB][rR]?|[rR][bBfF]?|[fF][rR]?|[uU]))?(?:"""(?:\\[\s\S]|(?!""")[^\\])*?(?:"""|$)|'''(?:\\[\s\S]|(?!''')[^\\])*?(?:'''|$)|"(?:\\[\s\S]|[^"\\\n])*"|'(?:\\[\s\S]|[^'\\\n])*'))|(?<number>\b(?:0[xX][\da-fA-F_]+|0[bB][01_]+|0[oO][0-7_]+)|(?:\b\d[\d_]*(?:\.[\d_]*)?|\.\d[\d_]*)(?:[eE][+-]?[\d_]+)?[jJ]?)|(?<name>[\p{L}_][\p{L}\p{N}_]*)/gu
      : /(?<comment>#[^\n]*)|(?<string>"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|`(?:\\[\s\S]|[^`\\])*`)|(?<number>\b0[xX][\da-fA-F]+|(?:\b\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?[Li]?)|(?<name>[\p{L}._][\p{L}\p{N}._]*)/gu;
    const tokens = [];
    for (const match of source.matchAll(words)) {
      const { comment, string, number } = match.groups;
      const end = match.index + match[0].length;
      let kind;
      if (comment !== undefined) kind = "comment";
      else if (string !== undefined) kind = "string";
      else if (number !== undefined) kind = "number";
      else if (keywords.has(match[0])) kind = "keyword";
      else if (/^[ \t]*\(/.test(source.slice(end))) kind = "call";
      if (kind) tokens.push({ start: match.index, end, kind });
    }
    let first = 0;
    for (const { node, start } of nodes) {
      const value = node.data, end = start + value.length;
      while (first < tokens.length && tokens[first].end <= start) first++;
      if (!value || first === tokens.length || tokens[first].start >= end || node.parentElement.closest(".hl, .kw, .num")) continue;
      const fragment = document.createDocumentFragment();
      let offset = 0;
      for (let i = first; i < tokens.length && tokens[i].start < end; i++) {
        const token = tokens[i];
        const left = Math.max(0, token.start - start), right = Math.min(value.length, token.end - start);
        fragment.append(value.slice(offset, left));
        const span = document.createElement("span");
        span.className = "syntax-" + token.kind;
        span.textContent = value.slice(left, right);
        fragment.append(span);
        offset = right;
      }
      fragment.append(value.slice(offset));
      node.replaceWith(fragment);
    }
  }
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    // file:// and plain http: the old way, via a hidden text field
    const area = document.createElement("textarea");
    area.value = text; area.style.position = "fixed"; area.style.opacity = "0";
    document.body.appendChild(area); area.select();
    try { document.execCommand("copy"); } finally { area.remove(); }
    return Promise.resolve();
  }
  document.querySelectorAll(".slide .code").forEach((block) => {
    highlightCode(block, block.dataset.language);
    const b = document.createElement("button");
    b.className = "copy"; b.title = "copy"; b.setAttribute("aria-label", "copy code");
    b.dataset.noAdvance = "1"; b.innerHTML = ICON_COPY;
    b.addEventListener("click", (ev) => {
      ev.stopPropagation();
      copyText(codeText(block)).then(() => {
        b.innerHTML = ICON_CHECK; b.classList.add("done");
        setTimeout(() => { b.innerHTML = ICON_COPY; b.classList.remove("done"); }, 1500);
      });
      b.blur();
    });
    block.appendChild(b);
  });

  /* --- show-code button on figures ----------------------------------------------
   * A figure made from code carries that code as an invisible .code.figcode block
   * (stagekit.css). Next to its copy button sits a second button with an eye: it
   * lays the code over the slide in a slightly transparent window with a close
   * button. Escape, the close button, the eye again or moving to another frame
   * closes it. Hidden in the print view. Icons: Bootstrap Icons "eye" and "x-lg"
   * 1.11.3 (MIT, (c) The Bootstrap Authors). */
  const ICON_EYE = '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8M1.173 8a13 13 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5s3.879 1.168 5.168 2.457A13 13 0 0 1 14.828 8q-.086.13-.195.288c-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5s-3.879-1.168-5.168-2.457A13 13 0 0 1 1.172 8z"/><path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5M4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0"/></svg>';
  const ICON_CLOSE = '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8z"/></svg>';
  const closeOverlays = () => document.querySelectorAll(".code-overlay").forEach((o) => o.remove());
  document.querySelectorAll(".slide .code.figcode").forEach((block) => {
    const b = document.createElement("button");
    b.className = "show"; b.title = "show code"; b.setAttribute("aria-label", "show code");
    b.dataset.noAdvance = "1"; b.innerHTML = ICON_EYE;
    b.addEventListener("click", (ev) => {
      ev.stopPropagation(); b.blur();
      const slide = block.closest(".slide");
      if (slide.querySelector(".code-overlay")) { closeOverlays(); return; }
      const box = document.createElement("div");
      box.className = "code-overlay"; box.dataset.noAdvance = "1";
      const code = document.createElement("div");
      code.className = "overlay-code"; code.textContent = codeText(block);
      highlightCode(code, block.dataset.language);
      const x = document.createElement("button");
      x.className = "close"; x.title = "close"; x.setAttribute("aria-label", "close");
      x.dataset.noAdvance = "1"; x.innerHTML = ICON_CLOSE;
      x.addEventListener("click", (e) => { e.stopPropagation(); closeOverlays(); });
      box.append(code, x);
      slide.appendChild(box);
    });
    block.appendChild(b);
  });

  // --- print view --------------------------------------------------------------
  if (params.has("print")) {
    // Jeder Frame wird eine Seite; eine Folie mit Aufbau wird je Schritt geklont.
    // Die Reihenfolge ist das Entscheidende: erst den Schritt setzen und zeichnen
    // lassen, DANN klonen. Die Zeichenfunktionen schreiben ueber getElementById in
    // ihr Element, und ein Klon traegt dieselbe id; getElementById liefert immer
    // den ersten Treffer. Wer zuerst klont und danach zeichnet, bekommt deshalb
    // leere Zeichnungen in allen Klonen. So geklont, traegt jede Seite das SVG
    // ihres eigenen Schritts, und ?print gibt den Vortrag wieder -- auch als PDF
    // aus Chrome (tools/export.py), das dadurch Vektor statt Pixel liefert.
    // print-clone-ids: Marker fuer tools/export.py -- nur mit dieser Fassung
    // stimmt der Vektor-Export; aeltere Kopien bekommen den Bildweg.
    document.body.classList.add("print");
    slides.forEach((s) => {
      const steps = [0, ...s._steps];
      steps.forEach((st, k) => {
        s._step = st;
        applySteps(s);
        // dieselbe Hook-Wahl wie beim Vortrag: onShow beim Betreten, onStep beim Schritt
        const hook = k === 0 ? s.dataset.onShow : (s.dataset.onStep || s.dataset.onShow);
        if (hook && typeof window[hook] === "function") window[hook](s, st);
        if (s.classList.contains("poll")) live.update(s, st);
        if (s._anims) s._anims.forEach((a) => a.frame(st, false));   // the keyframe of this step
        const el = k === steps.length - 1 ? s : s.cloneNode(true);
        if (el !== s) {
          // Der Klon wird VOR dem Original eingehaengt und traegt sonst dessen
          // ids. getElementById liefert den ersten Treffer im Dokument, und das
          // waere ab dann der Klon: Die Zeichnung des naechsten Schritts landete
          // in der Seite davor. Ein Klon wird nie wieder nachgeschlagen, also
          // verliert er seine ids.
          el.removeAttribute("id");
          el.querySelectorAll("[id]").forEach((e) => e.removeAttribute("id"));
          s.parentNode.insertBefore(el, s);
        }
        el.classList.add("current");
      });
    });
    counter.classList.add("hidden");
    return;
  }

  // --- the location bar jumps to a part ------------------------------------------
  document.addEventListener("click", (ev) => {
    const seg = ev.target.closest(".location .seg");
    if (!seg) return;
    const target = slides.findIndex((s) => s.classList.contains("part") && s.dataset.part === seg.dataset.part);
    if (target >= 0) show(target, 0);
  });

  /* --- cursor modes (key M) -------------------------------------------------------
   * M cycles: cursor -> laser pointer -> cursor hidden -> cursor. "laser" hides the
   * mouse cursor and lets a red, softly glowing dot follow the mouse; "hidden"
   * shows no cursor at all, for a presenter with its own digital laser pointer.
   * A short note names the new mode. The mode is remembered per deck in this
   * browser (localStorage, a convenience only). Over an embedded iframe the
   * browser shows the iframe's own cursor; a page cannot change that. The print
   * view and the export never show either.
   * In laser mode, holding the mouse button draws a red trail instead of
   * selecting text; it stays for a moment and then fades slowly, to highlight
   * something for a short while. Changing the slide clears it, and a drag never
   * counts as a click (no slide change at the edges). */
  const cursor = (() => {
    const off = { cycle() {}, clear() {} };
    if (new URLSearchParams(location.search).has("print")) return off;
    const modes = ["normal", "laser", "hidden"];
    const names = { normal: "cursor", laser: "laser pointer", hidden: "cursor hidden" };
    const store = "stagekit-cursor:" + location.pathname;
    const dot = document.createElement("div"); dot.className = "laser"; dot.setAttribute("aria-hidden", "true");
    const note = document.createElement("div"); note.className = "mode-note";
    document.body.append(dot, note);
    let mode = "normal", timer;
    function set(m, quiet) {
      mode = m;
      document.documentElement.dataset.cursor = m;
      try { localStorage.setItem(store, m); } catch (e) { /* private window: not remembered */ }
      if (quiet) return;
      note.textContent = names[m];
      note.classList.add("on");
      clearTimeout(timer);
      timer = setTimeout(() => note.classList.remove("on"), 1400);
    }
    document.addEventListener("mousemove", (ev) => {
      dot.style.transform = `translate(${ev.clientX}px, ${ev.clientY}px)`;
      dot.classList.add("seen");
    });
    document.documentElement.addEventListener("mouseleave", () => dot.classList.remove("seen"));

    // --- the trail: drawn while the button is held, fades after HOLD ms over FADE ms
    const HOLD = 1500, FADE = 2000;
    const canvas = document.createElement("canvas"); canvas.className = "laser-trail"; canvas.setAttribute("aria-hidden", "true");
    document.body.append(canvas);
    const ctx = canvas.getContext("2d");
    let strokes = [], drawing = null, dragged = false, raf = 0;
    function fit() {
      const r = window.devicePixelRatio || 1;
      canvas.width = Math.round(innerWidth * r); canvas.height = Math.round(innerHeight * r);
      ctx.setTransform(r, 0, 0, r, 0, 0);
    }
    fit(); window.addEventListener("resize", fit);
    const red = () => getComputedStyle(document.documentElement).getPropertyValue("--red").trim() || "red";
    function paint() {
      const now = performance.now();
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      // a stroke lives from its last point on; while held, it never fades
      strokes = strokes.filter((s) => s === drawing || now - s.end < HOLD + FADE);
      const col = red();
      ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = col;
      ctx.shadowColor = col; ctx.shadowBlur = 14;
      for (const s of strokes) {
        const age = s === drawing ? 0 : now - s.end;
        ctx.globalAlpha = age < HOLD ? 1 : Math.max(0, 1 - (age - HOLD) / FADE);
        ctx.lineWidth = 6;
        ctx.beginPath();
        s.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        if (s.pts.length === 1) ctx.lineTo(s.pts[0][0] + 0.1, s.pts[0][1]);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      raf = strokes.length ? requestAnimationFrame(paint) : 0;
    }
    const kick = () => { if (!raf) raf = requestAnimationFrame(paint); };
    document.addEventListener("mousedown", (ev) => {
      if (mode !== "laser" || ev.button !== 0) return;
      if (ev.target.closest("a, button, input, textarea, select")) return;
      ev.preventDefault();                                // no text selection
      drawing = { pts: [[ev.clientX, ev.clientY]], end: performance.now() };
      strokes.push(drawing); dragged = false; kick();
    });
    document.addEventListener("mousemove", (ev) => {
      if (!drawing) return;
      drawing.pts.push([ev.clientX, ev.clientY]);
      drawing.end = performance.now();
      // more than a few pixels from the start: a drag, not a click
      const [x0, y0] = drawing.pts[0];
      if (Math.hypot(ev.clientX - x0, ev.clientY - y0) > 6) dragged = true;
      kick();
    });
    document.addEventListener("mouseup", () => {
      if (!drawing) return;
      drawing.end = performance.now(); drawing = null; kick();
    });
    // a drag is not a click: keep it from turning the slide
    document.addEventListener("click", (ev) => {
      if (dragged) { dragged = false; ev.stopImmediatePropagation(); ev.preventDefault(); }
    }, true);

    let saved = "normal";
    try { saved = localStorage.getItem(store) || "normal"; } catch (e) { /* ignore */ }
    set(modes.includes(saved) ? saved : "normal", true);
    return {
      cycle() { set(modes[(modes.indexOf(mode) + 1) % modes.length]); },
      clear() { strokes = []; drawing = null; ctx.clearRect(0, 0, innerWidth, innerHeight); },
    };
  })();

  /* --- jump by number: digits, then Enter --------------------------------------
   * As in Google Slides: "45" and Enter goes to frame 45, "1" and Enter to the
   * start. The number is the one in the counter (frames, like #45). While
   * digits are typed the counter shows them; Escape, any other key or three
   * seconds without a key drop them. */
  const jump = (() => {
    let digits = "", timer = 0;
    function show() {
      counter.classList.toggle("typing", digits !== "");
      counter.textContent = digits ? `→ ${digits}` : `${frame + 1} / ${frames.length}`;
    }
    function clear() { clearTimeout(timer); digits = ""; show(); }
    function type(d) {
      digits = (digits + d).replace(/^0+(?=\d)/, "").slice(0, 4);
      clearTimeout(timer); timer = setTimeout(clear, 3000);
      show();
    }
    function back() { digits = digits.slice(0, -1); show(); }
    function go() { const n = Number(digits); clear(); showFrame(Math.max(1, Math.min(frames.length, n)) - 1); }
    return { type, back, go, clear, get active() { return digits !== ""; } };
  })();

  // --- keys ----------------------------------------------------------------------
  document.addEventListener("keydown", (ev) => {
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "IFRAME") return;
    // writable boxes on a slide (contenteditable) take their keys, too
    if (document.activeElement && document.activeElement.isContentEditable) return;
    if (/^[0-9]$/.test(ev.key) && !ev.ctrlKey && !ev.metaKey && !ev.altKey) { jump.type(ev.key); return; }
    if (jump.active) {
      if (ev.key === "Enter") { ev.preventDefault(); jump.go(); return; }
      if (ev.key === "Backspace") { ev.preventDefault(); jump.back(); return; }
      jump.clear();
      if (ev.key === "Escape") return;
    }
    // a code window closes with Escape and whenever the frame changes
    if (ev.key === "Escape") { closeOverlays(); return; }
    if (["ArrowRight", "ArrowDown", " ", "PageDown", "ArrowLeft", "ArrowUp", "PageUp", "Home", "End"].includes(ev.key)) { closeOverlays(); cursor.clear(); }
    switch (ev.key) {
      case "ArrowRight": case "ArrowDown": case " ": case "PageDown": ev.preventDefault(); next(); break;
      case "ArrowLeft": case "ArrowUp": case "PageUp": ev.preventDefault(); prev(); break;
      case "Home": showFrame(0); break;
      case "End": showFrame(frames.length - 1); break;
      case "f": case "F": if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen(); break;
      case "n": case "N": openNotes(); break;
      case "p": case "P": location.search = "?print"; break;
      case "l": case "L": live.askKey(); break;           // live polls: the server's admin key
      case "c": case "C": live.newSession(); break;       // live polls: a new session code
      case "m": case "M": cursor.cycle(); break;          // cursor, laser pointer, cursor hidden
      case "r": case "R": replay(); break;                // animations of this slide from the start
    }
  });
  document.addEventListener("click", (ev) => {
    if (ev.target.closest("a, button, input, textarea, iframe, [data-no-advance]") || ev.target.isContentEditable) return;
    closeOverlays();
    if (ev.clientX > window.innerWidth * 0.8 || ev.clientX < window.innerWidth * 0.2) cursor.clear();
    if (ev.clientX > window.innerWidth * 0.8) next();
    else if (ev.clientX < window.innerWidth * 0.2) prev();
  });

  /* --- control bar for embedded decks (?bar=1) ---------------------------------
   * In an iframe there is no keyboard focus until someone clicks, and no browser
   * chrome to leave the page with. The bar gives the three things a reader needs:
   * back, forward, and full screen, plus the frame counter. It is never part of
   * an export (the exporter does not pass ?bar). */
  if (params.has("bar")) {
    const bar = document.createElement("div");
    bar.className = "embedbar";
    bar.dataset.noAdvance = "1";
    const icon = {
      prev: "&#8249;", next: "&#8250;",
      full: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 7V3h4M17 7V3h-4M3 13v4h4M17 13v4h-4"/></svg>',
      open: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M8 4H4v12h12v-4M12 3h5v5M17 3l-7 7"/></svg>',
      pdf: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3v9M6.5 8.5 10 12l3.5-3.5M4 15h12"/></svg>',
    };
    const button = (cls, glyph, title, fn) => {
      const b = document.createElement("button");
      b.className = cls; b.title = title; b.setAttribute("aria-label", title); b.innerHTML = glyph;
      b.addEventListener("click", fn);
      bar.appendChild(b);
      return b;
    };
    button("eb-prev", icon.prev, "back", prev);
    bar.appendChild(counter);          // der Zaehler des Decks selbst: showFrame haelt ihn aktuell
    button("eb-next", icon.next, "forward", next);
    button("eb-full", icon.full, "full screen", () => {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen();
    });
    // in einem eigenen Tab oeffnen: dieselbe Datei ohne die Leiste
    button("eb-open", icon.open, "open in a new tab",
           () => window.open(location.pathname, "_blank", "noopener"));
    // das PDF, falls die einbettende Seite eines mitgibt: ?pdf=<pfad>
    if (params.get("pdf")) {
      button("eb-pdf", icon.pdf, "slides as PDF",
             () => window.open(params.get("pdf"), "_blank", "noopener"));
    }
    document.body.appendChild(bar);
  }

  // --- start -----------------------------------------------------------------
  // ?slide=N and #N count frames (a build-up step is a frame of its own)
  const start = params.has("slide") ? Number(params.get("slide")) - 1
              : location.hash ? Number(location.hash.slice(1)) - 1 : 0;
  showFrame(Number.isFinite(start) && start >= 0 ? start : 0);
  morph.start();
  ready = true;
  // ?slide=N&morph-t=0.4 shows the move onto frame N, stopped at 40 %; with
  // &morph-back the move from the slide after it (for checking and previews)
  if (params.has("morph-t")) {
    const t = Math.min(1, Math.max(0, Number(params.get("morph-t")) || 0));
    const other = slides[index + (params.has("morph-back") ? 1 : -1)];
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => { morph.play(other, slides[index]); morph.seek(t); });
  }
  live.syncSet();

  window.stagekit = { version: VERSION, next, prev, show, showFrame, slides, frames, morph: { seek: morph.seek, finish: morph.finish },
    get index() { return index; }, get frame() { return frame; } };
})();
