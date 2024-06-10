import { Control } from "ol/control.js";

export class LayerVisibilityControl extends Control {
  static topOffset = 0;
  constructor(opt_options) {
    const options = opt_options || {};

    const div = document.createElement("div");
    div.className = "ol-unselectable ol-control";
    div.style.top = LayerVisibilityControl.topOffset + "px";
    div.style.right = 0;
    div.style.width = "200px";
    LayerVisibilityControl.topOffset += 20;
    div.style.backgroundColor = "white";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.name = options.layer.get("name");
    checkbox.checked = options.layer.getVisible();

    const label = document.createElement("label");
    label.htmlFor = checkbox.name;
    label.innerHTML = options.layer.get("name");

    div.appendChild(checkbox);
    div.appendChild(label);
    super({
      element: div,
      target: options.target,
    });

    checkbox.addEventListener(
      "click",
      () => {
        options.layer.setVisible(checkbox.checked);
      },
      false
    );
  }
}
