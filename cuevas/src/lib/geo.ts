export const COLONIA = {
  city: "Hermosillo",
  state: "Sonora",
  name: "Las Cuevas",
} as const;

/** KML "Medición sin título" — Predio Las Cuevas / Unión de Ladrilleros. [lat, lng] */
export const AREA_POLYGON: [number, number][] = [
  [29.1370776273028, -111.0550776169852],
  [29.137635294181, -111.0501808468233],
  [29.14654937687257, -111.0498585492269],
  [29.14455249488319, -111.0621961601307],
  [29.14572795652929, -111.0695823820644],
  [29.13371887827981, -111.0732521684003],
  [29.13314524758806, -111.0671335612529],
  [29.12748161012775, -111.066002128893],
  [29.12628805161262, -111.0544027176088],
  [29.12588091131243, -111.0540754678761],
  [29.12591687603415, -111.0529767260027],
];

function polygonBBox(poly: [number, number][]) {
  const lats = poly.map((p) => p[0]);
  const lngs = poly.map((p) => p[1]);
  return {
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
    minLng: Math.min(...lngs),
    maxLng: Math.max(...lngs),
  };
}

const bbox = polygonBBox(AREA_POLYGON);

export const MAP_CENTER = {
  lat: (bbox.minLat + bbox.maxLat) / 2,
  lng: (bbox.minLng + bbox.maxLng) / 2,
};

export const MAP_ZOOM = 15;
export const MAP_MIN_ZOOM = 14;
export const MAP_MAX_ZOOM = 18;

const PAD_LAT = 0.0018;
const PAD_LNG = 0.0024;

export const MAP_BOUNDS: [[number, number], [number, number]] = [
  [bbox.minLat - PAD_LAT, bbox.minLng - PAD_LNG],
  [bbox.maxLat + PAD_LAT, bbox.maxLng + PAD_LNG],
];

/** Outer ring used to punch a hole for the measured area. */
export const MASK_OUTER: [number, number][] = [
  [MAP_BOUNDS[0][0] - 0.04, MAP_BOUNDS[0][1] - 0.04],
  [MAP_BOUNDS[0][0] - 0.04, MAP_BOUNDS[1][1] + 0.04],
  [MAP_BOUNDS[1][0] + 0.04, MAP_BOUNDS[1][1] + 0.04],
  [MAP_BOUNDS[1][0] + 0.04, MAP_BOUNDS[0][1] - 0.04],
];

export const PLACES: { name: string; lat: number; lng: number }[] = [
  { name: "Predio Las Cuevas", lat: 29.139919, lng: -111.068728 },
  { name: "Camino principal", lat: 29.136946, lng: -111.061027 },
  { name: "Entrada oriente", lat: 29.139073, lng: -111.05062 },
  { name: "Entrada poniente", lat: 29.140826, lng: -111.07011 },
  { name: "Entrada sur", lat: 29.125957, lng: -111.052907 },
];

export function pointInArea(lat: number, lng: number, poly: [number, number][] = AREA_POLYGON): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const yi = poly[i][0];
    const xi = poly[i][1];
    const yj = poly[j][0];
    const xj = poly[j][1];
    const intersect = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi || 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export const LOCAL_SAT = "/tiles/{z}/{x}/{y}.jpg";

export const ESRI_ATTR = "Imágenes satelitales · calles © OpenStreetMap";

export const WEATHER_URL = `https://api.open-meteo.com/v1/forecast?latitude=${MAP_CENTER.lat}&longitude=${MAP_CENTER.lng}&current=temperature_2m,weather_code,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=America%2FHermosillo&forecast_days=4`;
