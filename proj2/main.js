import "./style.css";
import { Map, View } from "ol";
import { Group as LayerGroup, Tile as TileLayer } from "ol/layer.js";
import OSM from "ol/source/OSM";
import TileWMS from "ol/source/TileWMS.js";
import { transform } from "ol/proj.js";
import { LayerVisibilityControl } from "./controls";
import { Control, defaults as defaultControls } from "ol/control.js";

const centerBg = transform([20.4612, 44.8125], "EPSG:4326", "EPSG:3857");
const center = transform([20.4612, 43.5], "EPSG:4326", "EPSG:3857");

const wmsWorkspaceUrl = "http://localhost:8080/geoserver/workspace/wms";

const wmsAutobuskeBgLayer = new TileLayer({
  source: new TileWMS({
    url: wmsWorkspaceUrl,
    params: { LAYERS: "workspace:autobuske beograd", TILED: true },
    serverType: "geoserver",
    transition: 0,
  }),
});
wmsAutobuskeBgLayer.set("name", "Autobuske stanice Beograda");

const wmsAutobuskeNisLayer = new TileLayer({
  source: new TileWMS({
    url: wmsWorkspaceUrl,
    params: { LAYERS: "workspace:autobuske nis", TILED: true },
    serverType: "geoserver",
    transition: 0,
  }),
});
wmsAutobuskeNisLayer.set("name", "Autobuske stanice Niša");

const autobuskeLayerGroup = new LayerGroup({
  layers: [wmsAutobuskeBgLayer, wmsAutobuskeNisLayer],
});
autobuskeLayerGroup.set("name", "Autobuske layer group");

const wmsObjektiHitnePomociLayer = new TileLayer({
  source: new TileWMS({
    url: wmsWorkspaceUrl,
    params: { LAYERS: "workspace:objekti hitne pomoci", TILED: true },
    serverType: "geoserver",
    transition: 0,
  }),
});
wmsObjektiHitnePomociLayer.set("name", "Objekti hitne pomoći");

const view = new View({
  center,
  zoom: 7,
});

const customLayers = [
  wmsAutobuskeBgLayer,
  wmsAutobuskeNisLayer,
  wmsObjektiHitnePomociLayer,
];

const map = new Map({
  controls: defaultControls().extend([
    new LayerVisibilityControl({
      layer: autobuskeLayerGroup,
    }),
    new LayerVisibilityControl({
      layer: wmsAutobuskeBgLayer,
    }),
    new LayerVisibilityControl({
      layer: wmsAutobuskeNisLayer,
    }),
    new LayerVisibilityControl({
      layer: wmsObjektiHitnePomociLayer,
    }),
  ]),
  target: "map",
  layers: [
    new TileLayer({
      source: new OSM(),
    }),
    autobuskeLayerGroup,
    wmsObjektiHitnePomociLayer,
  ],
  view,
});

const info = document.getElementById("info");

let currentFeature = undefined;

map.on("click", async (evt) => {
  const viewResolution = view.getResolution();
  const layers = customLayers.filter(
    (layer) => layer.getVisible() && layer.getSource
  );

  for (const layer of layers) {
    const url = layer
      .getSource()
      .getFeatureInfoUrl(evt.coordinate, viewResolution, "EPSG:3857", {
        INFO_FORMAT: "application/json",
        FEATURE_COUNT: "1",
      });

    const featureRes = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    const featureJson = await featureRes.json();

    if (featureJson.numberReturned > 0) {
      const [feature] = featureJson.features;

      info.style.left = evt.pixel[0] + "px";
      info.style.top = evt.pixel[1] + "px";
      if (feature !== currentFeature) {
        info.style.visibility = "visible";

        const str = Object.entries(feature.properties)
          .filter(([key, value]) => !!value && key !== "osm_id")
          .map(([key, value]) => `${key}: ${value}`)
          .join(", ");

        info.innerHTML = str;

        currentFeature = feature;
      }
      return;
    }
    info.style.visibility = "hidden";
  }
});

// map.getTargetElement().addEventListener("pointerleave", function () {
//   currentFeature = undefined;
//   info.style.visibility = "hidden";
// });

map.on("movestart", () => {
  info.style.visibility = "hidden";
});
