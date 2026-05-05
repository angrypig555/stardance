import { Controller } from "@hotwired/stimulus";

export default class extends Controller {
  fall(event) {
    event.preventDefault();
    event.stopPropagation();
    this.element.classList.add("is-falling");
  }
}
