import { Feature, Map, Overlay, View } from "ol";
import { Coordinate } from "ol/coordinate";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import { fromLonLat } from "ol/proj";
import OSM from "ol/source/OSM";
import {
  appendLayer,
  createHeatmapLayer,
  createIconStyle,
  createTileLayer,
  createVectorLayer,
  getFirstFeatureFromTileLayer,
  getFirstFeatureFromVectorLayer,
  getWFSLayersInfo,
  getWMSLayersInfo,
  sanitize,
  sanitizeValue,
  updateHeatmapLayer,
  updateVectorLayer,
} from "../lib/src/util";
import "../lib/src/style.css";
import { Style, Stroke } from "ol/style";
import {
  GEOSERVER_URI,
  WORKSPACE,
  PARAMETRIZED_LAYERS,
  HEATMAP_OPTIONS,
} from "../lib/src/constants";
import { LineString } from "ol/geom";
import VectorSource from "ol/source/Vector";

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

const wmsLayers =
  (await getWMSLayersInfo())
    ?.filter((layer) => !layer.keywords?.includes("hide_wms"))
    .sort((l1, l2) => l1.title.localeCompare(l2.title)) ?? [];

const wfsLayers =
  (await getWFSLayersInfo()).sort((l1, l2) =>
    l1.title.localeCompare(l2.title)
  ) ?? [];

if (wfsLayers?.length > 0) {
  const wmsHeader = document.createElement("h2");
  wmsHeader.textContent = "Pločasti slojevi";
  layersDiv.appendChild(wmsHeader);
}

wmsLayers
  ?.filter((l) => !PARAMETRIZED_LAYERS.has(l.name))
  .forEach((l) => appendLayer(map, popup, createTileLayer(l), layersDiv));

if (wfsLayers?.length > 0) {
  const wfsHeader = document.createElement("h2");
  wfsHeader.textContent = "Vektorski slojevi";
  layersDiv.appendChild(wfsHeader);
}

wfsLayers
  ?.filter((l) => !PARAMETRIZED_LAYERS.has(l.name.replace(`${WORKSPACE}:`, "")))
  .forEach((l) => appendLayer(map, popup, createVectorLayer(l), layersDiv));

const offsetFcd = "2024-07-04 09:11:12";
const offsetEmission = "2024-07-06 15:20:39";
let timestampFcd = offsetFcd;
let timestampEmission = offsetEmission;
let veh_type = "veh_passenger";
let cnt = "1";

const vectorLayerMostBusyStreet = appendLayer(
  map,
  popup,
  createVectorLayer({
    name: "most_busy_street",
    params: { timestamp: timestampFcd, veh_type, cnt },
    title: "Ulica sa najgušćim saobraćajem",
    style: new Style({
      stroke: new Stroke({
        color: "#cc1836",
        width: 15,
      }),
    }),
  }),
  sumoLegend
);

const vectorLayerCarsOnMostBusyStreet = appendLayer(
  map,
  popup,
  createVectorLayer({
    name: "cars_on_most_busy_street",
    params: { timestamp: timestampFcd, veh_type, cnt },
    title: "Vozila na ulici sa najgušćim saobraćajem",
    style: createIconStyle(veh_type),
  }),
  sumoLegend
);

const vectorLayerTrafficLightJams = appendLayer(
  map,
  popup,
  createVectorLayer({
    name: "traffic_light_jams",
    params: { timestamp: timestampFcd, veh_type, cnt },
    title: "Semafori sa kolonama vozila",
    style: createIconStyle("traffic-light"),
  }),
  sumoLegend
);

const vectorLayerCarsOnTrafficLightJams = appendLayer(
  map,
  popup,
  createVectorLayer({
    name: "cars_on_traffic_light_jams",
    params: { timestamp: timestampFcd, veh_type },
    title: "Kolona vozila na semaforima",
    style: createIconStyle(veh_type),
  }),
  sumoLegend
);

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

const vectorLayerBikeLanes = appendLayer(
  map,
  popup,
  createVectorLayer({
    name: "bike_lanes",
    params: { surface },
    title: "Biciklističke staze",
    style: bikeLanesVectorStyle(surface),
  }),
  sumoLegend
);

