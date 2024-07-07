import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import Heatmap, { Options } from "ol/layer/Heatmap";
import { TileWMS } from "ol/source";
import VectorSource from "ol/source/Vector";
import GeoJSON from "ol/format/GeoJSON";
import { bbox as bboxStrategy } from "ol/loadingstrategy";
import { WMSCapabilities } from "ol/format";
import { GEOSERVER_URI, WORKSPACE } from "./constants";
import { LayerOptions } from "./types";
import { Pixel } from "ol/pixel";
import { Map, Overlay } from "ol";
import Style from "ol/style/Style";
import Icon from "ol/style/Icon";
import Feature, { FeatureLike } from "ol/Feature";
import Stroke from "ol/style/Stroke";
import Text from "ol/style/Text";
import Fill from "ol/style/Fill";
import { Geometry } from "ol/geom";

export const getWFSLayersInfo = async (): Promise<LayerOptions[]> => {
  const response = await fetch(
    `${GEOSERVER_URI}/${WORKSPACE}/wfs?request=GetCapabilities&service=WFS`
  );

  const xmlText = await response.text();
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, "text/xml");

  const featureElements = xmlDoc.getElementsByTagName("FeatureType");
  return Array.from(featureElements).map((featureElement) => {
    const name = featureElement.getElementsByTagName("Name")[0].textContent!;
    const title = featureElement.getElementsByTagName("Title")[0].textContent!;
    return {
      name: name,
      title: title,
      keywords: Array.from(
        featureElement.getElementsByTagName("ows:Keyword")
      ).map((el) => el.textContent!),
    };
  });
};

export const getWMSLayersInfo = async (): Promise<LayerOptions[]> => {
  const wmsCapabilitiesResponse = await fetch(
    `${GEOSERVER_URI}/${WORKSPACE}/wms?request=GetCapabilities&service=WMS`
  );

  const text = await wmsCapabilitiesResponse.text();
  const capabilities = new WMSCapabilities().read(text);

  const layers: LayerOptions[] = capabilities.Capability.Layer.Layer?.map(
    (responseLayer: any) => {
      return {
        name: responseLayer.Name,
        title: responseLayer.Title,
        keywords: responseLayer.KeywordList,
      };
    }
  );

  return layers;
};

export const createVectorLayer = (
  layer: LayerOptions
): VectorLayer<Feature<Geometry>> => {
  const viewParams = layer.params
    ? `&viewparams=${Object.entries(layer.params)
        .map(([k, v]) => `${k}:${v}`)
        .join(";")}`
    : "";

  const vl = new VectorLayer({
    source:
      layer.source ??
      new VectorSource({
        format: new GeoJSON(),
        url: (extent) => {
          return (
            `${GEOSERVER_URI}/${WORKSPACE}/wfs?service=WFS&request=GetFeature&typename=${layer.name}${viewParams}` +
            `&outputFormat=application/json&srsname=EPSG:3857&bbox=${extent.join(
              ","
            )},EPSG:3857`
          );
        },
        strategy: bboxStrategy,
      }),
    style: predefinedVectorStyles[layer.name] ?? layer.style,
  });
  Object.entries(layer).forEach(([k, v]) => vl.set(k, v));

  return vl;
};

export const createTileLayer = (layer: LayerOptions): TileLayer<TileWMS> => {
  const VIEWPARAMS = layer.params
    ? Object.entries(layer.params)
        .map(([k, v]) => `${k}:${v}`)
        .join(";")
    : "";

  const tl = new TileLayer({
    source: new TileWMS({
      attributions: "@geoserver",
      url: `${GEOSERVER_URI}/${WORKSPACE}/wms?`,
      params: {
        LAYERS: `${WORKSPACE}:${layer.name}`,
        TILED: true,
        VIEWPARAMS,
      },
      serverType: "geoserver",
      transition: 0,
    }),
  });
  Object.entries(layer).forEach(([k, v]) => tl.set(k, v));

  return tl;
};

export const createHeatmapLayer = (layer: LayerOptions) => {
  const viewParams = layer.params
    ? `&viewparams=${Object.entries(layer.params)
        .map(([k, v]) => `${k}:${v}`)
        .join(";")}`
    : "";

  const hl = new Heatmap({
    ...layer.heatmapOptions,
    source: new VectorSource({
      format: new GeoJSON(),
      url: (extent) => {
        return (
          `${GEOSERVER_URI}/${WORKSPACE}/wfs?service=WFS&request=GetFeature&typename=${layer.name}${viewParams}` +
          `&outputFormat=application/json&srsname=EPSG:3857&bbox=${extent.join(
            ","
          )},EPSG:3857`
        );
      },
      strategy: bboxStrategy,
    }),
  });
  Object.entries(layer).forEach(([k, v]) => hl.set(k, v));
  hl.set("heatmapOptions", layer.heatmapOptions);

  return hl;
};

export const updateHeatmapLayer = (
  map: Map,
  layer: Heatmap<Feature<Geometry>>,
  params: Record<string, any>
) => {
  const oldLayer = map
    .getAllLayers()
    .find((l) => l.get("name") === layer.get("name"))!;

  map.removeLayer(oldLayer);

  const hl = createHeatmapLayer({
    name: layer.get("name"),
    title: layer.get("title"),
    params,
    heatmapOptions: layer.get("heatmapOptions"),
  });
  hl.setVisible(oldLayer.getVisible());

  map.addLayer(hl);
};

