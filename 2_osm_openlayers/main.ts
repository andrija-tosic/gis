import { Map, Overlay, View } from "ol";
import { Coordinate } from "ol/coordinate";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import { fromLonLat } from "ol/proj";
import OSM from "ol/source/OSM";
import {
  createTileLayer,
  createVectorLayer,
  getFirstFeatureFromTileLayer,
  getFirstFeatureFromVectorLayer,
  getWFSLayersInfo,
  getWMSLayersInfo,
  sanitize as sanitize,
  sanitizeValue as sanitizeValue,
} from "../lib/src/util";
import "./style.css";
import { WORKSPACE, parametrizedLayers } from "../lib/src/constants";
import { LayerInfo } from "../lib/src/types";
import BaseLayer from "ol/layer/Base";

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
  (await getWMSLayersInfo())?.filter(
    (layer) => !layer.keywords.includes("hide_wms")
  ) ?? [];
const wfsLayers = (await getWFSLayersInfo()) ?? [];

if (wfsLayers?.length > 0) {
  const wmsHeader = document.createElement("H4");
  wmsHeader.textContent = "WMS slojevi";
  legend.appendChild(wmsHeader);
}

const initLayer = (layerInfo: LayerInfo) => {
  const item = document.createElement("div");
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = false;

  let layer;
  if (layerInfo.service == "WMS") {
    layer = createTileLayer(layerInfo);
  } else {
    layer = createVectorLayer(layerInfo);
  }
  layer.setVisible(false);
  map.addLayer(layer as unknown as BaseLayer);

  checkbox.addEventListener("change", (_) => {
    layer.setVisible(checkbox.checked);
    popup.setPosition(undefined);
  });
  item.appendChild(checkbox);
  item.appendChild(document.createTextNode(layerInfo.title));
  legend.appendChild(item);
};

wmsLayers?.filter((l) => !parametrizedLayers.has(l.name)).forEach(initLayer);

if (wfsLayers?.length > 0) {
  const wfsHeader = document.createElement("H4");
  wfsHeader.textContent = "WFS slojevi";
  legend.appendChild(wfsHeader);
}

wfsLayers
  ?.filter((l) => !parametrizedLayers.has(l.name.replace(WORKSPACE + ":", "")))
  .forEach(initLayer);

map.on("singleclick", async (evt) => {
  const featurePromises = map
    .getAllLayers()
    .slice(1)
    .filter((layer) => layer.isVisible())
    .toReversed()
    .map((layer) => {
      if (layer instanceof VectorLayer) {
        return Promise.resolve(getFirstFeatureFromVectorLayer(map, evt.pixel));
      } else if (layer instanceof TileLayer) {
        return getFirstFeatureFromTileLayer(map, layer, evt.coordinate);
      } else {
        return Promise.resolve(null);
      }
    });

  const feature = (await Promise.all(featurePromises)).find((f) => f !== null);

  if (!feature) {
    popup.setPosition(undefined);
    return;
  }

  const props = feature.getProperties() ?? feature.properties;

  displayDetailsPopUp(evt.coordinate, props);
});

const displayDetailsPopUp = (coordinate: Coordinate, props: any) => {
  let info = "";
  for (const [key, value] of Object.entries(props)) {
    if (
      !value ||
      key == "way" ||
      (typeof value !== "string" && typeof value !== "number")
    ) {
      continue;
    }

    info = info.concat(`${sanitize(key)}: ${sanitizeValue(key, value)}<br>`);
  }

  document.getElementById("popup-content")!.innerHTML = info;

  popup.setPosition(coordinate);
};
