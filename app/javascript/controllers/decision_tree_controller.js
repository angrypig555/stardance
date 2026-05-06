import { Controller } from "@hotwired/stimulus";

export default class extends Controller {
  static targets = ["breadcrumb", "nodes"];
  static values = { nodes: Object, root: String };

  connect() {
    this.nodes = this.nodesValue;
    this.root = this.rootValue;
    this.firstRender = true;

    this.boundOnHash = this.#syncFromHash.bind(this);
    window.addEventListener("hashchange", this.boundOnHash);

    this.#syncFromHash();
  }

  disconnect() {
    if (this.boundOnHash) {
      window.removeEventListener("hashchange", this.boundOnHash);
    }
  }

  go(event) {
    event.preventDefault();
    const id = event.currentTarget.dataset.id;
    if (!id || !this.nodes[id]) return;
    this.#setNode(id);
  }

  back(event) {
    event.preventDefault();
    const id = event.currentTarget.dataset.parent;
    if (!id || !this.nodes[id]) return;
    this.#setNode(id);
  }

  reset(event) {
    event?.preventDefault();
    this.#setNode(this.root);
  }

  #setNode(id) {
    const target = `#node=${encodeURIComponent(id)}`;
    if (window.location.hash !== target) {
      history.replaceState(null, "", target);
    }
    this.#render(id);
  }

  #syncFromHash() {
    const m = window.location.hash.match(/node=([^&]+)/);
    const id = m ? decodeURIComponent(m[1]) : this.root;
    this.#render(this.nodes[id] ? id : this.root);
  }

  #render(id) {
    const node = this.nodes[id];
    if (!node) return;

    this.#renderBreadcrumb(id);
    this.#renderNode(node, id);

    // After the very first render (page load), move focus to the new
    // heading so keyboard + screen-reader users land in the right spot.
    // We skip the initial render so we don't yank the page on load.
    if (!this.firstRender) {
      const heading = this.nodesTarget.querySelector(
        ".decision-tree__question",
      );
      if (heading) {
        heading.setAttribute("tabindex", "-1");
        heading.focus({ preventScroll: true });
      }
      this.element.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
    this.firstRender = false;
  }

  #renderBreadcrumb(id) {
    const path = this.#pathTo(id);
    const root = this.nodes[this.root];

    const items = path.map((nid, i) => {
      const isCurrent = i === path.length - 1;
      const label = this.#breadcrumbLabel(nid, root);
      if (isCurrent) {
        return `<span class="decision-tree__breadcrumb-step decision-tree__breadcrumb-step--current" aria-current="step">${this.#escape(label)}</span>`;
      }
      return `<button type="button" class="decision-tree__breadcrumb-step" data-action="click->decision-tree#go" data-id="${this.#escape(nid)}" aria-label="Go back to ${this.#escape(label)}">${this.#escape(label)}</button>`;
    });

    const sep = `<span class="decision-tree__breadcrumb-sep" aria-hidden="true">›</span>`;
    const trail = items.join(sep);
    const reset =
      path.length > 1
        ? `<button type="button" class="decision-tree__breadcrumb-reset" data-action="click->decision-tree#reset">Start over</button>`
        : "";

    this.breadcrumbTarget.innerHTML = trail + reset;
  }

  #breadcrumbLabel(id, root) {
    if (id === this.root) return "Start";
    const node = this.nodes[id];
    if (!node) return id;
    if (node.title) return node.title;

    // It's a question; find the choice in the parent that points here
    const parent = this.nodes[node.parent];
    if (parent && Array.isArray(parent.choices)) {
      const choice = parent.choices.find((c) => c.id === id);
      if (choice) return choice.title;
    }
    return node.question || id;
  }

  #renderNode(node, id) {
    if (node.type === "question") {
      this.nodesTarget.innerHTML = this.#renderQuestion(node, id);
    } else {
      this.nodesTarget.innerHTML = this.#renderLeaf(node, id);
    }
  }

  #renderQuestion(node, id) {
    const intro = node.intro ? `<p>${this.#escape(node.intro)}</p>` : "";
    const choices = (node.choices || [])
      .map(
        (c) => `
      <button type="button"
              class="decision-tree__choice"
              role="listitem"
              data-action="click->decision-tree#go"
              data-id="${this.#escape(c.id)}">
        <span class="decision-tree__choice-emoji" aria-hidden="true">${this.#escape(c.emoji || "•")}</span>
        <span class="decision-tree__choice-body">
          <strong>${this.#escape(c.title)}</strong>
          ${c.subtitle ? `<span>${this.#escape(c.subtitle)}</span>` : ""}
        </span>
        <span class="decision-tree__choice-arrow" aria-hidden="true">→</span>
      </button>
    `,
      )
      .join("");

    const back = id === this.root ? "" : this.#renderBack(node.parent);

    return `
      <div class="decision-tree__node decision-tree__node--active" role="group" aria-labelledby="dt-q-${this.#escape(id)}">
        <h2 class="decision-tree__question" id="dt-q-${this.#escape(id)}">${this.#escape(node.question)}</h2>
        ${intro}
        <div class="decision-tree__choices" role="list">${choices}</div>
        ${back}
      </div>
    `;
  }

  #renderBack(parentId) {
    const target = parentId || this.root;
    const parent = this.nodes[target];
    const label = parent
      ? parent.question || parent.title || "previous step"
      : "previous step";
    return `<button type="button" class="decision-tree__back" data-action="click->decision-tree#back" data-parent="${this.#escape(target)}" aria-label="Back to ${this.#escape(label)}">← Back</button>`;
  }

  #renderLeaf(node, id) {
    const intro = node.intro ? `<p>${this.#escape(node.intro)}</p>` : "";

    const shipped = node.shipped_means
      ? `<h3>What "shipped" means here</h3><p>${this.#escape(node.shipped_means)}</p>`
      : "";

    const demo = (node.demo_options || []).length
      ? `<h3>Where to host the demo</h3><ul>${node.demo_options.map((o) => `<li>${o}</li>`).join("")}</ul>`
      : "";

    const readme = (node.readme_must_haves || []).length
      ? `<h3>What your README must include</h3><ul>${node.readme_must_haves.map((o) => `<li>${this.#escape(o)}</li>`).join("")}</ul>`
      : "";

    const flags = (node.common_flags || []).length
      ? `<h3>Common reasons projects bounce</h3><ul>${node.common_flags.map((o) => `<li>${this.#escape(o)}</li>`).join("")}</ul>`
      : "";

    const examples = (node.examples || []).length
      ? `<h3>Real examples</h3><ul>${node.examples
          .map((e) => {
            if (e.url)
              return `<li><a href="${this.#escape(e.url)}" target="_blank" rel="noopener">${this.#escape(e.name)}</a> — ${this.#escape(e.note)}</li>`;
            return `<li><strong>${this.#escape(e.name)}</strong> — ${this.#escape(e.note)}</li>`;
          })
          .join("")}</ul>`
      : "";

    const back = this.#renderBack(node.parent);

    return `
      <div class="decision-tree__node decision-tree__node--active decision-tree__leaf" role="group" aria-labelledby="dt-q-${this.#escape(id)}">
        <h2 class="decision-tree__question" id="dt-q-${this.#escape(id)}">${this.#escape(node.title)}</h2>
        ${intro}
        ${shipped}
        ${demo}
        ${readme}
        ${flags}
        ${examples}
        ${back}
      </div>
    `;
  }

  #pathTo(id) {
    const path = [];
    let cur = id;
    let safety = 0;
    while (cur && safety++ < 32) {
      path.unshift(cur);
      const n = this.nodes[cur];
      if (!n || !n.parent) break;
      cur = n.parent;
    }
    return path;
  }

  #escape(s) {
    if (s == null) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}
