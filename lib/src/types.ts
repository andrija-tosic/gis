import Style from "ol/style/Style";

export type LayerInfo = {
  name: string;
  title: string;
  keywords: string[];
  service: "WMS" | "WFS";
  params: Record<string, any>;
  style?: Style;
};
