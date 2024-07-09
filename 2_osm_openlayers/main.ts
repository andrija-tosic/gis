import { Map, Overlay, View } from "ol";
import TileLayer from "ol/layer/Tile";
import { fromLonLat } from "ol/proj";
import OSM from "ol/source/OSM";
import {
  appendLayer,
  createTileLayer,
  createVectorLayer,
  fetchVectorLayers,
  fetchWMSLayers,
  mapOnClickEvHandler,
} from "../lib/src/util";
import "../lib/src/style.css";
import { WORKSPACE, PARAMETRIZED_LAYERS } from "../lib/src/constants";
import LayerGroup from "ol/layer/Group";

const legend: HTMLElement = document.getElementById("legend")!!;
const overlay = new Overlay({
  element: document.getElementById("popup") ?? undefined,
  autoPan: true,
});

const map = new Map({
  target: "map",
  layers: [
    new TileLayer({
      source: new OSM(),
    }),
  ],
  view: new View({
    center: fromLonLat([20.4, 44.05]),
    zoom: 7.4,
  }),
  overlays: [overlay],
});

const wmsLayers =
  (await fetchWMSLayers())?.filter(
    (layer) => !["autobuske beograd, autobuske nis"].includes(layer.name)
  ) ?? [];
const wfsLayers = (await fetchVectorLayers()) ?? [];

if (wfsLayers?.length > 0) {
  const wmsHeader = document.createElement("h2");
  wmsHeader.textContent = "Pločasti slojevi";
  legend.appendChild(wmsHeader);
}

wmsLayers
  .filter((l) => !PARAMETRIZED_LAYERS.has(l.name))
  .forEach((l) => appendLayer(map, overlay, createTileLayer(l), legend));

if (wfsLayers?.length > 0) {
  const wfsHeader = document.createElement("h2");
  wfsHeader.textContent = "Vektorski slojevi";
  legend.appendChild(wfsHeader);
}

const vectorLayers = wfsLayers
  .filter((l) => !PARAMETRIZED_LAYERS.has(l.name.replace(`${WORKSPACE}:`, "")))
  .map((l) => createVectorLayer(l));

const vlg = new LayerGroup({
  layers: vectorLayers.filter((l) =>
    [`${WORKSPACE}:autobuske beograd`, `${WORKSPACE}:autobuske nis`].includes(
      l.get("name")
    )
  ),
});
vlg.set("name", "bus_stops_layer_group");
vlg.set("title", "Autobuske stanice layer group");

const titleDiv = document.createElement("div");
const checkbox = document.createElement("input");
checkbox.type = "checkbox";
checkbox.checked = false;

vlg.setVisible(false);
map.addLayer(vlg);

checkbox.addEventListener("change", () => {
  vlg.setVisible(checkbox.checked);
  overlay.setPosition(undefined);
});

titleDiv.appendChild(checkbox);
titleDiv.appendChild(document.createTextNode(vlg.get("title")));
legend.appendChild(titleDiv);

vectorLayers.forEach((vl) => appendLayer(map, overlay, vl, legend));

map.on("click", async (ev) => await mapOnClickEvHandler(map, overlay, ev));
