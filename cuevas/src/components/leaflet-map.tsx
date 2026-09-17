import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import "leaflet/dist/leaflet.css";
import type { LayerGroup, Map as LMap, Marker } from "leaflet";
import { toast } from "sonner";
import streetsJson from "@/data/streets.json";
import {
  AREA_POLYGON,
  ESRI_ATTR,
  LOCAL_SAT,
  MAP_BOUNDS,
  MAP_CENTER,
  MAP_MAX_ZOOM,
  MAP_MIN_ZOOM,
  MAP_ZOOM,
  MASK_OUTER,
  pointInArea,
} from "@/lib/geo";
import { REPORT_TYPE_MAP, type Report, type ReportTypeId } from "@/lib/report-types";
import { useMapStore } from "@/lib/store";

type StreetRow = { n?: string | null; p: [number, number][] };
const STREETS = streetsJson as StreetRow[];

export type MapHandle = {
  zoomIn: () => void;
  zoomOut: () => void;
  locate: () => void;
  getZoom: () => number;
};

const PIN_SVG: Record<ReportTypeId, string> = {
  water:
    '<path d="M12 22a7 7 0 0 0 7-7c0-4-7-11-7-11S5 11 5 15a7 7 0 0 0 7 7z"/>',
  trash:
    '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14H5V6"/><path d="M8 6V4h8v2"/>',
  suspect:
    '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a8 8 0 0 1 16 0v1"/><circle cx="18" cy="7" r="3"/>',
  dump: '<path d="M7 19H4.8a2 2 0 0 1-1.7-3l3.4-6a2 2 0 0 1 3.4 0l.6 1"/><path d="M14 19h2.2a2 2 0 0 0 1.7-3L15 11"/><path d="M12 13v6"/><path d="m9 16 3 3 3-3"/>',
  robbery:
    '<circle cx="12" cy="8" r="4"/><path d="M6 21v-2a6 6 0 0 1 12 0v2"/><path d="m4 4 16 16"/>',
  power: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  other:
    '<circle cx="6" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="18" cy="12" r="1.6"/>',
};

function pinHtml(report: Report, selected: boolean): string {
  const fresh = Date.now() - report.createdAt < 6 * 60 * 60 * 1000;
  const cls = ["report-pin", selected ? "is-selected" : "", fresh ? "is-fresh" : ""]
    .filter(Boolean)
    .join(" ");
  const label = REPORT_TYPE_MAP[report.type].label;
  return `<div class="${cls}" style="--pin-bg: var(--color-${report.type})" title="${label}"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">${PIN_SVG[report.type]}</svg></div>`;
}

