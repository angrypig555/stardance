import { Controller } from "@hotwired/stimulus";

export default class extends Controller {
  connect() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (typeof IntersectionObserver === "undefined") return;

    this.io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        this.io.disconnect();
        this._timer = setTimeout(() => {
          this.element.classList.add("is-pulsed");
        }, 700);
      },
      { threshold: 0.8 },
    );

    this.io.observe(this.element);
  }

  disconnect() {
    this.io?.disconnect();
    clearTimeout(this._timer);
  }
}
