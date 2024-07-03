import { Map, Overlay, View } from "ol";
import { Coordinate } from "ol/coordinate";
import Layer from "ol/layer/Layer";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import { fromLonLat } from "ol/proj";
import OSM from "ol/source/OSM";
import {
  createIconStyle,
  createTileLayer,
  createVectorLayer,
  getFirstFeatureFromTileLayer,
  getFirstFeatureFromVectorLayer,
  getWFSLayersInfo,
  getWMSLayersInfo,
  sanitize,
  sanitizeValue,
  updateVectorLayer,
} from "../lib/src/util";
import "./style.css";
import { LayerInfo } from "../lib/src/types";
import Style from "ol/style/Style";
import Stroke from "ol/style/Stroke";
import Fill from "ol/style/Fill";
import CircleStyle from "ol/style/Circle";
import { WORKSPACE, parametrizedLayers } from "../lib/src/constants";
import Icon from "ol/style/Icon";

const legend: HTMLElement = document.getElementById("legend")!!;
const sumoLegend: HTMLElement = document.getElementById("sumo")!!;
const layersDiv: HTMLElement = document.getElementById("layers")!!;
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
  wmsHeader.textContent = "WMS slojevi";
  layersDiv.appendChild(wmsHeader);
}

wmsLayers
  ?.filter((l) => !parametrizedLayers.has(l.name))
  .forEach((l) => initLayer(l, layersDiv));

if (wfsLayers?.length > 0) {
  const wfsHeader = document.createElement("H4");
  wfsHeader.textContent = "WFS slojevi";
  layersDiv.appendChild(wfsHeader);
}

wfsLayers
  ?.filter((l) => !parametrizedLayers.has(l.name.replace(`${WORKSPACE}:`, "")))
  .forEach((l) => initLayer(l, layersDiv));

const offset = "2024-06-27 00:19:43.440427";
let timestamp = offset;
let veh_type = "veh_passenger";
let count = 1;

const vectorLayerMostBusyStreet = initLayer(
  {
    name: "most_busy_street",
    params: { timestamp, veh_type },
    service: "WFS",
    title: "Ulica sa najgušćim saobraćajem",
    keywords: [],
    style: (feature) =>
      new Style({
        stroke: new Stroke({
          color: "#42cdff",
          width: 15,
        }),
      }),
  },
  sumoLegend
) as VectorLayer<any>;

const vectorLayerCarsOnMostBusyStreet = initLayer(
  {
    name: "cars_on_most_busy_street",
    params: { timestamp, veh_type, count },
    service: "WFS",
    title: "Vozila na ulici sa najgušćim saobraćajem",
    keywords: [],
  },
  sumoLegend
) as VectorLayer<any>;

const vectorLayerTrafficLightJams = initLayer(
  {
    name: "traffic_light_jams",
    params: { timestamp, veh_type, count },
    service: "WFS",
    title: "Semafori sa kolonama vozila",
    keywords: [],
    style: (feature) =>
      new Style({
        image: new CircleStyle({
          fill: new Fill({ color: "#ff0000" }),
          radius: 10,
          stroke: new Stroke({ color: "#00ff00", width: 3 }),
        }),
      }),
  },
  sumoLegend
) as VectorLayer<any>;

const vectorLayerCarsOnTrafficLightJams = initLayer(
  {
    name: "cars_on_traffic_light_jams",
    params: { timestamp, veh_type, count },
    service: "WFS",
    title: "Kolona vozila na semaforima",
    keywords: [],
    style: createIconStyle(veh_type),
  },
  sumoLegend
) as VectorLayer<any>;

let surface = (document.querySelector("#surface-select") as HTMLInputElement)
  .value;

const vectorLayerBikeLanes = initLayer(
  {
    name: "bike_lanes",
    params: { surface },
    service: "WFS",
    title: "Biciklističke staze",
    keywords: [],
  },
  sumoLegend
) as VectorLayer<any>;

const vectorLayerFastestVehiclesAtTimestamp = initLayer(
  {
    name: "fastest_vehicles_at_timestamp",
    params: { timestamp, veh_type },
    service: "WFS",
    title: "Najbrža vozila",
    keywords: [],
    style: createIconStyle(veh_type),
  },
  sumoLegend
) as VectorLayer<any>;

document.querySelector("#surface-select")?.addEventListener("change", () => {
  let surface = (document.querySelector("#surface-select") as HTMLInputElement)
    .value;

  updateVectorLayer(
    vectorLayerBikeLanes,
    { surface },
    createIconStyle(veh_type)
  );
});

document
  .querySelectorAll("#time-slider, #type-select, #min-vehicles-number")!
  .forEach((el) =>
    el.addEventListener("change", (e) => {
      const sliderValue = (
        document.querySelector("#time-slider") as HTMLInputElement
      ).value;

      timestamp = new Date(
        new Date(offset + "Z").getTime() + +sliderValue * 60 * 1000
      )
        .toISOString()
        .replace("T", " ")
        .replace("Z", "");

      veh_type = (document.querySelector("#type-select") as HTMLInputElement)
        .value;

      count = +(
        document.querySelector("#min-vehicles-number") as HTMLInputElement
      ).value;

      updateVectorLayer(
        vectorLayerMostBusyStreet,
        {
          timestamp,
          veh_type,
          count,
        },
        createIconStyle(veh_type)
      );
      updateVectorLayer(
        vectorLayerCarsOnMostBusyStreet,
        {
          timestamp,
          veh_type,
          count,
        },
        createIconStyle(veh_type)
      );
      updateVectorLayer(
        vectorLayerTrafficLightJams,
        {
          timestamp,
          veh_type,
          count,
        },
        createIconStyle(veh_type)
      );
      updateVectorLayer(
        vectorLayerCarsOnTrafficLightJams,
        {
          timestamp,
          veh_type,
          count,
        },
        createIconStyle(veh_type)
      );
      updateVectorLayer(
        vectorLayerFastestVehiclesAtTimestamp,
        {
          timestamp,
          veh_type,
        },
        createIconStyle(veh_type)
      );
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

function initLayer(layerInfo: LayerInfo, parent: HTMLElement) {
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
  parent.appendChild(item);

  return layer;
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

    info = info.concat(`${sanitize(key)}: ${sanitizeValue(key, value)}<br>`);
  }

  document.getElementById("popup-content")!.innerHTML = info;

  popup.setPosition(coordinate);
}
