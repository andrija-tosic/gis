import { Feature, Map, Overlay, View } from "ol";
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
  fetchVectorLayers,
  fetchWMSLayers,
  updateHeatmapLayer,
  updateVectorLayer,
  createWfsUrl,
  mapOnClickEvHandler,
} from "../lib/src/util";
import "../lib/src/style.css";
import { Style, Stroke } from "ol/style";
import {
  WORKSPACE,
  PARAMETRIZED_LAYERS,
  createHeatmapOptions,
} from "../lib/src/constants";
import { LineString } from "ol/geom";
import VectorSource from "ol/source/Vector";
import { FeatureLike } from "ol/Feature";
import LayerGroup from "ol/layer/Group";

const sumoLegend: HTMLElement = document.getElementById("sumo")!;
const layersDiv: HTMLElement = document.getElementById("layers")!;
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
    center: fromLonLat([20.4612, 44.8125]),
    zoom: 13,
  }),
  overlays: [overlay],
});

const wmsLayers =
  (await fetchWMSLayers())
    .filter(
      (layer) => !["autobuske beograd, autobuske nis"].includes(layer.name)
    )
    .sort((l1, l2) => l1.title.localeCompare(l2.title)) ?? [];

const wfsLayers =
  (await fetchVectorLayers()).sort((l1, l2) =>
    l1.title.localeCompare(l2.title)
  ) ?? [];

if (wfsLayers.length > 0) {
  const wmsHeader = document.createElement("h2");
  wmsHeader.textContent = "Pločasti slojevi";
  layersDiv.appendChild(wmsHeader);
}

wmsLayers
  .filter((l) => !PARAMETRIZED_LAYERS.has(l.name))
  .forEach((l) => appendLayer(map, overlay, createTileLayer(l), layersDiv));

if (wfsLayers.length > 0) {
  const wfsHeader = document.createElement("h2");
  wfsHeader.textContent = "Vektorski slojevi";
  layersDiv.appendChild(wfsHeader);
}

const offsetFcd = "2024-07-04 09:11:12";
const offsetEmission = "2024-07-06 15:20:39";
let timestampFcd = offsetFcd;
let timestampEmission = offsetEmission;
let veh_type = "veh_passenger";
let cnt = "1";

const vectorLayerMostBusyStreet = appendLayer(
  map,
  overlay,
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
  overlay,
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
  overlay,
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
  overlay,
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

const createBikeLanesVectorStyle = (surface: string) =>
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
  overlay,
  createVectorLayer({
    name: "bike_lanes",
    params: { surface },
    title: "Biciklističke staze",
    style: createBikeLanesVectorStyle(surface),
  }),
  sumoLegend
);

const vectorLayerFastestVehiclesAtTimestamp = appendLayer(
  map,
  overlay,
  createVectorLayer({
    name: "fastest_vehicles_at_timestamp",
    params: { timestamp: timestampFcd, veh_type },
    title: "Najbrža vozila u izabranom trenutku",
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
    createBikeLanesVectorStyle(surface)
  );
});

document
  .querySelectorAll(
    "#time-slider, #type-select, #min-vehicles-number, #timespan-slider"
  )!
  .forEach((el) => {
    el.addEventListener("change", () => {
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

map.on(
  "click",
  async (ev) =>
    await mapOnClickEvHandler(
      map,
      overlay,
      ev,
      () => {
        vectorLayerObjectTrajectoryLine.setVisible(false);
      },
      async (feature: FeatureLike) => {
        if (feature.get("osm_obj")) {
          const { extent } = map.getView().getViewStateAndExtent();

          const url = createWfsUrl("object_trajectory", {
            osm_id: feature.get("osm_id"),
          })(extent);

          const res = await fetch(url);
          const { features } = await res.json();

          const coordinates = features.map((f: any) => f.geometry.coordinates);
          objectTrajectoryFeatureLine.setGeometry(new LineString(coordinates));
          vectorLayerObjectTrajectoryLine.setVisible(true);
        }
      }
    )
);

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
  overlay,
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
    heatmapOptions: createHeatmapOptions("avg_speed"),
  }),
  sumoLegend
);

const trafficHeatmapLayer = appendLayer(
  map,
  overlay,
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
    heatmapOptions: createHeatmapOptions("traffic_density"),
  }),
  sumoLegend
);

const emissionHeatmapLayer = appendLayer(
  map,
  overlay,
  createHeatmapLayer({
    name: "emission_heatmap",
    title: "Toplotna karta emitovanih čestica iz vozila",
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
    heatmapOptions: createHeatmapOptions("avg_emission"),
  }),
  sumoLegend
);
