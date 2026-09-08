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
 *   - hash routing (#12 is slide 12), ?print shows all slides stacked for
 *     PDF export, ?slide=12 opens a slide (for screenshots)
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
      loc.innerHTML = `<div class="bar"><div class="fill" style="width:${((k + 1) / parts.length) * 100}%"></div>${ticks}</div><span>${s.dataset.part}</span>`;
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

  // --- navigation --------------------------------------------------------------
  let index = 0;
  const counter = document.createElement("div");
  counter.className = "counter";
  document.body.appendChild(counter);

  function applySteps(s) {
    $$("[data-step]", s).forEach((e) => e.classList.toggle("shown", Number(e.dataset.step) <= s._step));
  }

  function show(i, step) {
    index = Math.max(0, Math.min(slides.length - 1, i));
    slides.forEach((s, k) => s.classList.toggle("current", k === index));
    const s = slides[index];
    if (step !== undefined) s._step = step;
    applySteps(s);
    counter.textContent = `${index + 1} / ${slides.length}`;
    history.replaceState(null, "", "#" + (index + 1));
    if (s.dataset.onShow && typeof window[s.dataset.onShow] === "function") window[s.dataset.onShow](s, s._step);
    broadcast();
  }

  function next() {
    const s = slides[index];
    const pending = s._steps.filter((n) => n > s._step);
    if (pending.length) { s._step = pending[0]; applySteps(s); stepHook(s); broadcast(); return; }
    if (index < slides.length - 1) show(index + 1, 0);
  }
  function prev() {
    const s = slides[index];
    const done = s._steps.filter((n) => n <= s._step);
    if (done.length) { s._step = done.length > 1 ? done[done.length - 2] : 0; applySteps(s); stepHook(s); broadcast(); return; }
    if (index > 0) { show(index - 1); const p = slides[index]; p._step = p._steps.length ? p._steps[p._steps.length - 1] : 0; applySteps(p); broadcast(); }
  }
  function stepHook(s) {
    if (s.dataset.onStep && typeof window[s.dataset.onStep] === "function") window[s.dataset.onStep](s, s._step);
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
    channel.postMessage({ index, total: slides.length, step: slides[index]._step,
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
    document.body.classList.add("print");
    slides.forEach((s) => { s.classList.add("current"); s._step = 99; applySteps(s); if (s.dataset.onShow && window[s.dataset.onShow]) window[s.dataset.onShow](s, 99); });
    counter.classList.add("hidden");
    return;
  }

  // --- keys ----------------------------------------------------------------------
  document.addEventListener("keydown", (ev) => {
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "IFRAME") return;
    switch (ev.key) {
      case "ArrowRight": case "ArrowDown": case " ": case "PageDown": ev.preventDefault(); next(); break;
      case "ArrowLeft": case "ArrowUp": case "PageUp": ev.preventDefault(); prev(); break;
      case "Home": show(0, 0); break;
      case "End": show(slides.length - 1, 99); break;
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

  // --- start -----------------------------------------------------------------
  const start = params.has("slide") ? Number(params.get("slide")) - 1
              : location.hash ? Number(location.hash.slice(1)) - 1 : 0;
  show(Number.isFinite(start) && start >= 0 ? start : 0, params.has("step") ? Number(params.get("step")) : 0);

  window.stagekit = { next, prev, show, slides, get index() { return index; } };
})();
