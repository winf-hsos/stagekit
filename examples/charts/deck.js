/* Drawings of the chart demo: two charts, each with one state per build-up step. */
(function () {
  const d = window.draw;
  const el = (id) => document.getElementById(id);

  // columns: grow, stand out, compare, zoom in on the difference
  const enrol = d.chart({
    type: "bar", width: 1680, height: 760,
    labels: ["21/22", "22/23", "23/24", "24/25", "25/26", "26/27"],
    series: [
      { name: "business informatics", values: [31, 28, 24, 21, 7, 10] },
      { name: "all programmes", values: [30, 30, 29, 27, 24, 22] },
    ],
    states: [
      { show: [] },                                                       // the empty axis
      { show: ["business informatics"] },                                 // step 1: the bars grow
      { highlight: ["26/27"], note: { at: "26/27", text: "first rise" } }, // step 2: the statement
      { show: ["business informatics", "all programmes"], note: null },   // step 3: compared with all
      { zoom: [0, 12], highlight: ["25/26", "26/27"] },                   // step 4: the range that matters
    ],
  });
  el("fig-enrol").innerHTML = d.svg(1680, 760, enrol.svg());
  enrol.steps("fig-enrol");

  // rows: a ranking that sorts itself, then the formats that do not shrink
  const ratio = d.chart({
    type: "hbar", width: 1680, height: 760, unit: " %",
    labels: ["csv table", "jpeg photo", "log file", "mp4 video", "source code", "word document"],
    values: [82, 2, 91, 1, 74, 45],
    states: [
      { values: "all" },
      { sort: "desc" },                                   // step 1: sorted
      { highlight: ["jpeg photo", "mp4 video"], note: { at: "jpeg photo", text: "already compressed" } },
    ],
  });
  el("fig-ratio").innerHTML = d.svg(1680, 760, ratio.svg());
  ratio.steps("fig-ratio");
})();
