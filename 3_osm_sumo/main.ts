import { Map, Overlay, View } from "ol";
import { Coordinate } from "ol/coordinate";
import Layer from "ol/layer/Layer";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import { fromLonLat } from "ol/proj";
import OSM from "ol/source/OSM";
import {
  createTileLayer,
  createVectorLayer,
  getWFSLayersInfo,
  getWMSLayersInfo,
  updateVectorLayerParams,
} from "../lib/src/util";
import "./style.css";
import { Pixel } from "ol/pixel";
import Feature from "ol/Feature";
import { LayerInfo } from "../lib/src/types";
import Style from "ol/style/Style";
import Stroke from "ol/style/Stroke";
import Fill from "ol/style/Fill";
import CircleStyle from "ol/style/Circle";
import { WORKSPACE, sumoLayers } from "../lib/src/constants";

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
    center: fromLonLat([20.4612, 44.8125]),
    zoom: 13,
  }),
  overlays: [popup],
});

const wmsLayers =
  (await getWMSLayersInfo())
    ?.filter((layer) => !layer.keywords.includes("hide_wms"))
    .sort((l1, l2) => l1.title.localeCompare(l2.title)) ?? [];

const wfsLayers =
  (await getWFSLayersInfo()).sort((l1, l2) =>
    l1.title.localeCompare(l2.title)
  ) ?? [];

if (wfsLayers?.length > 0) {
  const wmsHeader = document.createElement("H4");
  wmsHeader.textContent = "WMS Layers";
  legend.appendChild(wmsHeader);
}

wmsLayers?.filter((l) => !sumoLayers.has(l.name)).forEach(initLayer);

if (wfsLayers?.length > 0) {
  const wfsHeader = document.createElement("H4");
  wfsHeader.textContent = "WFS Layers";
  legend.appendChild(wfsHeader);
}

wfsLayers
  ?.filter((l) => !sumoLayers.has(l.name.replace(WORKSPACE + ":", "")))
  .forEach(initLayer);

// const wfsHeader = document.createElement("hr");
// legend.appendChild(wfsHeader);

// wfsLayers.forEach(initLayer);

const offset = "2024-06-27 00:19:43.440427Z";
let timestamp = offset;
let veh_type = "veh_passenger";

const layerMostBusyStreet = createVectorLayer({
  name: "most_busy_street",
  params: { timestamp: timestamp, veh_type: "veh_passenger" },
  service: "WFS",
  title: "Most busy street",
  keywords: [],
  style: new Style({
    stroke: new Stroke({
      color: "#42cdff",
      width: 15,
    }),
  }),
});

const layerCarsOnMostBusyStreet = createVectorLayer({
  name: "cars_on_most_busy_street",
  params: { timestamp: timestamp, veh_type: "veh_passenger" },
  service: "WFS",
  title: "Cars on most busy street",
  keywords: [],
});

map.addLayer(layerMostBusyStreet);
map.addLayer(layerCarsOnMostBusyStreet);

const layerTrafficLightJams = createVectorLayer({
  name: "traffic_light_jams",
  params: { timestamp: timestamp, veh_type: "veh_passenger" },
  service: "WFS",
  title: "Traffic light jams",
  keywords: [],
  style: new Style({
    image: new CircleStyle({
      fill: new Fill({ color: "#ff0000" }),
      radius: 10,
      stroke: new Stroke({ color: "#00ff00", width: 3 }),
    }),
  }),
});

const layerCarsOnTrafficLightJams = createVectorLayer({
  name: "cars_on_traffic_light_jams",
  params: { timestamp: timestamp, veh_type: "veh_passenger" },
  service: "WFS",
  title: "Cars on traffic light jams",
  keywords: [],
});

map.addLayer(layerTrafficLightJams);
map.addLayer(layerCarsOnTrafficLightJams);

let surface = (document.querySelector("#surface-select") as HTMLInputElement)
  .value;

const layerBikeLanes = createVectorLayer({
  name: "bike_lanes",
  params: { surface },
  service: "WFS",
  title: "Cars on traffic light jams",
  keywords: [],
});

map.addLayer(layerBikeLanes);

document.querySelector("#surface-select")?.addEventListener("change", () => {
  let surface = (document.querySelector("#surface-select") as HTMLInputElement)
    .value;

  updateVectorLayerParams(layerBikeLanes, { surface });

  layerBikeLanes.getSource()?.refresh();
});

