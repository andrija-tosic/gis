import { Feature, Map, Overlay, View } from "ol";
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
import { Style, Stroke, Text, Fill } from "ol/style";
import {
  GEOSERVER_URI,
  WORKSPACE,
  parametrizedLayers,
} from "../lib/src/constants";
import { LineString } from "ol/geom";
import VectorSource from "ol/source/Vector";
import GeoJSON from "ol/format/GeoJSON";
import { bbox as bboxStrategy } from "ol/loadingstrategy";
import Heatmap from "ol/layer/Heatmap";

const sumoLegend: HTMLElement = document.getElementById("sumo")!;
const layersDiv: HTMLElement = document.getElementById("layers")!;
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

const initLayer = (layerInfo: LayerInfo, parent?: HTMLElement) => {
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
  parent?.appendChild(item);

  return layer;
};

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

const offset = "2024-07-04 09:11:12.000302";
let timestamp = offset;
let veh_type = "veh_passenger";
let cnt = "1";

const vectorLayerMostBusyStreet = initLayer(
  {
    name: "most_busy_street",
    params: { timestamp, veh_type, cnt },
    service: "WFS",
    title: "Ulica sa najgušćim saobraćajem",
    keywords: [],
    style: new Style({
      stroke: new Stroke({
        color: "#cc1836",
        width: 15,
      }),
    }),
  },
  sumoLegend
) as VectorLayer<any>;

const vectorLayerCarsOnMostBusyStreet = initLayer(
  {
    name: "cars_on_most_busy_street",
    params: { timestamp, veh_type, cnt },
    service: "WFS",
    title: "Objekti na ulici sa najgušćim saobraćajem",
    keywords: [],
    style: createIconStyle(veh_type),
  },
  sumoLegend
) as VectorLayer<any>;

const vectorLayerTrafficLightJams = initLayer(
  {
    name: "traffic_light_jams",
    params: { timestamp, veh_type, cnt },
    service: "WFS",
    title: "Semafori sa kolonama objekata",
    keywords: [],
    style: createIconStyle("traffic-light"),
  },
  sumoLegend
) as VectorLayer<any>;

const vectorLayerCarsOnTrafficLightJams = initLayer(
  {
    name: "cars_on_traffic_light_jams",
    params: { timestamp, veh_type },
    service: "WFS",
    title: "Kolona objekata na semaforima",
    keywords: [],
    style: createIconStyle(veh_type),
  },
  sumoLegend
) as VectorLayer<any>;

let surface = (document.querySelector("#surface-select") as HTMLInputElement)
  .value;

const bikeLanesVectorStyle = (surface: string) =>
  new Style({
    stroke: new Stroke({
      color: {
        ["asphalt"]: "#db9d00",
        ["dirt"]: "#993000",
        ["concrete"]: "#4f7b7d",
        ["gravel"]: "##7c8e8f",
        ["grass"]: "#13ab48",
      }[surface],
      width: 5,
    }),
  });

const vectorLayerBikeLanes = initLayer(
  {
    name: "bike_lanes",
    params: { surface },
    service: "WFS",
    title: "Biciklističke staze",
    keywords: [],
    style: bikeLanesVectorStyle(surface),
  },
  sumoLegend
) as VectorLayer<any>;

const vectorLayerFastestVehiclesAtTimestamp = initLayer(
  {
    name: "fastest_vehicles_at_timestamp",
    params: { timestamp, veh_type },
    service: "WFS",
    title: "Najbrži objekti",
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
    bikeLanesVectorStyle(surface)
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

      cnt = (document.querySelector("#min-vehicles-number") as HTMLInputElement)
        .value;

      updateVectorLayer(vectorLayerMostBusyStreet, {
        timestamp,
        veh_type,
        cnt,
      });
      updateVectorLayer(
        vectorLayerCarsOnMostBusyStreet,
        {
          timestamp,
          veh_type,
          cnt,
        },
        createIconStyle(veh_type)
      );
      updateVectorLayer(
        vectorLayerTrafficLightJams,
        {
          timestamp,
          veh_type,
          cnt,
        },
        createIconStyle("traffic-light")
      );
      updateVectorLayer(
        vectorLayerCarsOnTrafficLightJams,
        {
          timestamp,
          veh_type,
          cnt,
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

const vectorLayerObjectTrajectory = initLayer({
  name: "object_trajectory",
  params: {},
  service: "WFS",
  title: "Putanja izabranog objekta",
  keywords: [],
}) as VectorLayer<any>;
vectorLayerObjectTrajectory.setVisible(false);

const objectTrajectoryFeatureLine = new Feature({
  geometry: new LineString([]),
});

var vectorLineSrc = new VectorSource({
  features: [objectTrajectoryFeatureLine],
});

const objectTrajectoryVectorLayer = new VectorLayer({
  source: vectorLineSrc,
  style: new Style({
    stroke: new Stroke({ color: "#0a74ff", width: 3 }),
  }),
});
objectTrajectoryVectorLayer.setVisible(false);
map.addLayer(objectTrajectoryVectorLayer);

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

  const features = (await Promise.all(featurePromises)).filter(
    (f) => f !== null
  );
  const [feature] = features;
  if (!feature) {
    popup.setPosition(undefined);
    vectorLayerObjectTrajectory.setVisible(false);
    objectTrajectoryVectorLayer.setVisible(false);
    return;
  }

  const layername = feature.id_.substring(0, feature.id_.indexOf("."));

  if (layername === "fastest_vehicles_at_timestamp") {
    const { extent } = map.getView().getViewStateAndExtent();

    const url =
      `${GEOSERVER_URI}/${WORKSPACE}/wfs?service=WFS&request=GetFeature&typename=object_trajectory&viewparams=osm_id:${feature.get(
        "osm_id"
      )}` +
      `&outputFormat=application/json&srsname=EPSG:3857&bbox=${extent.join(
        ","
      )},EPSG:3857`;

    const res = await fetch(url);
    const { features } = await res.json();

    const coordinates = features.map((f: any) => f.geometry.coordinates);
    objectTrajectoryFeatureLine.setGeometry(new LineString(coordinates));
    objectTrajectoryVectorLayer.setVisible(true);
  }

  const props = feature.getProperties() ?? feature.properties;

  if (feature)
    updateVectorLayer(vectorLayerObjectTrajectory, { osm_id: props.osm_id });
  // vectorLayerObjectTrajectory.setVisible(true);

  displayDetailsPopUp(evt.coordinate, props);
});

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

const heatmapSource = new VectorSource({
  format: new GeoJSON(),
  url: (extent) => {
    return (
      `${GEOSERVER_URI}/${WORKSPACE}/wfs?service=WFS&request=GetFeature&typename=traffic_heatmap&viewparams=time_from:2024-07-04 09:10:00;time_to:2024-07-04 09:11:00` +
      `&outputFormat=application/json&srsname=EPSG:3857&bbox=${extent.join(
        ","
      )},EPSG:3857`
    );
  },
  strategy: bboxStrategy,
});

const heatmapLayer = new Heatmap({
  source: heatmapSource,
  blur: 15, // Blur radius (optional)
  radius: 3, // Heatmap radius (optional)
  gradient: ["#00f", "#0ff", "#0f0", "#ff0", "#f00"], // Gradient colors (optional)
  weight: function (feature) {
    return feature.get("traffic_density"); // Function to get intensity value
  },
});

map.addLayer(heatmapLayer);
