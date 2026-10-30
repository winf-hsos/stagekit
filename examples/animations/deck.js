// Drawings of the animation demo. Every viewBox is 1680 wide, the width of a
// figure on the 1920 canvas, so text sizes come out as written.
const d = window.draw;
const el = (id) => document.getElementById(id);

// Bootstrap Icons "laptop", "router", "hdd-rack" 1.11.3 (MIT, (c) The Bootstrap Authors)
const ICON_LAPTOP = '<path d="M13.5 3a.5.5 0 0 1 .5.5V11H2V3.5a.5.5 0 0 1 .5-.5zm-11-1A1.5 1.5 0 0 0 1 3.5V12h14V3.5A1.5 1.5 0 0 0 13.5 2zM0 12.5h16a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 0 12.5"/>';
const ICON_ROUTER = '<path d="M5.525 3.025a3.5 3.5 0 0 1 4.95 0 .5.5 0 1 0 .707-.707 4.5 4.5 0 0 0-6.364 0 .5.5 0 0 0 .707.707"/><path d="M6.94 4.44a1.5 1.5 0 0 1 2.12 0 .5.5 0 0 0 .708-.708 2.5 2.5 0 0 0-3.536 0 .5.5 0 0 0 .707.707ZM2.5 11a.5.5 0 1 1 0-1 .5.5 0 0 1 0 1m4.5-.5a.5.5 0 1 0 1 0 .5.5 0 0 0-1 0m2.5.5a.5.5 0 1 1 0-1 .5.5 0 0 1 0 1m1.5-.5a.5.5 0 1 0 1 0 .5.5 0 0 0-1 0m2 0a.5.5 0 1 0 1 0 .5.5 0 0 0-1 0"/><path d="M2.974 2.342a.5.5 0 1 0-.948.316L3.806 8H1.5A1.5 1.5 0 0 0 0 9.5v2A1.5 1.5 0 0 0 1.5 13H2a.5.5 0 0 0 .5.5h2A.5.5 0 0 0 5 13h6a.5.5 0 0 0 .5.5h2a.5.5 0 0 0 .5-.5h.5a1.5 1.5 0 0 0 1.5-1.5v-2A1.5 1.5 0 0 0 14.5 8h-2.306l1.78-5.342a.5.5 0 1 0-.948-.316L11.14 8H4.86zM14.5 9a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-.5.5h-13a.5.5 0 0 1-.5-.5v-2a.5.5 0 0 1 .5-.5z"/><path d="M8.5 5.5a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0"/>';
const ICON_HDD_RACK = '<path d="M4.5 5a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1M3 4.5a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0m2 7a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0m-2.5.5a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1"/><path d="M2 2a2 2 0 0 0-2 2v1a2 2 0 0 0 2 2h1v2H2a2 2 0 0 0-2 2v1a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1a2 2 0 0 0-2-2h-1V7h1a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zm13 2v1a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1m0 7v1a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1v-1a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1m-3-4v2H4V7z"/>';

/* --- step by step: one pass of bubble sort ---------------------------------
 * Five boxes 160 wide with 60 between them: 5 x 160 + 4 x 60 = 1040, so the row
 * starts at (1680 - 1040) / 2 = 320, and a swap moves a box by 220. */
const values = [5, 2, 4, 1, 3];
el("fig-sort").innerHTML = d.svg(1680, 600,
  ...values.map((v, i) => d.g("v" + v, d.box(320 + i * 220, 200, 160, 160, String(v), { size: 48, mono: true }))),
  d.g("swaps", d.label(840, 520, "0 swaps", { anchor: "middle", color: d.color("gray") })));
const sort = d.anim("fig-sort");
// a swap: the left box goes over the top, the right one underneath
const swap = (l, r) => sort.seq(
  sort.par(sort.color(l, "yellow", { dur: 300 }), sort.color(r, "yellow", { dur: 300 })),
  sort.par(
    sort.seq(sort.move(l, 0, -130, { dur: 300 }), sort.move(l, 220, 0, { dur: 500 }), sort.move(l, 0, 130, { dur: 300 })),
    sort.seq(sort.move(r, 0, 130, { dur: 300 }), sort.move(r, -220, 0, { dur: 500 }), sort.move(r, 0, -130, { dur: 300 }))),
  sort.par(sort.color(l, "white", { dur: 300 }), sort.color(r, "white", { dur: 300 })));
