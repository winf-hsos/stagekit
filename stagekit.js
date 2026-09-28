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

  /* --- live polls ---------------------------------------------------------------
   * A slide <section class="slide poll" data-poll="id"> asks the audience a
   * question they answer on their phones; the slide shows a QR code, a session
   * code, a live counter and, one step later, the result as bars. It needs a
   * poll server (API: see SKILL.md), named on the deck: data-live-url, and a
   * series name for the deck's questions: data-live-series (default: the file
   * name). Authoring is two elements, stagekit builds the rest:
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
      code = (await call("/api/live/sessions", { series, title })).code;
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
    if (s.classList.contains("poll")) live.update(s, s._step);
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

  /* --- copy buttons on code blocks -------------------------------------------
   * Every .code block gets a small button with a copy icon in its top right
   * corner: one click puts the code on the clipboard, so the audience can take
   * it straight into their editor. The icon turns into a check mark for a
   * moment. Lines written as <div>s are joined with line breaks. The button is
   * hidden in the print view (and so in the PDF). Icons: Bootstrap Icons
   * "copy" and "check2" 1.11.3 (MIT, (c) The Bootstrap Authors). */
  const ICON_COPY = '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M4 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zm2-1a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1zM2 5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1h1v1a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1v1z"/></svg>';
  const ICON_CHECK = '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0"/></svg>';
  function codeText(block) {
    const lines = Array.from(block.children).filter((c) => c.tagName === "DIV");
    if (lines.length) return lines.map((l) => l.textContent).join("\n");
    const clone = block.cloneNode(true);
    clone.querySelectorAll(".copy").forEach((b) => b.remove());
    return clone.textContent.replace(/^\n+|\s+$/g, "");
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
      case "l": case "L": live.askKey(); break;           // live polls: the server's admin key
      case "c": case "C": live.newSession(); break;       // live polls: a new session code
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
  live.syncSet();

  window.stagekit = { next, prev, show, showFrame, slides, frames, get index() { return index; }, get frame() { return frame; } };
})();
