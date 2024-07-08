import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import Heatmap from "ol/layer/Heatmap";
import { TileWMS } from "ol/source";
import VectorSource from "ol/source/Vector";
import GeoJSON from "ol/format/GeoJSON";
import { bbox as bboxStrategy } from "ol/loadingstrategy";
import { WMSCapabilities } from "ol/format";
import { GEOSERVER_URI, WORKSPACE } from "./constants";
import { LayerOptions } from "./types";
import { Pixel } from "ol/pixel";
import { Map, MapBrowserEvent, Overlay } from "ol";
import Style from "ol/style/Style";
import Icon from "ol/style/Icon";
import Feature, { FeatureLike } from "ol/Feature";
import Stroke from "ol/style/Stroke";
import Text from "ol/style/Text";
import Fill from "ol/style/Fill";
import { Geometry } from "ol/geom";
import { Coordinate } from "ol/coordinate";
import { Extent } from "ol/extent";

export const fetchVectorLayers = async (): Promise<LayerOptions[]> => {
  const res = await fetch(
    `${GEOSERVER_URI}/${WORKSPACE}/wfs?request=GetCapabilities&service=WFS`
  );

  const xmlText = await res.text();
  const xmlDoc = new DOMParser().parseFromString(xmlText, "text/xml");

  const featureElements = xmlDoc.getElementsByTagName("FeatureType");
  return [...featureElements].map((featureElement) => {
    return {
      name: featureElement.getElementsByTagName("Name")[0].textContent!,
      title: featureElement.getElementsByTagName("Title")[0].textContent!,
      keywords: Array.from(
        featureElement.getElementsByTagName("ows:Keyword")
      ).map((el) => el.textContent!),
    };
  });
};

export const fetchWMSLayers = async (): Promise<LayerOptions[]> => {
  const wmsCapabilitiesRes = await fetch(
    `${GEOSERVER_URI}/${WORKSPACE}/wms?request=GetCapabilities&service=WMS`
  );

  const text = await wmsCapabilitiesRes.text();
  const capabilities = new WMSCapabilities().read(text);

  const layers: LayerOptions[] = capabilities.Capability.Layer.Layer!.map(
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

export const createWfsUrl =
  (layerName: string, viewParamsObj?: Record<string, any>) =>
  (extent: Extent) => {
    const viewParams = viewParamsObj
      ? `&viewparams=${Object.entries(viewParamsObj)
          .map(([k, v]) => `${k}:${v}`)
          .join(";")}`
      : "";

    return (
      `${GEOSERVER_URI}/${WORKSPACE}/wfs?service=WFS&request=GetFeature&typename=${layerName}${viewParams}` +
      `&outputFormat=application/json&srsname=EPSG:3857&bbox=${extent.join(
        ","
      )},EPSG:3857`
    );
  };

export const createVectorLayer = (
  layer: LayerOptions
): VectorLayer<Feature<Geometry>> => {
  const vl = new VectorLayer({
    source:
      layer.source ??
      new VectorSource({
        format: new GeoJSON(),
        url: createWfsUrl(layer.name, layer.params),
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
  const hl = new Heatmap({
    ...layer.heatmapOptions,
    source: new VectorSource({
      format: new GeoJSON(),
      url: createWfsUrl(layer.name, layer.params),
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
  layer.set("params", params);

  layer.getSource()?.setUrl(createWfsUrl(layer.get("name"), params));
  if (style) {
    layer.setStyle(style);
  }
  layer.getSource()?.refresh();
};

export const showPopup = (
  coordinate: Coordinate,
  props: any,
  popup: Overlay
) => {
  let content = "";

  const keyValuePairs = Object.entries<string | number>(props)
    .filter(
      ([k, v]) =>
        k && k !== "way" && (typeof v === "string" || typeof v === "number")
    )
    .map(([k, v]) => {
      switch (k) {
        case "speed":
          return [k, Math.round((v as number) * 3.6) + " km/h"];
        case "angle":
          return [k, v + " deg"];
        default:
          return [k, v];
      }
    });

  for (const [key, value] of keyValuePairs) {
    content += `${key}: ${value}<br>`;
  }

  document.getElementById("popup-content")!.innerHTML = content;

  popup.setPosition(coordinate);
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
  const titleDiv = document.createElement("div");
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

  titleDiv.appendChild(checkbox);
  titleDiv.appendChild(document.createTextNode(layer.get("title")));
  parent.appendChild(titleDiv);

  return layer;
}

export const getFeaturesOnMapClick =
  (map: Map, popup: Overlay, onFail?: Function, onSuccess?: Function) =>
  async (ev: MapBrowserEvent<UIEvent>) => {
    const featurePromises = map
      .getAllLayers()
      .slice(1)
      .filter((layer) => layer.isVisible())
      .reverse()
      .map((layer) => {
        if (layer instanceof VectorLayer || layer instanceof Heatmap) {
          return Promise.resolve(getFirstFeatureFromVectorLayer(map, ev.pixel));
        } else if (layer instanceof TileLayer) {
          return getFirstFeatureFromTileLayer(map, layer, ev.coordinate);
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
      await onFail?.();
      return;
    }

    await onSuccess?.(feature);

    const props = feature.getProperties() ?? feature.properties;

    showPopup(ev.coordinate, props, popup);
  };