const vectorLayerFastestVehiclesAtTimestamp = appendLayer(
  map,
  popup,
  createVectorLayer({
    name: "fastest_vehicles_at_timestamp",
    params: { timestamp: timestampFcd, veh_type },
    title: "Najbrža vozila u izbranom trenutku",
    style: createIconStyle(veh_type),
  }),
  sumoLegend
);

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
  .querySelectorAll(
    "#time-slider, #type-select, #min-vehicles-number, #timespan-slider"
  )!
  .forEach((el) => {
    el.addEventListener("input", () => {
      const sliderValue = (
        document.querySelector("#time-slider") as HTMLInputElement
      ).value;

      timestampFcd = new Date(
        new Date(offsetFcd + "Z").getTime() + +sliderValue * 60 * 1000
      )
        .toISOString()
        .replace("T", " ")
        .replace("Z", "");

      timestampEmission = new Date(
        new Date(offsetEmission + "Z").getTime() + +sliderValue * 60 * 1000
      )
        .toISOString()
        .replace("T", " ")
        .replace("Z", "");

      veh_type = (document.querySelector("#type-select") as HTMLInputElement)
        .value;

      cnt = (document.querySelector("#min-vehicles-number") as HTMLInputElement)
        .value;

      updateVectorLayer(vectorLayerMostBusyStreet, {
        timestamp: timestampFcd,
        veh_type,
        cnt,
      });
      updateVectorLayer(
        vectorLayerCarsOnMostBusyStreet,
        {
          timestamp: timestampFcd,
          veh_type,
          cnt,
        },
        createIconStyle(veh_type)
      );
      updateVectorLayer(
        vectorLayerTrafficLightJams,
        {
          timestamp: timestampFcd,
          veh_type,
          cnt,
        },
        createIconStyle("traffic-light")
      );
      updateVectorLayer(
        vectorLayerCarsOnTrafficLightJams,
        {
          timestamp: timestampFcd,
          veh_type,
          cnt,
        },
        createIconStyle(veh_type)
      );
      updateVectorLayer(
        vectorLayerFastestVehiclesAtTimestamp,
        {
          timestamp: timestampFcd,
          veh_type,
        },
        createIconStyle(veh_type)
      );
      updateHeatmapLayer(map, speedHeatmapLayer, {
        time_from: timestampFcd,
        time_to: new Date(new Date(timestampFcd + "Z").getTime() + 1000)
          .toISOString()
          .replace("T", " ")
          .replace("Z", ""),
        veh_type,
      });
      updateHeatmapLayer(map, trafficHeatmapLayer, {
        time_from: timestampFcd,
        time_to: new Date(new Date(timestampFcd + "Z").getTime() + 1000)
          .toISOString()
          .replace("T", " ")
          .replace("Z", ""),
        veh_type,
      });
      updateHeatmapLayer(map, emissionHeatmapLayer, {
        time_from: timestampEmission,
        time_to: new Date(new Date(timestampEmission + "Z").getTime() + 1000)
          .toISOString()
          .replace("T", " ")
          .replace("Z", ""),
        veh_type,
        emission_col: (
          document.querySelector(
            "#emission-substance-select"
          ) as HTMLInputElement
        ).value,
      });
    });
  });

const objectTrajectoryFeatureLine = new Feature({
  geometry: new LineString([]),
});

const vectorLayerObjectTrajectoryLine = new VectorLayer({
  source: new VectorSource({
    features: [objectTrajectoryFeatureLine],
  }),
  style: new Style({
    stroke: new Stroke({ color: "#0a74ff", width: 3 }),
  }),
});
map.addLayer(vectorLayerObjectTrajectoryLine);

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
    vectorLayerObjectTrajectoryLine.setVisible(false);
    return;
  }

  if (feature.get("osm_obj")) {
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
    vectorLayerObjectTrajectoryLine.setVisible(true);
  }

  const props = feature.getProperties() ?? feature.properties;

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

document
  .querySelector("#emission-substance-select")!
  .addEventListener("change", (e) => {
    updateHeatmapLayer(map, emissionHeatmapLayer, {
      time_from: timestampEmission,
      time_to: new Date(new Date(timestampEmission + "Z").getTime() + 1000)
        .toISOString()
        .replace("T", " ")
        .replace("Z", ""),
      veh_type,
      emission_col: (e.target as HTMLInputElement).value,
    });
    map.render();
  });

const speedHeatmapLayer = appendLayer(
  map,
  popup,
  createHeatmapLayer({
    name: "speed_heatmap",
    title: "Toplotna karta brzine vozila",
    params: {
      veh_type,
      time_from: timestampFcd,
      time_to: new Date(new Date(timestampFcd + "Z").getTime() + 1000)
        .toISOString()
        .replace("T", " ")
        .replace("Z", ""),
    },
    heatmapOptions: HEATMAP_OPTIONS,
  }),
  sumoLegend
);

const trafficHeatmapLayer = appendLayer(
  map,
  popup,
  createHeatmapLayer({
    name: "traffic_heatmap",
    title: "Toplotna karta gustine saobraćaja",
    params: {
      veh_type,
      time_from: timestampFcd,
      time_to: new Date(new Date(timestampFcd + "Z").getTime() + 1000)
        .toISOString()
        .replace("T", " ")
        .replace("Z", ""),
    },
    heatmapOptions: HEATMAP_OPTIONS,
  }),
  sumoLegend
);

const emissionHeatmapLayer = appendLayer(
  map,
  popup,
  createHeatmapLayer({
    name: "emission_heatmap",
    title: "Toplotna karta emisije vozila",
    params: {
      time_from: timestampEmission,
      time_to: new Date(new Date(timestampEmission + "Z").getTime() + 1000)
        .toISOString()
        .replace("T", " ")
        .replace("Z", ""),
      veh_type,
      emission_col: (
        document.querySelector("#emission-substance-select") as HTMLInputElement
      ).value,
    },
    heatmapOptions: HEATMAP_OPTIONS,
  }),
  sumoLegend
);
