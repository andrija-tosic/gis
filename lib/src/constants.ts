import Feature from "ol/Feature";
import { Geometry } from "ol/geom";
import { Options } from "ol/layer/Heatmap";

export const WORKSPACE = "workspace";
export const GEOSERVER_URI = "http://localhost:8080/geoserver";

export const PARAMETRIZED_LAYERS = new Set([
  "most_busy_street",
  "cars_on_most_busy_street",
  "traffic_light_jams",
  "cars_on_traffic_light_jams",
  "fastest_vehicles_at_timestamp",
  "bike_lanes",
  "object_trajectory",
  "traffic_heatmap",
  "speed_heatmap",
  "emission_heatmap",
]);

export const createHeatmapOptions = (
  featureName: string
): Options<Feature<Geometry>> => ({
  blur: 15,
  radius: 3,
  gradient: ["#00f", "#0ff", "#0f0", "#ff0", "#f00"],
  weight: (feature) => feature.get(featureName),
});