document.querySelectorAll("#time-slider, #type-select")!.forEach((el) =>
  el.addEventListener("change", (e) => {
    const sliderValue = (
      document.querySelector("#time-slider") as HTMLInputElement
    ).value;

    timestamp = new Date(new Date(offset).getTime() + +sliderValue * 60 * 1000)
      .toISOString()
      .replace("T", " ")
      .replace("Z", "");

    veh_type = (document.querySelector("#type-select") as HTMLInputElement)
      .value;

    if (veh_type === "person") veh_type = "NULL";

    updateVectorLayerParams(layerMostBusyStreet, { timestamp, veh_type });
    updateVectorLayerParams(layerCarsOnMostBusyStreet, { timestamp, veh_type });
    updateVectorLayerParams(layerTrafficLightJams, { timestamp, veh_type });
    updateVectorLayerParams(layerCarsOnTrafficLightJams, {
      timestamp,
      veh_type,
    });
  })
);

map.on("singleclick", async (evt) => {
  const featurePromises = map
    .getAllLayers()
    .slice(1)
    .filter((layer) => layer.isVisible())
    .toReversed()
    .map((layer) => {
      if (layer instanceof VectorLayer) {
        return Promise.resolve(
          getFirstFeatureFromVectorLayer(layer, evt.pixel)
        );
      } else if (layer instanceof TileLayer) {
        return getFirstFeatureFromTileLayer(layer, evt.coordinate);
      } else {
        return Promise.resolve(null);
      }
    });

  const feature = (await Promise.all(featurePromises)).find((f) => f !== null);

  if (!feature) {
    popup.setPosition(undefined);
    return;
  }

  const props =
    feature instanceof Feature ? feature.getProperties() : feature.properties;

  displayDetailsPopUp(evt.coordinate, props);
});

function getFirstFeatureFromVectorLayer(layer: VectorLayer<any>, pixel: Pixel) {
  const features = map.getFeaturesAtPixel(pixel);
  return features.length ? features[0] : null;
}

async function getFirstFeatureFromTileLayer(
  layer: TileLayer<any>,
  pixel: Pixel
) {
  const viewResolution = map.getView().getResolution();

  if (!viewResolution) return null;

  const url = layer
    ?.getSource()
    ?.getFeatureInfoUrl(pixel, viewResolution, "EPSG:3857", {
      INFO_FORMAT: "application/json",
    });

  if (!url) return null;

  const response = await fetch(url);
  const features = (await response.json()).features;

  return features.length > 0 ? features[0] : null;
}

function initLayer(layerInfo: LayerInfo) {
  const item = document.createElement("div");
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = false;

  let layer: Layer;
  if (layerInfo.service == "WMS") {
    layer = createTileLayer(layerInfo);
  } else {
    layer = createVectorLayer(layerInfo);
  }
  layer.setVisible(false);
  map.addLayer(layer);

  checkbox.addEventListener("change", (_) => {
    layer.setVisible(checkbox.checked);
    popup.setPosition(undefined);
  });
  item.appendChild(checkbox);
  item.appendChild(document.createTextNode(layerInfo.title));
  legend.appendChild(item);
}

function displayDetailsPopUp(coordinate: Coordinate, props: any) {
  let info = "";
  for (const [key, value] of Object.entries(props)) {
    if (
      !value ||
      key == "way" ||
      (typeof value !== "string" && typeof value !== "number")
    ) {
      continue;
    }

    info = info.concat(`${sanitaze(key)}: ${sanitazeValue(key, value)}<br>`);
  }

  const popupContent = document.getElementById("popup-content");
  if (popupContent) {
    popupContent.innerHTML = info;
  }

  popup.setPosition(coordinate);
}

function sanitaze(key: string): string {
  return capitalize(key.replace(/[:_]/g, " "));
}

function sanitazeValue(key: string, value: string | number): string {
  if (typeof value === "string" && key !== "ele") {
    return sanitaze(value);
  }

  const numberValue = value as number;

  const searchableKey = key.toLocaleLowerCase();
  if (searchableKey.indexOf("area") >= 0) {
    return numberValue < 1000000
      ? `${numberValue} m²`
      : `${(numberValue / 1000000).toFixed(2)} km²`;
  } else if (searchableKey.indexOf("ele") >= 0) {
    return `${numberValue} m`;
  }

  return value.toString();
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
