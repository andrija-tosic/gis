import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import { TileWMS } from "ol/source";
import VectorSource from "ol/source/Vector";
import GeoJSON from "ol/format/GeoJSON";
import { bbox as bboxStrategy } from "ol/loadingstrategy";
import { WMSCapabilities } from "ol/format";
import { GEOSERVER_URI, WORKSPACE } from "./constants";
import { LayerInfo } from "./types";
import { Pixel } from "ol/pixel";
import { Map } from "ol";
import Style from "ol/style/Style";
import Icon from "ol/style/Icon";
import { FeatureLike } from "ol/Feature";

export async function getWFSLayersInfo(): Promise<LayerInfo[]> {
  const response = await fetch(
    `${GEOSERVER_URI}/${WORKSPACE}/wfs?request=GetCapabilities&service=WFS`
  );

  const xmlText = await response.text();
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, "text/xml");

  const featureElements = xmlDoc.getElementsByTagName("FeatureType");
  //@ts-ignore
  return Array.from(featureElements).map((featureElement) => {
    const name = featureElement.getElementsByTagName("Name")[0].textContent;
    const title = featureElement.getElementsByTagName("Title")[0].textContent;
    return {
      name: name,
      title: title,
      type: "WFS",
      keywords: Array.from(
        featureElement.getElementsByTagName("ows:Keyword")
      ).map((el) => el.textContent),
    };
  });
}

export async function getWMSLayersInfo(): Promise<LayerInfo[]> {
  const wmsCapabilitiesResponse = await fetch(
    `${GEOSERVER_URI}/${WORKSPACE}/wms?request=GetCapabilities&service=WMS`
  );

  const text = await wmsCapabilitiesResponse.text();
  const capabilities = new WMSCapabilities().read(text);

  const layers: LayerInfo[] = capabilities.Capability.Layer.Layer?.map(
    (responseLayer: any) => {
      console.log(responseLayer);
      return {
        name: responseLayer.Name,
        title: responseLayer.Title,
        service: "WMS",
        keywords: responseLayer.KeywordList,
      };
    }
  );

  return layers;
}

export function createVectorLayer(layer: LayerInfo): VectorLayer<any> {
  // const style = vectorLayerPredefinedStyles[layer.name];
  // console.log(`Styles ${style ? "found" : "missing"} for layer ${layer.name}`);
  const viewParams = layer.params
    ? `&viewparams=${Object.entries(layer.params)
        .map(([k, v]) => `${k}:${v}`)
        .join(";")}`
    : "";

  const vl = new VectorLayer({
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
    style: layer.style,
  });
  Object.entries(layer).forEach(([k, v]) => vl.set(k, v));

  return vl;
}

export function createTileLayer(layer: LayerInfo): TileLayer<TileWMS> {
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
}

export function updateVectorLayer(
  layer: VectorLayer<any>,
  params: Record<string, any>,
  style: (feature: FeatureLike) => Style
) {
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
  layer.setStyle(style);
  layer.getSource()?.refresh();
}

export function sanitize(key: string): string {
  return capitalize(key.replace(/[:_]/g, " "));
}

export function sanitizeValue(key: string, value: string | number): string {
  if (typeof value === "string" && key !== "ele") {
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
}

export function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export async function getFirstFeatureFromTileLayer(
  map: Map,
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

export function getFirstFeatureFromVectorLayer(map: Map, pixel: Pixel) {
  const features = map.getFeaturesAtPixel(pixel);
  return features.length ? features[0] : null;
}

export function createIconStyle(fileName: string) {
  return (feature: FeatureLike) =>
    new Style({
      image: new Icon({
        anchor: [0.5, 1],
        src: `./assets/${fileName}.png`,
        scale: 0.1,
        rotation: ((feature.get("angle") + 90) * Math.PI) / 180,
      }),
    });
}
