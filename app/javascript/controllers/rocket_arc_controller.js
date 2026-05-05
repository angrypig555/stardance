import { Controller } from "@hotwired/stimulus";

// Animates a rocket along a quadratic bezier arc as the user scrolls
// through the footer section — from the yellow creature to the purple creature.
export default class extends Controller {
  static targets = ["rocket", "star"];

  connect() {
    // The rocket is absolutely positioned inside .landing-footer__scene-block,
    // so % coords on its `top`/`left` resolve against the scene-block — not
    // against the whole footer (which also contains the photo panels). When
    // those lazy-loaded panel images flow in, the footer's height grows but
    // the scene-block's doesn't, which would shift the arc if we used the
    // footer as the reference. Anchor centerOf to the scene-block instead.
    this.sceneBlock =
      this.element.querySelector(".landing-footer__scene-block") ||
      this.element;
    this.handleScroll = this.handleScroll.bind(this);
    this.handleRocketClick = this.handleRocketClick.bind(this);
    this.handleRocketCursorPointermove =
      this.handleRocketCursorPointermove.bind(this);
    this.rocketCursorElement = null;

    window.addEventListener("scroll", this.handleScroll, { passive: true });
    this.rocketTarget.addEventListener("click", this.handleRocketClick);
    this.handleScroll();
  }

  disconnect() {
    window.removeEventListener("scroll", this.handleScroll);
    this.rocketTarget.removeEventListener("click", this.handleRocketClick);
    this.deactivateRocketCursor();
  }

  handleRocketClick(event) {
    if (Number.parseFloat(this.rocketTarget.style.opacity || "0") === 0) return;
    if (this.rocketCursorElement) return;

    this.activateRocketCursor(event);
  }

  activateRocketCursor(event) {
    const cursor = document.createElement("img");
    cursor.src = this.rocketTarget.currentSrc || this.rocketTarget.src;
    cursor.alt = "";
    cursor.setAttribute("aria-hidden", "true");
    cursor.className = "landing-rocket-cursor";
    cursor.style.left = `${event.clientX}px`;
    cursor.style.top = `${event.clientY}px`;

    document.body.appendChild(cursor);
    document.documentElement.classList.add("landing-rocket-cursor-active");
    this.rocketTarget.style.visibility = "hidden";
    this.rocketTarget.style.pointerEvents = "none";
    this.rocketCursorElement = cursor;

    document.addEventListener(
      "pointermove",
      this.handleRocketCursorPointermove,
      { passive: true },
    );
  }

  deactivateRocketCursor() {
    if (!this.rocketCursorElement) return;

    document.documentElement.classList.remove("landing-rocket-cursor-active");
    this.rocketTarget.style.visibility = "";
    this.rocketCursorElement.remove();
    this.rocketCursorElement = null;
    this.handleScroll();

    document.removeEventListener(
      "pointermove",
      this.handleRocketCursorPointermove,
    );
  }

  handleRocketCursorPointermove(event) {
    this.rocketCursorElement.style.left = `${event.clientX}px`;
    this.rocketCursorElement.style.top = `${event.clientY}px`;
  }

  // Get the center of an element as a % of the scene-block's dimensions
  // (the rocket's containing block).
  centerOf(el) {
    const refRect = this.sceneBlock.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    return {
      x:
        ((elRect.left + elRect.width / 2 - refRect.left) / refRect.width) *
        100,
      y:
        ((elRect.top + elRect.height / 2 - refRect.top) / refRect.height) *
        100,
    };
  }

  handleScroll() {
    const rect = this.element.getBoundingClientRect();
    const vh = window.innerHeight;

    const scrollStart = vh - rect.top;
    const scrollEnd = vh - rect.top - rect.height;
    const progress = scrollStart / rect.height;

    const rocket = this.rocketTarget;

    // Don't show until scrolled 20% into the footer, hide when fully past
    if (progress < 0.2 || scrollEnd >= vh) {
      rocket.style.opacity = 0;
      rocket.style.pointerEvents = "none";
      return;
    }

    // Remap 0.2–1.0 → 0–0.8
    const t = Math.min(0.8, ((progress - 0.2) / 0.8) * 0.8);

    // Derive start/end from the two star targets if available,
    // otherwise fall back to hardcoded positions.
    // Start at purple (top-right), end at yellow (bottom-left) as user scrolls down.
    let p0, p2;
    if (this.starTargets.length >= 2) {
      // starTargets[0] = footer4 (yellow star), starTargets[1] = footer1 (purple star)
      const yellow = this.centerOf(this.starTargets[0]);
      const purple = this.centerOf(this.starTargets[1]);
      p0 = { x: purple.x + 5, y: purple.y - 10 }; // start at purple, nudged up and right
      p2 = { x: yellow.x + 1, y: yellow.y - 5 }; // end at yellow, nudged tiny right and slightly up
    } else {
      p0 = { x: 72, y: 38 };
      p2 = { x: 5, y: 78 };
    }

    // Control point — midpoint horizontally, arcing above both stars
    const p1 = {
      x: (p0.x + p2.x) / 2,
      y: Math.min(p0.y, p2.y) - 10,
    };

    const mt = 1 - t;
    const x = mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x;
    const y = mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y;

    // Tangent for rotation (rocket points along the curve)
    const dx = 2 * mt * (p1.x - p0.x) + 2 * t * (p2.x - p1.x);
    const dy = 2 * mt * (p1.y - p0.y) + 2 * t * (p2.y - p1.y);
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);

    rocket.style.left = `${x}%`;
    rocket.style.top = `${y}%`;
    rocket.style.transform = `translate(-50%, -50%) rotate(${angle}deg)`;
    rocket.style.opacity = 1;
    rocket.style.pointerEvents = "auto";

    // Parallax: stars drift upward slightly as user scrolls down
    this.starTargets.forEach((star) => {
      const drift = -t * 55;
      star.style.transform = `translateY(${drift}px)`;
    });
  }
}
