import { Controller } from "@hotwired/stimulus";

// Bio editor: a contenteditable surface with @user / $project autocomplete.
// Saved bio text uses tokens: <@USER_ID> and <$PROJECT_ID>. Token tokens are
// rendered as inline chips (contenteditable=false) inside the editor; plain
// text passes through verbatim.
//
// Wired via:
//   data-bio-editor-users-url-value="/search/users.json"
//   data-bio-editor-projects-url-value="/search/projects.json"
//   data-bio-editor-initial-value="<@123> hi <$45>"
//
// Targets: editor (contenteditable), hidden (form input), suggest (dropdown).
export default class extends Controller {
  static targets = ["editor", "hidden", "suggest"];
  static values = {
    usersUrl: String,
    projectsUrl: String,
    initial: String
  };

  connect() {
    this._activeIndex = 0;
    this._suggestions = [];
    this._triggerKind = null; // "user" | "project"
    this._triggerStart = null; // text-node + offset where the trigger char sits
    this._renderInitial(this.initialValue || "");
    this._attachSubmitSerializer();
  }

  disconnect() {
    if (this._submitHandler && this._form) {
      this._form.removeEventListener("submit", this._submitHandler);
    }
  }

  // --- input/keyboard handling --------------------------------------------

  onInput() {
    this._maybeShowSuggestions();
  }

  onKeydown(event) {
    if (this.suggestTarget.hidden) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      this._moveActive(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      this._moveActive(-1);
    } else if (event.key === "Enter" || event.key === "Tab") {
      const choice = this._suggestions[this._activeIndex];
      if (choice) {
        event.preventDefault();
        this._insertChoice(choice);
      }
    } else if (event.key === "Escape") {
      this._hideSuggestions();
    }
  }

  onBlur() {
    // Allow click on suggestion to register before hiding.
    setTimeout(() => this._hideSuggestions(), 120);
  }

  // --- render initial bio with chips --------------------------------------

  _renderInitial(text) {
    const TOKEN_RE = /<(@|\$)(\d+)>/g;
    this.editorTarget.innerHTML = "";

    let cursor = 0;
    let match;
    const ids = { user: [], project: [] };
    while ((match = TOKEN_RE.exec(text)) !== null) {
      ids[match[1] === "@" ? "user" : "project"].push(parseInt(match[2], 10));
    }

    Promise.all([
      ids.user.length    ? this._fetch(this.usersUrlValue, "")    : Promise.resolve([]),
      ids.project.length ? this._fetch(this.projectsUrlValue, "") : Promise.resolve([])
    ]).then(() => {
      // We don't actually rely on the bulk fetch result — we resolve names on the fly.
    });

    // Walk through text and append text + chips. Resolution is best-effort:
    // for unresolvable IDs we show the raw token.
    cursor = 0;
    TOKEN_RE.lastIndex = 0;
    while ((match = TOKEN_RE.exec(text)) !== null) {
      if (match.index > cursor) {
        this.editorTarget.appendChild(document.createTextNode(text.slice(cursor, match.index)));
      }
      const sigil = match[1];
      const id = match[2];
      const chip = this._buildChip(
        sigil === "@" ? "user" : "project",
        id,
        sigil === "@" ? `@${id}` : `#${id}` // placeholder until resolved
      );
      this.editorTarget.appendChild(chip);
      this._resolveChipLabel(chip, sigil === "@" ? "user" : "project", id);
      cursor = TOKEN_RE.lastIndex;
    }
    if (cursor < text.length) {
      this.editorTarget.appendChild(document.createTextNode(text.slice(cursor)));
    }
  }

  _resolveChipLabel(chip, kind, id) {
    const url = kind === "user" ? this.usersUrlValue : this.projectsUrlValue;
    const params = new URLSearchParams({ id });
    fetch(`${url}?${params}`, { headers: { Accept: "application/json" } })
      .then((r) => (r.ok ? r.json() : []))
      .then((items) => {
        const item = items.find((i) => String(i.id) === String(id));
        if (!item) return;
        chip.textContent = kind === "user" ? `@${item.display_name}` : item.title;
      })
      .catch(() => {});
  }

  // --- autocomplete -------------------------------------------------------

  _maybeShowSuggestions() {
    const ctx = this._readTriggerContext();
    if (!ctx) {
      this._hideSuggestions();
      return;
    }

    this._triggerKind = ctx.kind;
    this._triggerStart = ctx.start;

    const url = ctx.kind === "user" ? this.usersUrlValue : this.projectsUrlValue;
    this._fetch(url, ctx.query).then((items) => {
      this._suggestions = items;
      this._activeIndex = 0;
      this._renderSuggestions();
    });
  }

  // Look at the text immediately before the caret. Reads via a Range so it
  // works regardless of whether the caret is in a text node, an element, or
  // inside a per-line <div> wrapper.
  _readTriggerContext() {
    const sel = window.getSelection();
    if (!sel || !sel.isCollapsed || sel.rangeCount === 0) return null;
    const caret = sel.getRangeAt(0);
    if (!this.editorTarget.contains(caret.startContainer)) return null;

    const pre = document.createRange();
    pre.setStart(this.editorTarget, 0);
    pre.setEnd(caret.startContainer, caret.startOffset);
    const text = pre.cloneContents().textContent || "";

    const match = text.match(/(?:^|\s)([@$])([^\s<>]{0,40})$/);
    if (!match) return null;

    return {
      kind: match[1] === "@" ? "user" : "project",
      query: match[2]
    };
  }