sort.step(swap("v5", "v2"), sort.count("swaps", 1, { suffix: " swaps", dur: 300 }));
sort.step(swap("v5", "v4"), sort.count("swaps", 2, { suffix: " swaps", dur: 300 }));
sort.step(swap("v5", "v1"), sort.count("swaps", 3, { suffix: " swaps", dur: 300 }));
sort.step(swap("v5", "v3"), sort.count("swaps", 4, { suffix: " swaps", dur: 300 }), sort.color("v5", "green"));

/* --- semi-automatic: a request and its reply --------------------------------
 * Icons 160 wide, centred at x 140, 840, 1540. A packet is 180 wide, so its
 * centre rides on routes that stop 94 short of each icon (90 + 4 for the stroke). */
el("fig-net").innerHTML = d.svg(1680, 600,
  d.g("link1", d.line(240, 300, 740, 300)),
  d.g("link2", d.line(940, 300, 1440, 300)),
  d.g("route1", d.line(334, 300, 646, 300, { color: "none" })),
  d.g("route2", d.line(1034, 300, 1346, 300, { color: "none" })),
  d.g("laptop", d.icon(60, 220, 160, ICON_LAPTOP, { color: d.color("white") })),
  d.g("router", d.icon(760, 220, 160, ICON_ROUTER, { color: d.color("white") })),
  d.g("server", d.icon(1460, 220, 160, ICON_HDD_RACK, { color: d.color("white") })),
  d.label(140, 440, "your laptop", { anchor: "middle", color: d.color("gray") }),
  d.label(840, 440, "router", { anchor: "middle", color: d.color("gray") }),
  d.label(1540, 440, "server", { anchor: "middle", color: d.color("gray") }),
  d.g("request", d.box(244, 272, 180, 56, "request", { border: d.color("yellow") })),
  d.g("reply", d.box(1256, 272, 180, 56, "reply", { border: d.color("green") })),
  d.g("time", d.label(840, 540, "0 ms", { anchor: "middle" })));
const net = d.anim("fig-net");
net.step(net.draw("link1"), net.draw("link2", { dur: 600 }));
net.step(net.show("request", { dur: 300 }), net.along("request", "route1", { dur: 1000 }),
         net.hold(),
         net.along("request", "route2", { dur: 1000 }), net.hide("request", { dur: 200 }), net.pulse("server"));
net.step(net.show("reply", { dur: 300 }),
         net.par(net.seq(net.along("reply", "route2", { dur: 1000, reverse: true }), net.along("reply", "route1", { dur: 1000, reverse: true })),
                 net.count("time", 42, { suffix: " ms", dur: 2000, ease: "linear" })));

/* --- automatic: from the board to the chip ----------------------------------
 * The photo is 16:9, 1680 x 945, cut to the figure's 1680 x 804 (70 off at the
 * top). The heat spreader sits at x 700..931, y 219..455 of the drawing. The
 * camera zooms by 2.5 onto the CPU (672 x 321.6 around 817, 336), so labels
 * written in size 32 appear in 80. */
el("fig-zoom").innerHTML = d.svg(1680, 804,
  d.image(0, -70, 1680, 945, "img/motherboard.jpg"),
  // a spotlight: everything but the heat spreader darkened, so labels on the photo stay legible
  d.g("spot", `<path d="M0 0H1680V804H0Z M700 219H931V455H700Z" fill="#000" fill-opacity="0.7" fill-rule="evenodd"/>`),
  d.g("cpu-box", d.box(700, 219, 231, 236, "", { border: d.color("yellow"), fill: "none" })),
  d.g("cpu-label", d.label(686, 337, "CPU", { anchor: "end", centerY: 337, keepCase: true, color: d.color("yellow") })),
  d.g("transistors", d.label(816, 478, "0 billion transistors", { anchor: "middle", centerY: 478 })));
// back: "play" -- zooming out again is the reverse of zooming in and tells nothing wrong
const zoom = d.anim("fig-zoom", { auto: true, gap: 500, back: "play" });
zoom.step(zoom.camera([481, 175.2, 672, 321.6], { dur: 2500 }));
zoom.step(zoom.par(zoom.show("spot", { dur: 1000 }), zoom.draw("cpu-box", { dur: 1000 })));
zoom.step(zoom.show("cpu-label", { dur: 400 }), zoom.show("transistors", { dur: 400 }),
          zoom.count("transistors", 20, { suffix: " billion transistors", dur: 1500 }));
