// Drawings of the self-test deck. Every viewBox is 1680 wide, the width of a
// figure on the 1920 canvas, so that text sizes come out as written.
const d = window.draw;

document.getElementById("fig-boxes").innerHTML = d.svg(1680, 420,
  d.box(4, 40, 400, 140, "input"),
  d.arrow(404, 110, 640, 110),
  d.box(640, 40, 400, 140, "processing", { border: d.color("families-represent") }),
  d.arrow(1040, 110, 1276, 110),
  d.box(1276, 40, 400, 140, "output", { mono: true }),
  d.verdict(340, 260, 460, 140, "works", true),
  d.verdict(880, 260, 460, 140, "fails", false));

// Circuit parts are drawn at half scale (viewBox 840 wide, shown twice as
// large), as in the LiFi decks: the lamp caption of 16 then reads as 32.
document.getElementById("fig-circuit").innerHTML = d.svg(840, 250,
  d.wire([[80, 75], [340, 75], [340, 115], [400, 115]], true),
  d.wire([[80, 175], [340, 175], [340, 135], [400, 135]], false),
  d.toggle(60, 75, true),
  d.toggle(60, 175, false),
  d.wire([[448, 125], [707, 125]], false),
  d.gate("and", 400, 105, false),
  d.lamp(720, 125, false, "out"));

document.getElementById("fig-formula").innerHTML = d.svg(1680, 300,
  d.formula(840, 150, "H = log_2(N)", { size: 80, anchor: "middle", centerY: 150 }),
  d.label(840, 260, "information in bits", { size: 32, anchor: "middle" }));

// Animation: a packet travels from client to server. The zoom in segment 3 is
// 2.5, so text of size 32 lands on 80 and the font check stays silent.
document.getElementById("fig-anim").innerHTML = d.svg(1680, 500,
  d.g("link", d.line(304, 240, 1376, 240)),
  d.g("route", d.line(384, 240, 1292, 240, { color: "none" })),   // the packet's centre: 80 short of each box
  d.g("client", d.box(4, 180, 300, 120, "client")),
  d.g("server", d.box(1376, 180, 300, 120, "server")),
  d.g("packet", d.box(304, 210, 160, 60, "data", { border: d.color("yellow") })),
  d.g("bytes", d.label(840, 400, "0 bytes", { anchor: "middle" })));
const a = d.anim("fig-anim");
a.step(a.draw("link"), a.show("packet"));
a.step(a.along("packet", "route", { dur: 1200 }), a.hold(),
       a.par(a.color("server", "green"), a.count("bytes", 1500, { from: 0, suffix: " bytes" })));
a.step(a.camera([1000, 140, 672, 200]));
