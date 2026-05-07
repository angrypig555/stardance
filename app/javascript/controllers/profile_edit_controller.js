import { Controller } from "@hotwired/stimulus";

// Toggles read/edit mode on the user profile. The actual bio editor lives in
// bio_editor_controller; this controller only swaps button states and reveals
// the editor + banner upload affordances.
export default class extends Controller {
  static targets = [
    "bioView",
    "bioEdit",
    "editBtn",
    "saveBtn",
    "cancelBtn",
    "banner",
    "bannerLabel",
    "bannerInput",
  ];
  static classes = ["editing"];
  static values = { defaultBanner: String };

  connect() {
    this._originalBanner = this.bannerTarget.style.backgroundImage;
  }

  enter(event) {
    event?.preventDefault();
    this.element.classList.add(this.editingClass);
    this._toggleHidden(this.editBtnTarget, true);
    this._toggleHidden(this.saveBtnTarget, false);
    this._toggleHidden(this.cancelBtnTarget, false);
    if (this.hasBioEditTarget) this.bioEditTarget.hidden = false;
    if (this.hasBioViewTarget) this.bioViewTarget.hidden = true;
  }

  cancel(event) {
    event?.preventDefault();
    this.element.classList.remove(this.editingClass);
    this._toggleHidden(this.editBtnTarget, false);
    this._toggleHidden(this.saveBtnTarget, true);
    this._toggleHidden(this.cancelBtnTarget, true);
    if (this.hasBioEditTarget) this.bioEditTarget.hidden = true;
    if (this.hasBioViewTarget) this.bioViewTarget.hidden = false;

    // Revert banner preview
    this.bannerTarget.style.backgroundImage = this._originalBanner;
    if (this.hasBannerInputTarget) this.bannerInputTarget.value = "";
  }

  previewBanner() {
    const file = this.bannerInputTarget.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    this.bannerTarget.style.backgroundImage = `url('${url}')`;
  }

  _toggleHidden(el, hidden) {
    if (!el) return;
    el.hidden = hidden;
  }
}
