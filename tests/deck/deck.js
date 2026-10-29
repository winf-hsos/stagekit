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