  _fetch(url, q) {
    const params = new URLSearchParams({ q: q || "" });
    return fetch(`${url}?${params}`, { headers: { Accept: "application/json" } })
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => []);
  }

  _renderSuggestions() {
    if (!this._suggestions.length) {
      this._hideSuggestions();
      return;
    }
    this.suggestTarget.innerHTML = this._suggestions
      .map((item, idx) => this._suggestRow(item, idx))
      .join("");
    this.suggestTarget.hidden = false;

    Array.from(this.suggestTarget.querySelectorAll("[data-suggest-index]"))
      .forEach((row) => {
        row.addEventListener("mousedown", (e) => {
          e.preventDefault();
          const idx = parseInt(row.dataset.suggestIndex, 10);
          const choice = this._suggestions[idx];
          if (choice) this._insertChoice(choice);
        });
      });
  }

  _suggestRow(item, idx) {
    const active = idx === this._activeIndex ? " profile__bio-suggest-item--active" : "";
    if (this._triggerKind === "user") {
      const avatar = item.avatar
        ? `<img class="profile__bio-suggest-avatar" src="${item.avatar}" alt="">`
        : "";
      return `<div class="profile__bio-suggest-item${active}" role="option" data-suggest-index="${idx}">${avatar}<span>@${escapeHtml(item.display_name)}</span></div>`;
    }
    return `<div class="profile__bio-suggest-item${active}" role="option" data-suggest-index="${idx}"><span>${escapeHtml(item.title)}</span></div>`;
  }

  _moveActive(delta) {
    if (!this._suggestions.length) return;
    this._activeIndex = (this._activeIndex + delta + this._suggestions.length) % this._suggestions.length;
    this._renderSuggestions();
  }

  _hideSuggestions() {
    this.suggestTarget.hidden = true;
    this.suggestTarget.innerHTML = "";
    this._suggestions = [];
    this._triggerKind = null;
    this._triggerStart = null;
  }

  // --- chip insertion -----------------------------------------------------

  _insertChoice(item) {
    const sel = window.getSelection();
    if (!sel || !sel.isCollapsed || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE || !this.editorTarget.contains(node)) return;

    // Find where the @/$ trigger started in this text node.
    const before = node.textContent.slice(0, range.startOffset);
    const triggerMatch = before.match(/[@$][^\s<>]*$/);
    if (!triggerMatch) return;
    const triggerStart = before.length - triggerMatch[0].length;

    const head = node.textContent.slice(0, triggerStart);
    const tailText = node.textContent.slice(range.startOffset);
    node.textContent = head;

    const chip = this._buildChip(
      this._triggerKind,
      item.id,
      this._triggerKind === "user" ? `@${item.display_name}` : item.title
    );
    // Trailing text starts with a ZWSP + space — the ZWSP gives the caret a
    // safe text-node anchor immediately after the chip (otherwise some
    // browsers route subsequent typing back into the chip's text node).
    const trailing = document.createTextNode("​ " + tailText);

    const parent = node.parentNode;
    parent.insertBefore(chip, node.nextSibling);
    parent.insertBefore(trailing, chip.nextSibling);

    // Restore focus to the editor before setting the caret. Suggestion-row
    // mousedowns blur the editor briefly; without re-focusing, the caret
    // position we set below is silently dropped.
    this.editorTarget.focus();

    const newRange = document.createRange();
    // Caret lands after the ZWSP + space (offset 2) so the user types into
    // a clean text node.
    newRange.setStart(trailing, 2);
    newRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(newRange);

    this._hideSuggestions();
  }

  _buildChip(kind, id, label) {
    const span = document.createElement("span");
    span.className = "bio-chip";
    // setAttribute is more reliable than the JS property form across browsers
    // (Firefox in particular sometimes lets typing leak into a chip when the
    //  property is set rather than the attribute).
    span.setAttribute("contenteditable", "false");
    span.dataset.kind = kind;
    span.dataset.id = String(id);
    span.textContent = label;
    return span;
  }

  // --- form submission ----------------------------------------------------

  _attachSubmitSerializer() {
    this._form = this.element.closest("form");
    if (!this._form) return;
    this._submitHandler = () => {
      this.hiddenTarget.value = this._serialize();
    };
    this._form.addEventListener("submit", this._submitHandler);
  }

  _serialize() {
    const parts = [];
    this.editorTarget.childNodes.forEach((node) => {
      parts.push(this._serializeNode(node));
    });
    // Drop the zero-width-space anchors we use as caret-safe landings around
    // chips, then trim leading/trailing newlines and collapse runs of
    // newlines added by block-level wrappers around chips or lines.
    return parts.join("")
      .replace(/​/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/^\n+|\n+$/g, "");
  }

  _serializeNode(node) {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent;
    if (node.nodeType !== Node.ELEMENT_NODE) return "";

    if (node.classList?.contains("bio-chip")) {
      return node.dataset.kind === "user" ? `<@${node.dataset.id}>` : `<$${node.dataset.id}>`;
    }

    if (node.tagName === "BR") return "\n";

    let inner = "";
    node.childNodes.forEach((c) => { inner += this._serializeNode(c); });

    if (node.tagName === "DIV" || node.tagName === "P") {
      // Each block element becomes a newline-prefixed line, except the first
      // node (the leading newline gets trimmed by _serialize).
      return "\n" + inner;
    }
    return inner;
  }
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