export const updateVectorLayer = (
  layer: VectorLayer<Feature<Geometry>>,
  params: Record<string, any>,
  style?: Style | ((feature: FeatureLike) => Style)
) => {
  const viewParams = `&viewparams=${Object.entries(params)
    .map(([k, v]) => `${k}:${v}`)
    .join(";")}`;

  layer.set("params", params);

  layer
    .getSource()
    ?.setUrl(
      (extent) =>
        "http://localhost:8080/geoserver/wfs" +
        "?service=WFS" +
        "&version=1.1.0" +
        "&request=GetFeature" +
        `&typeName=${WORKSPACE}:${layer.get("name")}` +
        viewParams +
        "&outputFormat=application/json" +
        "&srsname=EPSG:3857" +
        `&bbox=${extent.join(",")},EPSG:3857`
    );
  if (style) {
    layer.setStyle(style);
  }
  layer.getSource()?.refresh();
};

export const sanitize = (key: string): string => {
  return capitalize(key.replace(/[:_]/g, " "));
};

export const sanitizeValue = (key: string, value: string | number): string => {
  if (typeof value === "string") {
    return sanitize(value);
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
};

export const capitalize = (value: string): string => {
  return value.charAt(0).toUpperCase() + value.slice(1);
};

export const getFirstFeatureFromTileLayer = async (
  map: Map,
  layer: TileLayer<TileWMS>,
  pixel: Pixel
) => {
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
};

export const getFirstFeatureFromVectorLayer = (map: Map, pixel: Pixel) => {
  const features = map.getFeaturesAtPixel(pixel);
  return features.length ? features[0] : null;
};

export const createIconStyle = (fileName: string) => (feature: FeatureLike) =>
  new Style({
    image: new Icon({
      anchor: [0.5, 0.5],
      src: `./assets/${fileName}.png`,
      scale: 0.25,
      rotation: feature.get("angle")
        ? ((feature.get("angle") + 90) * Math.PI) / 180
        : 0,
    }),
  });

export const createIcon = (fileName: string) => (feature: FeatureLike) =>
  new Icon({
    anchor: [0.5, 0.5],
    src: `./assets/${fileName}.png`,
    scale: 0.25,
    rotation: feature.get("angle")
      ? ((feature.get("angle") + 90) * Math.PI) / 180
      : 0,
  });

export const createText = (feature: FeatureLike) =>
  new Text({
    text: feature.get("name") ?? "",
    fill: new Fill({ color: "#0000FF" }),
    offsetY: -25,
    offsetX: 25,
    scale: 1.5,
  });

export const predefinedVectorStyles: {
  [key: string]: Style | ((feature: FeatureLike) => Style);
} = {
  [`${WORKSPACE}:objekti hitne pomoci`]: (feature) =>
    new Style({
      image: createIcon("hospital")(feature),
      text: new Text({
        text: feature.get("name") ?? "",
        fill: new Fill({ color: "#FF0000" }),
        offsetY: -25,
        scale: 1.5,
      }),
    }),
  [`${WORKSPACE}:autobuske nis`]: createIconStyle("bus-stop"),
  [`${WORKSPACE}:autobuske beograd`]: createIconStyle("bus-stop"),
  [`${WORKSPACE}:Reke koje protiču kroz gradove (> 10km)`]: (feature) =>
    new Style({
      text: new Text({
        text: feature.get("name") ?? "",
        fill: new Fill({ color: "#0000FF" }),
        offsetY: -25,
        offsetX: 25,
        scale: 1.5,
      }),
      stroke: new Stroke({
        color: "#0000FF",
        width: 3,
      }),
    }),
};

export function appendLayer(
  map: Map,
  popup: Overlay,
  layer: TileLayer<TileWMS>,
  parent: HTMLElement
): TileLayer<TileWMS>;
export function appendLayer(
  map: Map,
  popup: Overlay,
  layer: VectorLayer<Feature<Geometry>>,
  parent: HTMLElement
): VectorLayer<Feature<Geometry>>;
export function appendLayer(
  map: Map,
  popup: Overlay,
  layer: Heatmap<Feature<Geometry>>,
  parent: HTMLElement
): Heatmap<Feature<Geometry>>;
export function appendLayer(
  map: Map,
  popup: Overlay,
  layer:
    | TileLayer<TileWMS>
    | VectorLayer<Feature<Geometry>>
    | Heatmap<Feature<Geometry>>,
  parent: HTMLElement
) {
  const item = document.createElement("div");
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = false;

  layer.setVisible(false);
  map.addLayer(layer);

  checkbox.addEventListener("change", () => {
    map
      .getAllLayers()
      .find((l) => l.get("name") === layer.get("name"))!
      .setVisible(checkbox.checked);
    popup.setPosition(undefined);
  });

  item.appendChild(checkbox);
  item.appendChild(document.createTextNode(layer.get("title")));
  parent.appendChild(item);

  return layer;
}
