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
 *     because hidden steps keep their space, like slidekit's buildup)
 *   - keyboard: → ↓ space PgDn next, ← ↑ PgUp back, Home/End, F fullscreen,
 *     N notes window (speaker notes of the current and next slide, kept in
 *     sync over a BroadcastChannel), P print view, Esc leaves fullscreen
 *   - every build-up step is a frame with its own number: the counter, the
 *     hash (#12 is frame 12), ?slide=12 and the export count frames, so a
 *     slide with two steps takes three numbers, as it did in slidekit
 *   - ?print shows all frames stacked (steps as clones) for a quick print
 *   - hooks: a slide may carry data-on-show="fn" / data-on-step="fn"; the
 *     named global functions are called with (slide, step)
 *
 * Design values come from theme.css; stagekit.js never sets a colour. */

(function () {
  "use strict";

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const params = new URLSearchParams(location.search);

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
    s.insertAdjacentHTML("afterbegin", `<div class="content"><div class="part-n">${n ? "part " + n : ""}</div><div class="part-text">${name}</div></div>`);
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
  // The numbering, the counter, the hash and the export all count frames, as a
  // .pptx deck built with slidekit counted its build-up copies.
  const frames = [];
  slides.forEach((s, i) => { [0, ...s._steps].forEach((st) => frames.push({ slide: i, step: st })); });

  // --- navigation --------------------------------------------------------------
  let index = 0;      // slide index
  let frame = 0;      // frame index
  const counter = document.createElement("div");
  counter.className = "counter";
  document.body.appendChild(counter);

  function applySteps(s) {
    $$("[data-step]", s).forEach((e) => e.classList.toggle("shown", Number(e.dataset.step) <= s._step));
  }

  function showFrame(f) {
    frame = Math.max(0, Math.min(frames.length - 1, f));
    const fr = frames[frame];
    const sameSlide = fr.slide === index && slides[index].classList.contains("current");
    index = fr.slide;
    const s = slides[index];
    s._step = fr.step;
    if (!sameSlide) slides.forEach((x, k) => x.classList.toggle("current", k === index));
    applySteps(s);
    counter.textContent = `${frame + 1} / ${frames.length}`;
    history.replaceState(null, "", "#" + (frame + 1));
    if (!sameSlide && s.dataset.onShow && typeof window[s.dataset.onShow] === "function") window[s.dataset.onShow](s, s._step);
    else if (sameSlide && s.dataset.onStep && typeof window[s.dataset.onStep] === "function") window[s.dataset.onStep](s, s._step);
    broadcast();
  }
  const frameOf = (slideIndex, step) => Math.max(0, frames.findIndex((fr) => fr.slide === slideIndex && fr.step === (step === undefined ? 0 : step)));
  function show(i, step) { showFrame(frameOf(Math.max(0, Math.min(slides.length - 1, i)), step === 99 ? slides[i]._steps[slides[i]._steps.length - 1] || 0 : step)); }
  function next() { if (frame < frames.length - 1) showFrame(frame + 1); }
  function prev() { if (frame > 0) showFrame(frame - 1); }

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
      $("#nv-h").textContent = `${m.index + 1} / ${m.total} · ${m.heading}${m.step ? " · step " + m.step : ""}`;
      $("#nv-c").innerHTML = m.notes || "<span style='color:#4a5259'>(no notes)</span>";
      $("#nv-nh").textContent = "next: " + (m.nextHeading || "end");
      $("#nv-n").innerHTML = m.nextNotes || "";
    };
    setInterval(() => { $("#nv-clock").textContent = new Date().toLocaleTimeString(); }, 1000);
    return;
  }

  // --- print view --------------------------------------------------------------
  if (params.has("print")) {
    // every frame becomes a page; slides with steps are cloned once per step
    // (hooks that draw by element id run on the original only, so decks with
    // hooks are exported frame by frame through tools/export.py instead)
    document.body.classList.add("print");
    slides.forEach((s) => {
      const steps = [0, ...s._steps];
      steps.forEach((st, k) => {
        const el = k === steps.length - 1 ? s : s.cloneNode(true);
        if (el !== s) s.parentNode.insertBefore(el, s);
        el.classList.add("current");
        $$("[data-step]", el).forEach((e) => e.classList.toggle("shown", Number(e.dataset.step) <= st));
      });
      s._step = steps[steps.length - 1];
      if (s.dataset.onShow && window[s.dataset.onShow]) window[s.dataset.onShow](s, s._step);
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

  // --- keys ----------------------------------------------------------------------
  document.addEventListener("keydown", (ev) => {
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "IFRAME") return;
    switch (ev.key) {
      case "ArrowRight": case "ArrowDown": case " ": case "PageDown": ev.preventDefault(); next(); break;
      case "ArrowLeft": case "ArrowUp": case "PageUp": ev.preventDefault(); prev(); break;
      case "Home": showFrame(0); break;
      case "End": showFrame(frames.length - 1); break;
      case "f": case "F": if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen(); break;
      case "n": case "N": openNotes(); break;
      case "p": case "P": location.search = "?print"; break;
    }
  });
  document.addEventListener("click", (ev) => {
    if (ev.target.closest("a, button, input, iframe, [data-no-advance]")) return;
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

  window.stagekit = { next, prev, show, showFrame, slides, frames, get index() { return index; }, get frame() { return frame; } };
})();
