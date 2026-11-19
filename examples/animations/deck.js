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
const values = [2, 5, 1, 4, 3];
const prompts = [
  "will 2 and 5 change places?",
  "2 and 5 stay in order. what will 5 and 1 do?",
  "will 5 and 4 change places?",
  "will 5 and 3 change places?",
  "5 is now in its final position"
];
el("fig-sort").innerHTML = d.svg(1680, 600,
  ...values.map((v, i) => d.g("v" + v, d.box(320 + i * 220, 200, 160, 160, String(v), { size: 48, mono: true }))),
  ...prompts.map((text, i) => d.g("prompt" + i, d.label(840, 42, text, { anchor: "middle" }))),
  d.g("swaps", d.label(840, 550, "swap count 0", { anchor: "middle", color: d.color("gray") })));
const sort = d.anim("fig-sort");
// a swap: the left box goes over the top, the right one underneath
const swap = (l, r) => sort.seq(
  sort.par(sort.color(l, "yellow", { dur: 300 }), sort.color(r, "yellow", { dur: 300 })),
  sort.par(
    sort.seq(sort.move(l, 0, -130, { dur: 300 }), sort.move(l, 220, 0, { dur: 500 }), sort.move(l, 0, 130, { dur: 300 })),
    sort.seq(sort.move(r, 0, 130, { dur: 300 }), sort.move(r, -220, 0, { dur: 500 }), sort.move(r, 0, -130, { dur: 300 }))),
  sort.par(sort.color(l, "white", { dur: 300 }), sort.color(r, "white", { dur: 300 })));
// The first comparison leaves both values in place. Keep its outcome visible
// at the resting state, where the audience predicts the next comparison.
sort.step(
  sort.par(sort.color("v2", "yellow", { dur: 300 }), sort.color("v5", "yellow", { dur: 300 })),
  sort.swap("prompt0", "prompt1", { dur: 0 }));
sort.step(sort.color("v2", "white", { dur: 200 }), swap("v5", "v1"),
  sort.count("swaps", 1, { prefix: "swap count ", dur: 200 }), sort.swap("prompt1", "prompt2", { dur: 0 }));
sort.step(swap("v5", "v4"), sort.count("swaps", 2, { prefix: "swap count ", dur: 200 }),
  sort.swap("prompt2", "prompt3", { dur: 0 }));
sort.step(swap("v5", "v3"), sort.count("swaps", 3, { prefix: "swap count ", dur: 200 }),
  sort.color("v5", "green", { dur: 300 }), sort.swap("prompt3", "prompt4", { dur: 0 }));

/* --- semi-automatic: a request and its reply -------------------------------- */
const laptop = { x: 60, y: 220, width: 160, height: 160 };
const router = { x: 760, y: 220, width: 160, height: 160 };
const server = { x: 1460, y: 220, width: 160, height: 160 };
const sender = d.anchor(laptop, "right"), receiver = d.anchor(server, "left");
const packet = { width: 180, height: 56 };
function station(name, rect, icon, caption) {
  return d.g(name, d.icon(rect.x, rect.y, rect.width, icon, { color: d.color("white") })) +
    d.label(rect.x + rect.width / 2, rect.y + rect.height + 60, caption,
      { anchor: "middle", color: d.color("gray") });
}
el("fig-net").innerHTML = d.svg(1680, 600,
  d.g("link1", d.connect(sender, d.anchor(router, "left"))),
  d.g("link2", d.connect(d.anchor(router, "right"), receiver)),
  station("laptop", laptop, ICON_LAPTOP, "your laptop"),
  station("router", router, ICON_ROUTER, "router"),
  station("server", server, ICON_HDD_RACK, "server"),
  d.g("request", d.box(sender.x, sender.y - packet.height / 2, packet.width, packet.height,
    "request", { border: d.color("yellow") })),
  d.g("reply", d.box(receiver.x - packet.width, receiver.y - packet.height / 2, packet.width, packet.height,
    "reply", { border: d.color("green") })),
  d.g("time", d.label(840, 540, "0 ms", { anchor: "middle", color: d.color("gray") })));
const net = d.anim("fig-net");
net.step(net.draw("link1"), net.draw("link2", { dur: 600 }));
net.step(net.show("request", { dur: 300 }), net.along("request", "link1", { dur: 1000 }),
         net.hold(),
         net.along("request", "link2", { dur: 1000 }), net.hide("request", { dur: 200 }), net.pulse("server"));
net.step(net.show("reply", { dur: 300 }),
         net.par(net.seq(net.along("reply", "link2", { dur: 1000, reverse: true }), net.along("reply", "link1", { dur: 1000, reverse: true })),
                 net.count("time", 42, { suffix: " ms", dur: 2000, ease: "linear" })));

/* --- automatic: from the board to the chip ---------------------------------- */
const chip = { x: 700, y: 219, width: 231, height: 236 };
const detail = d.closeup(1680, 804, chip, "CPU");
el("fig-zoom").innerHTML = d.svg(1680, 804,
  d.image(0, -70, 1680, 945, "img/motherboard.jpg"),
  d.g("spot", detail.shade), d.g("outline", detail.outline), d.g("caption", detail.caption));
// back: "play" -- zooming out again is the reverse of zooming in and tells nothing wrong
const zoom = d.anim("fig-zoom", { auto: true, gap: 500, back: "play" });
zoom.step(zoom.camera(detail.view, { dur: 2500 }));
zoom.step(zoom.par(zoom.show("spot", { dur: 1000 }), zoom.draw("outline", { dur: 1000 })));
zoom.step(zoom.show("caption", { dur: 400 }));

/* --- between slides: magic move ---------------------------------------------
 * A group marked <g data-morph="key"> is linked to the element with the same
 * key on the neighbouring slide. The processor box becomes the statement of
 * the next slide; the five value boxes keep their keys and only change places. */
const morphGroup = (key, ...parts) => `<g data-morph="${key}">${parts.join("")}</g>`;
el("fig-parts").innerHTML = d.svg(1680, 600,
  d.arrow(420, 190, 660, 190), d.arrow(1020, 190, 1260, 190),
  d.arrow(820, 260, 820, 400), d.arrow(860, 400, 860, 260),
  d.box(120, 120, 300, 140, "input", { size: 40 }),
  morphGroup("cpu", d.box(660, 120, 360, 140, "processor", { size: 40, border: d.color("blue") })),
  d.box(1260, 120, 300, 140, "output", { size: 40 }),
  d.box(690, 400, 300, 120, "memory", { size: 40 }));

/* five boxes 160 wide with 60 between them, as in the sorting example */
const valueRow = (order, caption) => d.svg(1680, 600,
  d.label(840, 120, caption, { anchor: "middle", color: d.color("gray") }),
  ...order.map((v, i) => morphGroup("value-" + v, d.box(320 + i * 220, 220, 160, 160, String(v), { size: 48, mono: true }))));
el("fig-unsorted").innerHTML = valueRow([5, 2, 8, 1, 4], "as they arrived");
el("fig-sorted").innerHTML = valueRow([1, 2, 4, 5, 8], "sorted");
