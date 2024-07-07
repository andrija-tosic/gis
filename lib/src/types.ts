import Feature, { FeatureLike } from "ol/Feature";
import { Geometry } from "ol/geom";
import { Options } from "ol/layer/Heatmap";
import VectorSource from "ol/source/Vector";
import Style from "ol/style/Style";

export type LayerOptions = {
  name: string;
  title: string;
  keywords?: string[];
  params?: Record<string, any>;
  style?: Style | ((feature: FeatureLike) => Style);
  heatmapOptions?: Options<Feature<Geometry>>;
  source?: VectorSource;
};