export const LeafletMap = forwardRef<MapHandle>(function LeafletMap(_props, ref) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LMap | null>(null);
  const streetsRef = useRef<LayerGroup | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const LRef = useRef<typeof import("leaflet") | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const reports = useMapStore((s) => s.reports);
  const selectedId = useMapStore((s) => s.selectedId);
  const showStreets = useMapStore((s) => s.showStreets);
  const showReports = useMapStore((s) => s.showReports);
  const placingType = useMapStore((s) => s.placingType);
  const flyRequest = useMapStore((s) => s.flyRequest);

  useImperativeHandle(ref, () => ({
    zoomIn: () => mapRef.current?.zoomIn(),
    zoomOut: () => mapRef.current?.zoomOut(),
    locate: () => mapRef.current?.locate({ setView: false, enableHighAccuracy: true }),
    getZoom: () => mapRef.current?.getZoom() ?? MAP_ZOOM,
  }));

  useEffect(() => {
    if (!hostRef.current || mapRef.current) return;
    let cancelled = false;

    void (async () => {
      const L = await import("leaflet");
      if (cancelled || !hostRef.current) return;
      LRef.current = L;

      const map = L.map(hostRef.current, {
        center: [MAP_CENTER.lat, MAP_CENTER.lng],
        zoom: MAP_ZOOM,
        minZoom: MAP_MIN_ZOOM,
        maxZoom: MAP_MAX_ZOOM,
        zoomControl: false,
        attributionControl: true,
        maxBounds: MAP_BOUNDS,
        maxBoundsViscosity: 1,
        fadeAnimation: true,
      });

      L.tileLayer(LOCAL_SAT, {
        attribution: ESRI_ATTR,
        minZoom: MAP_MIN_ZOOM,
        maxZoom: MAP_MAX_ZOOM,
        maxNativeZoom: 18,
        bounds: MAP_BOUNDS,
        noWrap: true,
      }).addTo(map);

      map.createPane("area-mask");
      const maskPane = map.getPane("area-mask");
      if (maskPane) {
        maskPane.style.zIndex = "320";
        maskPane.style.pointerEvents = "none";
      }

      L.polygon([MASK_OUTER, AREA_POLYGON], {
        pane: "area-mask",
        stroke: false,
        fillColor: "#07111d",
        fillOpacity: 0.72,
        interactive: false,
      }).addTo(map);

      L.polygon(AREA_POLYGON, {
        pane: "area-mask",
        color: "#ffc56a",
        weight: 2.6,
        opacity: 0.95,
        fill: false,
        interactive: false,
        lineJoin: "round",
        className: "area-outline",
      }).addTo(map);

      map.createPane("streets");
      const streetsPane = map.getPane("streets");
      if (streetsPane) {
        streetsPane.style.zIndex = "350";
        streetsPane.classList.add("leaflet-streets-pane");
      }

      const streets = L.layerGroup();
      for (const row of STREETS) {
        if (row.p.length < 2) continue;
        L.polyline(row.p, {
          color: "#ffc56a",
          weight: 2.4,
          opacity: 0.92,
          lineCap: "round",
          lineJoin: "round",
          interactive: false,
          pane: "streets",
        }).addTo(streets);
      }
      streets.addTo(map);
      streetsRef.current = streets;

      L.control.scale({ imperial: false, metric: true, position: "bottomleft" }).addTo(map);

      const compact = window.matchMedia("(max-width: 767px)").matches;
      map.fitBounds(AREA_POLYGON, {
        paddingTopLeft: compact ? [18, 88] : [36, 72],
        paddingBottomRight: compact ? [18, 120] : [48, 96],
        maxZoom: compact ? 15 : 16,
        animate: false,
      });

      map.on("click", (e: { latlng: { lat: number; lng: number } }) => {
        const placing = useMapStore.getState().placingType;
        if (!placing) return;
        if (!pointInArea(e.latlng.lat, e.latlng.lng)) {
          toast("Ese punto queda fuera del área medida. Toca dentro del polígono.");
          return;
        }
        useMapStore.getState().setDraft({
          lat: e.latlng.lat,
          lng: e.latlng.lng,
          type: placing,
        });
      });

      map.on("locationfound", (e: { latlng: { lat: number; lng: number } }) => {
        if (!pointInArea(e.latlng.lat, e.latlng.lng)) {
          toast("Estás fuera del área medida. Te dejamos en Las Cuevas.");
          map.flyToBounds(AREA_POLYGON, { padding: [28, 28], maxZoom: 17, duration: 0.7 });
          return;
        }
        map.flyTo(e.latlng, 18, { duration: 0.7 });
      });

      map.on("locationerror", () => {
        toast("No se pudo leer tu ubicación.");
      });

      mapRef.current = map;
      setMapReady(true);
      requestAnimationFrame(() => map.invalidateSize());
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markersRef.current.clear();
      setMapReady(false);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const streets = streetsRef.current;
    if (!map || !streets) return;
    if (showStreets) {
      if (!map.hasLayer(streets)) streets.addTo(map);
    } else if (map.hasLayer(streets)) {
      map.removeLayer(streets);
    }
  }, [showStreets, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    const L = LRef.current;
    if (!map || !L) return;

    const keep = new Set<string>();
    if (showReports) {
      for (const report of reports) {
        keep.add(report.id);
        const existing = markersRef.current.get(report.id);
        const html = pinHtml(report, report.id === selectedId);
        if (existing) {
          existing.setLatLng([report.lat, report.lng]);
          existing.setIcon(
            L.divIcon({
              className: "report-marker",
              html,
              iconSize: [34, 34],
              iconAnchor: [17, 17],
            }),
          );
          existing.setZIndexOffset(report.id === selectedId ? 600 : 0);
          continue;
        }
        const marker = L.marker([report.lat, report.lng], {
          icon: L.divIcon({
            className: "report-marker",
            html,
            iconSize: [34, 34],
            iconAnchor: [17, 17],
          }),
          zIndexOffset: report.id === selectedId ? 600 : 0,
        }).addTo(map);
        marker.on("click", () => {
          if (useMapStore.getState().placingType) return;
          useMapStore.getState().selectReport(report.id);
          useMapStore.getState().setReportsOpen(true);
        });
        markersRef.current.set(report.id, marker);
      }
    }

    for (const [id, marker] of markersRef.current) {
      if (keep.has(id)) continue;
      map.removeLayer(marker);
      markersRef.current.delete(id);
    }
  }, [reports, selectedId, showReports, mapReady]);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    el.classList.toggle("is-placing", Boolean(placingType));
  }, [placingType]);

  useEffect(() => {
    if (!flyRequest || !mapRef.current) return;
    const map = mapRef.current;
    map.flyTo([flyRequest.lat, flyRequest.lng], Math.max(map.getZoom(), 18), { duration: 0.65 });
    useMapStore.getState().clearFly();
  }, [flyRequest, mapReady]);

  useEffect(() => {
    const onResize = () => mapRef.current?.invalidateSize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return <div ref={hostRef} className="absolute inset-0 z-0 h-full w-full" />;
});
