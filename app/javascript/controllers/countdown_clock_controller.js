import { Controller } from "@hotwired/stimulus";

// NASA-style 7-segment dot-matrix countdown clock. Renders SVG digits inside
// a slim fixed-position bar that slides in from the top once the page is
// scrolled past a small threshold (immediately on mobile, past the landing
// header on desktop). Removes itself once the target time has passed.

const SVG_NS = "http://www.w3.org/2000/svg";

const SEGMENTS = {
  0: ["a", "b", "c", "d", "e", "f"],
  1: ["b", "c"],
  2: ["a", "b", "g", "e", "d"],
  3: ["a", "b", "g", "c", "d"],
  4: ["f", "g", "b", "c"],
  5: ["a", "f", "g", "c", "d"],
  6: ["a", "f", "g", "c", "d", "e"],
  7: ["a", "b", "c"],
  8: ["a", "b", "c", "d", "e", "f", "g"],
  9: ["a", "b", "c", "d", "f", "g"],
};

// Dot grid per digit. Single-row segments (one circle thick) to match the
// NASA mission-clock reference. 15 cols × 21 rows = 0.71:1 aspect.
const COLS = 15;
const ROWS = 21;
const CELL = 6;
const R = 2;
const W = COLS * CELL;
const H = ROWS * CELL;

function gridRect(c1, r1, c2, r2) {
  const cells = [];
  for (let r = r1; r <= r2; r++) {
    for (let c = c1; c <= c2; c++) cells.push({ c, r });
  }
  return cells;
}

const SEG_CELLS = {
  a: gridRect(1, 0, 13, 0),
  f: gridRect(0, 1, 0, 9),
  b: gridRect(14, 1, 14, 9),
  g: gridRect(1, 10, 13, 10),
  e: gridRect(0, 11, 0, 19),
  c: gridRect(14, 11, 14, 19),
  d: gridRect(1, 20, 13, 20),
};

function dot(c, r, extraClass) {
  const circle = document.createElementNS(SVG_NS, "circle");
  circle.setAttribute("cx", c * CELL + CELL / 2);
  circle.setAttribute("cy", r * CELL + CELL / 2);
  circle.setAttribute("r", R);
  if (extraClass) circle.setAttribute("class", extraClass);
  return circle;
}

function makeDigitSvg() {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("class", "countdown-bar__glyph countdown-bar__glyph--digit");
  for (const seg of "abcdefg") {
    const g = document.createElementNS(SVG_NS, "g");
    g.setAttribute("class", `countdown-bar__seg countdown-bar__seg--${seg}`);
    g.dataset.seg = seg;
    for (const { c, r } of SEG_CELLS[seg]) g.appendChild(dot(c, r));
    svg.appendChild(g);
  }
  return svg;
}

function makeColonSvg() {
  // Two stacked dots, vertically aligned with the upper- and lower-half
  // verticals on the adjacent digits.
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${CELL * 2} ${H}`);
  svg.setAttribute("class", "countdown-bar__glyph countdown-bar__glyph--colon");
  for (const r of [5, 15]) {
    svg.appendChild(dot(0.5, r, "countdown-bar__dot--lit"));
  }
  return svg;
}

function makeSignSvg() {
  // Single horizontal bar at the vertical midline (segment "g").
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("class", "countdown-bar__glyph countdown-bar__glyph--sign");
  const g = document.createElementNS(SVG_NS, "g");
  g.setAttribute("class", "countdown-bar__seg countdown-bar__seg--sign is-on");
  for (const { c, r } of SEG_CELLS.g) g.appendChild(dot(c, r));
  svg.appendChild(g);
  return svg;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

export default class extends Controller {
  static values = { targetIso: String };

  connect() {
    this.targetMs = new Date(this.targetIsoValue).getTime();
    if (Number.isNaN(this.targetMs)) return;
    if (Date.now() >= this.targetMs) {
      this.element.remove();
      return;
    }

    this.buildClock();
    this.tick();
    this.timer = setInterval(() => this.tick(), 1000);

    this.mobileQuery = window.matchMedia("(max-width: 720px)");
    this.threshold = document.querySelector(".what-is-this__divider");
    this.onScroll = this.onScroll.bind(this);
    window.addEventListener("scroll", this.onScroll, { passive: true });
    window.addEventListener("resize", this.onScroll, { passive: true });
    this.onScroll();
  }

  disconnect() {
    if (this.timer) clearInterval(this.timer);
    window.removeEventListener("scroll", this.onScroll);
    window.removeEventListener("resize", this.onScroll);
  }

  buildClock() {
    const clock = document.createElement("div");
    clock.className = "countdown-bar__clock";

    clock.appendChild(makeSignSvg());

    this.digitSvgs = [];
    const groups = [0, 1, 2, 3];
    groups.forEach((g, i) => {
      if (i > 0) clock.appendChild(makeColonSvg());
      for (let d = 0; d < 2; d++) {
        const svg = makeDigitSvg();
        clock.appendChild(svg);
        this.digitSvgs.push(svg);
      }
    });

    const clockLabel = this.element.querySelector(
      ".countdown-bar__label--clock",
    );
    if (clockLabel) this.element.insertBefore(clock, clockLabel);
    else this.element.appendChild(clock);
  }

  setDigitValue(svg, value) {
    const active = new Set(SEGMENTS[String(value)] || []);
    for (const seg of svg.querySelectorAll(".countdown-bar__seg")) {
      seg.classList.toggle("is-on", active.has(seg.dataset.seg));
    }
  }

  tick() {
    const deltaSec = Math.floor((this.targetMs - Date.now()) / 1000);
    if (deltaSec <= 0) {
      this.element.remove();
      clearInterval(this.timer);
      return;
    }

    const days = Math.floor(deltaSec / 86400);
    const hours = Math.floor((deltaSec % 86400) / 3600);
    const mins = Math.floor((deltaSec % 3600) / 60);
    const secs = deltaSec % 60;
    const str = `${pad2(days)}${pad2(hours)}${pad2(mins)}${pad2(secs)}`;
    for (let i = 0; i < 8; i++) this.setDigitValue(this.digitSvgs[i], str[i]);
  }

  onScroll() {
    // Hold off the bar until the user has scrolled past the first
    // section divider (".what-is-this__divider"); the bar then "takes
    // over" rather than overlapping the hero. Falls back to a simple
    // pixel threshold if the divider isn't on the page.
    let visible;
    if (this.threshold) {
      visible = this.threshold.getBoundingClientRect().bottom < 0;
    } else {
      visible = window.scrollY > (this.mobileQuery.matches ? 24 : 80);
    }
    this.element.classList.toggle("is-visible", visible);

    // First time the bar appears, do a brief self-test: every segment
    // lights up for a beat, then drops back to the real time. Reads like
    // hardware powering on. Once-per-page-load only.
    if (visible && !this.hasBooted) {
      this.hasBooted = true;
      const reduced = window.matchMedia?.(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      if (reduced) return;

      // Clear current segment state so the boot-end tick re-adds .is-on
      // from scratch, replaying the strike animation in unison on every
      // initially-lit segment. Without this the segments are already on,
      // so the boot just dissolves into them with no extra punch.
      for (const seg of this.element.querySelectorAll(
        ".countdown-bar__seg.is-on:not(.countdown-bar__seg--sign)",
      )) {
        seg.classList.remove("is-on");
      }

      this.element.classList.add("is-booting");
      setTimeout(() => {
        this.element.classList.remove("is-booting");
        this.tick();
      }, 220);
    }
  }
}
