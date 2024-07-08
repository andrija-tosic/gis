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
  getFeaturesOnMapClick,
} from "../lib/src/util";
import "../lib/src/style.css";
import { WORKSPACE, PARAMETRIZED_LAYERS } from "../lib/src/constants";

const legend: HTMLElement = document.getElementById("legend")!!;
const popup = new Overlay({
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
  overlays: [popup],
});

const wmsLayers =
  (await fetchWMSLayers())?.filter(
    (layer) => !layer.keywords?.includes("hide_wms")
  ) ?? [];
const wfsLayers = (await fetchVectorLayers()) ?? [];

if (wfsLayers?.length > 0) {
  const wmsHeader = document.createElement("h2");
  wmsHeader.textContent = "Pločasti slojevi";
  legend.appendChild(wmsHeader);
}

wmsLayers
  .filter((l) => !PARAMETRIZED_LAYERS.has(l.name))
  .forEach((l) => appendLayer(map, popup, createTileLayer(l), legend));

if (wfsLayers?.length > 0) {
  const wfsHeader = document.createElement("h2");
  wfsHeader.textContent = "Vektorski slojevi";
  legend.appendChild(wfsHeader);
}

wfsLayers
  .filter((l) => !PARAMETRIZED_LAYERS.has(l.name.replace(WORKSPACE + ":", "")))
  .forEach((l) => appendLayer(map, popup, createVectorLayer(l), legend));

map.on("click", getFeaturesOnMapClick(map, popup));
