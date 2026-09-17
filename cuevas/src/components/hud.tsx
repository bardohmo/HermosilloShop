import { useEffect, useMemo, useState, type RefObject } from "react";
import {
  BarChart3,
  Calendar,
  ChevronDown,
  Cloud,
  CloudLightning,
  CloudRain,
  Compass,
  Crosshair,
  Layers,
  MapPin,
  Minus,
  Plus,
  Search,
  Sun,
  TriangleAlert,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { COLONIA, PLACES, WEATHER_URL } from "@/lib/geo";
import {
  PERIODS,
  REPORT_TYPE_MAP,
  REPORT_TYPES,
  formatDate,
  formatTime,
  inPeriod,
  weatherLabel,
  type ReportTypeId,
} from "@/lib/report-types";
import { useMapStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { MapHandle } from "@/components/leaflet-map";
import { AdminToolButton } from "@/components/admin-panel";
import { signOut, authEnabled } from "@/lib/auth/client";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import streetsJson from "@/data/streets.json";

type StreetRow = { n?: string | null; p: [number, number][] };
const NAMED_STREETS = [
  ...PLACES,
  ...(streetsJson as StreetRow[])
    .filter((s) => s.n)
    .map((s) => {
      const lats = s.p.map((p) => p[0]);
      const lngs = s.p.map((p) => p[1]);
      return {
        name: s.n as string,
        lat: lats.reduce((a, b) => a + b, 0) / lats.length,
        lng: lngs.reduce((a, b) => a + b, 0) / lngs.length,
      };
    }),
]
  .filter((s, i, arr) => arr.findIndex((x) => x.name === s.name) === i)
  .sort((a, b) => a.name.localeCompare(b.name, "es"));

type WeatherState = {
  temp: number;
  code: number;
  isDay: boolean;
  daily: { date: string; max: number; min: number; code: number }[];
};

function WeatherGlyph({ code, isDay, className }: { code: number; isDay: boolean; className?: string }) {
  if (code === 0) return isDay ? <Sun className={className} /> : <Cloud className={className} />;
  if (code <= 3) return <Cloud className={className} />;
  if (code <= 82) return <CloudRain className={className} />;
  return <CloudLightning className={className} />;
}

export function Hud({ mapRef }: { mapRef: RefObject<MapHandle | null> }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <LocationHeader />
      <WeatherCard />
      <CompassBadge />
      <ToolColumn />
      <TypeMenu />
      <SearchPanel />
      <LayersPanel />
      <PlacingBanner />
      <Composer />
      <ReportsStack />
      <ZoomCluster mapRef={mapRef} />
      <p className="pointer-events-none absolute bottom-3 left-3 font-display text-xs tracking-wide text-title/80">
        Imágenes satelitales · OSM
      </p>
    </div>
  );
}

function LocationHeader() {
  return (
    <div className="pointer-events-none absolute top-[max(1rem,env(safe-area-inset-top))] left-[max(1rem,env(safe-area-inset-left))] z-20">
      <div className="flex items-start gap-2">
        <MapPin className="mt-1 size-5 text-title" strokeWidth={2.2} />
        <div>
          <p className="font-display text-xl leading-none font-semibold tracking-[0.22em] text-title uppercase">
            {COLONIA.city}
          </p>
          <p className="mt-1 font-display text-xs tracking-[0.28em] text-title/80 uppercase">
            {COLONIA.state}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <span className="h-px w-8 bg-title/70" />
            <p className="font-display text-lg leading-none font-semibold tracking-[0.18em] text-title uppercase">
              {COLONIA.name}
            </p>
          </div>
          <HudAccount />
        </div>
      </div>
    </div>
  );
}

function HudAccount() {
  const user = useCurrentUser();
  const membership = useMapStore((s) => s.membership);
  const [busy, setBusy] = useState(false);
  if (!user) return null;
  const label = membership?.displayName || user.displayName || "Vecino";
  return (
    <div className="pointer-events-auto mt-3">
      <div className="hud-panel flex items-center gap-2 rounded-full py-1 pr-1 pl-1">
        <span className="grid size-7 place-items-center rounded-full bg-title/20 font-display text-sm text-title">
          {label.charAt(0).toUpperCase()}
        </span>
        <span className="max-w-28 truncate text-xs">{label}</span>
        {membership?.role === "admin" ? (
          <span className="font-display text-[0.6rem] tracking-widest text-title uppercase">Admin</span>
        ) : null}
        {authEnabled ? (
          <button
            type="button"
            className="hud-signout"
            disabled={busy}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setBusy(true);
              useMapStore.getState().setGuestLock(true);
              useMapStore.getState().setMembership(null);
              useMapStore.getState().setAdminOpen(false);
              void signOut("/").catch((err) => {
                toast.error(err instanceof Error ? err.message : "No se pudo cerrar sesión.");
                setBusy(false);
              });
            }}
          >
            {busy ? "Saliendo…" : "Salir"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function WeatherCard() {
  const [open, setOpen] = useState(false);
  const [weather, setWeather] = useState<WeatherState>({
    temp: 34,
    code: 0,
    isDay: true,
    daily: [],
  });

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const res = await fetch(WEATHER_URL);
        if (!res.ok) return;
        const data = (await res.json()) as {
          current: { temperature_2m: number; weather_code: number; is_day: number };
          daily: { time: string[]; weather_code: number[]; temperature_2m_max: number[]; temperature_2m_min: number[] };
        };
        if (!live) return;
        setWeather({
          temp: Math.round(data.current.temperature_2m),
          code: data.current.weather_code,
          isDay: Boolean(data.current.is_day),
          daily: data.daily.time.slice(0, 4).map((date, i) => ({
            date,
            max: Math.round(data.daily.temperature_2m_max[i] ?? 0),
            min: Math.round(data.daily.temperature_2m_min[i] ?? 0),
            code: data.daily.weather_code[i] ?? 0,
          })),
        });
      } catch {
        /* keep fallback */
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  return (
    <div className="pointer-events-auto absolute top-[max(10.75rem,calc(env(safe-area-inset-top)+9.75rem))] left-[max(1rem,env(safe-area-inset-left))] z-10">
      <div>
        <button
          type="button"
          className="hud-panel flex items-center gap-3 rounded-xl px-3 py-2"
          onClick={() => setOpen((v) => !v)}
        >
          <WeatherGlyph code={weather.code} isDay={weather.isDay} className="size-6 text-title" />
          <span className="text-left">
            <span className="block font-display text-2xl leading-none font-semibold">{weather.temp}°C</span>
            <span className="text-xs text-muted">{weatherLabel(weather.code, weather.isDay)}</span>
          </span>
          <ChevronDown className={cn("size-4 text-muted transition-transform", open && "rotate-180")} />
        </button>
        {open && weather.daily.length > 0 ? (
          <ul className="hud-panel mt-2 w-56 space-y-1 rounded-xl p-3">
            {weather.daily.map((day) => (
              <li key={day.date} className="flex items-center gap-2 text-sm">
                <WeatherGlyph code={day.code} isDay className="size-4 text-title" />
                <span className="flex-1 text-muted">
                  {new Date(day.date + "T12:00:00").toLocaleDateString("es-MX", {
                    weekday: "short",
                    day: "numeric",
                  })}
                </span>
                <span className="tabular-nums text-fg">
                  {day.max}° / {day.min}°
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

function CompassBadge() {
  return (
    <div className="pointer-events-none absolute top-[max(1rem,env(safe-area-inset-top))] right-[max(1rem,env(safe-area-inset-right))]">
      <div className="relative grid size-12 place-items-center rounded-full border border-title/50 bg-hud/70 text-title shadow-hud">
        <Compass className="size-6" />
        <span className="absolute -top-2 font-display text-[0.65rem] font-bold tracking-widest">N</span>
      </div>
    </div>
  );
}

function ToolColumn() {
  const typeMenuOpen = useMapStore((s) => s.typeMenuOpen);
  const searchOpen = useMapStore((s) => s.searchOpen);
  const layersOpen = useMapStore((s) => s.layersOpen);
  const placingType = useMapStore((s) => s.placingType);
  const setTypeMenuOpen = useMapStore((s) => s.setTypeMenuOpen);
  const setSearchOpen = useMapStore((s) => s.setSearchOpen);
  const setLayersOpen = useMapStore((s) => s.setLayersOpen);

  return (
    <div className="pointer-events-auto absolute top-20 right-[max(1rem,env(safe-area-inset-right))] flex flex-col gap-2">
      <button
        type="button"
        className={cn("hud-icon-btn", searchOpen && "is-on")}
        aria-label="Buscar"
        onClick={() => setSearchOpen(!searchOpen)}
      >
        <Search className="size-5" />
      </button>
      <button
        type="button"
        className={cn("hud-icon-btn", layersOpen && "is-on")}
        aria-label="Capas"
        onClick={() => setLayersOpen(!layersOpen)}
      >
        <Layers className="size-5" />
      </button>
      <button
        type="button"
        className={cn("hud-icon-btn is-alert", (typeMenuOpen || placingType) && "is-on")}
        aria-label="Nuevo reporte"
        onClick={() => setTypeMenuOpen(!typeMenuOpen)}
      >
        <TriangleAlert className="size-5" />
      </button>
      <AdminToolButton />
    </div>
  );
}

function TypeMenu() {
  const open = useMapStore((s) => s.typeMenuOpen);
  const placingType = useMapStore((s) => s.placingType);
  const filterType = useMapStore((s) => s.filterType);
  const reports = useMapStore((s) => s.reports);
  const startPlacing = useMapStore((s) => s.startPlacing);
  const setFilterType = useMapStore((s) => s.setFilterType);
  const setTypeMenuOpen = useMapStore((s) => s.setTypeMenuOpen);
  if (!open) return null;

  return (
    <div className="pointer-events-auto absolute inset-x-3 bottom-28 z-20 md:inset-x-auto md:top-36 md:right-[4.4rem] md:bottom-auto md:w-64">
      <div className="hud-panel relative max-h-[50vh] overflow-auto rounded-xl p-2 md:max-h-none">
        <span className="absolute top-24 -right-2 hidden size-3 rotate-45 border-t border-r border-accent/50 bg-hud md:block" />
        {REPORT_TYPES.map((type) => {
          const count = reports.filter((r) => r.type === type.id).length;
          const on = placingType === type.id || filterType === type.id;
          return (
            <button
              key={type.id}
              type="button"
              className={cn("type-row", on && "is-on")}
              onClick={() => {
                startPlacing(type.id);
                setFilterType(null);
                if (window.matchMedia("(max-width: 767px)").matches) setTypeMenuOpen(false);
                toast.message(`Toca el mapa para marcar: ${type.label}`);
              }}
            >
              <span className="type-dot" style={{ ["--pin-bg" as string]: `var(--color-${type.token})` }}>
                <type.icon className="size-3.5" />
              </span>
              <span className="min-w-0 flex-1 text-sm">{type.label}</span>
              <span className="tabular-nums text-xs text-muted">{count}</span>
            </button>
          );
        })}
        <button
          type="button"
          className="mt-1 w-full rounded-md px-2 py-1 text-xs text-muted"
          onClick={() => setTypeMenuOpen(false)}
        >
          Cerrar catálogo
        </button>
      </div>
    </div>
  );
}

function SearchPanel() {
  const open = useMapStore((s) => s.searchOpen);
  const query = useMapStore((s) => s.searchQuery);
  const setSearchQuery = useMapStore((s) => s.setSearchQuery);
  const reports = useMapStore((s) => s.reports);
  const requestFly = useMapStore((s) => s.requestFly);
  const setSearchOpen = useMapStore((s) => s.setSearchOpen);
  const setReportsOpen = useMapStore((s) => s.setReportsOpen);
  if (!open) return null;

  const q = query.trim().toLowerCase();
  const reportHits = q
    ? reports
        .filter((r) => {
          const t = REPORT_TYPE_MAP[r.type];
          return (
            t.label.toLowerCase().includes(q) ||
            r.author.toLowerCase().includes(q) ||
            r.note.toLowerCase().includes(q)
          );
        })
        .slice(0, 6)
    : [];
  const streetHits = q
    ? NAMED_STREETS.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 6)
    : NAMED_STREETS.slice(0, 5);

  return (
    <div className="pointer-events-auto absolute top-20 right-16 w-[min(20rem,calc(100vw-5.5rem))]">
      <div className="hud-panel rounded-xl p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="font-display text-sm tracking-widest text-accent uppercase">Buscar</p>
          <button type="button" className="grid size-8 place-items-center" onClick={() => setSearchOpen(false)}>
            <X className="size-4" />
          </button>
        </div>
        <input
          className="hud-input"
          autoFocus
          placeholder="Calle, vecino o tipo…"
          value={query}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <ul className="mt-2 max-h-64 overflow-auto">
          {reportHits.map((r) => {
            const t = REPORT_TYPE_MAP[r.type];
            return (
              <li key={r.id}>
                <button
                  type="button"
                  className="type-row"
                  onClick={() => {
                    requestFly(r.lat, r.lng, r.id);
                    setReportsOpen(true);
                    setSearchOpen(false);
                  }}
                >
                  <span className="type-dot" style={{ ["--pin-bg" as string]: `var(--color-${t.token})` }}>
                    <t.icon className="size-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{t.label}</span>
                    <span className="block text-xs text-muted">{r.author}</span>
                  </span>
                </button>
              </li>
            );
          })}
          {streetHits.map((s) => (
            <li key={s.name}>
              <button
                type="button"
                className="type-row"
                onClick={() => {
                  requestFly(s.lat, s.lng);
                  setSearchOpen(false);
                }}
              >
                <span className="type-dot" style={{ ["--pin-bg" as string]: "var(--color-street)" }}>
                  <MapPin className="size-3.5" />
                </span>
                <span className="truncate text-sm">{s.name}</span>
              </button>
            </li>
          ))}
          {q && reportHits.length === 0 && streetHits.length === 0 ? (
            <li className="px-2 py-3 text-sm text-muted">Sin resultados en la colonia.</li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}

function LayersPanel() {
  const open = useMapStore((s) => s.layersOpen);
  const showStreets = useMapStore((s) => s.showStreets);
  const showReports = useMapStore((s) => s.showReports);
  const setShowStreets = useMapStore((s) => s.setShowStreets);
  const setShowReports = useMapStore((s) => s.setShowReports);
  const setLayersOpen = useMapStore((s) => s.setLayersOpen);
  if (!open) return null;
  return (
    <div className="pointer-events-auto absolute top-36 right-16 w-52">
      <div className="hud-panel rounded-xl p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="font-display text-sm tracking-widest text-accent uppercase">Capas</p>
          <button type="button" className="grid size-8 place-items-center" onClick={() => setLayersOpen(false)}>
            <X className="size-4" />
          </button>
        </div>
        <label className="type-row cursor-pointer">
          <input
            type="checkbox"
            className="size-4 accent-accent"
            checked={showStreets}
            onChange={(e) => setShowStreets(e.target.checked)}
          />
          <span className="text-sm">Calles iluminadas</span>
        </label>
        <label className="type-row cursor-pointer">
          <input
            type="checkbox"
            className="size-4 accent-accent"
            checked={showReports}
            onChange={(e) => setShowReports(e.target.checked)}
          />
          <span className="text-sm">Reportes</span>
        </label>
      </div>
    </div>
  );
}

function PlacingBanner() {
  const placingType = useMapStore((s) => s.placingType);
  const cancelPlacing = useMapStore((s) => s.cancelPlacing);
  if (!placingType) return null;
  const t = REPORT_TYPE_MAP[placingType];
  return (
    <div className="pointer-events-auto absolute top-4 left-1/2 z-20 w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 md:top-6">
      <div className="hud-panel flex items-center gap-3 rounded-xl px-3 py-2">
        <span className="type-dot" style={{ ["--pin-bg" as string]: `var(--color-${t.token})` }}>
          <t.icon className="size-3.5" />
        </span>
        <p className="min-w-0 flex-1 text-sm">Toca el mapa para marcar {t.label.toLowerCase()}</p>
        <button type="button" className="seg-btn" onClick={cancelPlacing}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

function Composer() {
  const draft = useMapStore((s) => s.draft);
  const authorName = useMapStore((s) => s.authorName);
  const setAuthorName = useMapStore((s) => s.setAuthorName);
  const addReport = useMapStore((s) => s.addReport);
  const setDraft = useMapStore((s) => s.setDraft);
  const startPlacing = useMapStore((s) => s.startPlacing);
  const requestFly = useMapStore((s) => s.requestFly);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setNote("");
  }, [draft]);

  if (!draft) return null;
  const t = REPORT_TYPE_MAP[draft.type];

  return (
    <div className="pointer-events-auto absolute inset-x-3 bottom-28 z-30 mx-auto w-[min(26rem,calc(100vw-1.5rem))] md:bottom-8">
      <div className="hud-panel rounded-xl p-4">
        <div className="mb-3 flex items-center gap-3">
          <span className="type-dot size-9" style={{ ["--pin-bg" as string]: `var(--color-${t.token})` }}>
            <t.icon className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-semibold leading-tight">{t.label}</p>
            <p className="text-xs text-muted tabular-nums">
              {draft.lat.toFixed(5)}, {draft.lng.toFixed(5)}
            </p>
          </div>
          <button type="button" className="grid size-9 place-items-center" onClick={() => setDraft(null)} aria-label="Cerrar">
            <X className="size-4" />
          </button>
        </div>
        <label className="mb-2 block text-xs tracking-wide text-muted uppercase">Publicado por</label>
        <input
          className="hud-input mb-3"
          placeholder="Tu nombre"
          value={authorName}
          onChange={(e) => setAuthorName(e.target.value)}
        />
        <label className="mb-2 block text-xs tracking-wide text-muted uppercase">Nota</label>
        <input
          className="hud-input mb-4"
          placeholder="¿Qué está pasando?"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="flex gap-2">
          <button
            type="button"
            className="seg-btn flex-1"
            onClick={() => {
              setDraft(null);
              startPlacing(draft.type);
            }}
          >
            Mover pin
          </button>
          <button
            type="button"
            className="flex-1 rounded-md bg-accent px-3 py-2 text-sm font-semibold text-hud"
            disabled={saving}
            onClick={() => {
              const author = authorName.trim() || "Vecino";
              if (!authorName.trim()) setAuthorName("Vecino");
              setSaving(true);
              void addReport({
                type: draft.type,
                lat: draft.lat,
                lng: draft.lng,
                author,
                note: note.trim(),
              })
                .then((report) => {
                  requestFly(report.lat, report.lng, report.id);
                  toast.success("Reporte publicado en el área medida");
                })
                .catch((err: unknown) => {
                  toast.error(err instanceof Error ? err.message : "No se pudo publicar.");
                })
                .finally(() => setSaving(false));
            }}
          >
            {saving ? "Publicando…" : "Publicar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ReportsStack() {
  const reportsOpen = useMapStore((s) => s.reportsOpen);
  const statsOpen = useMapStore((s) => s.statsOpen);
  const setReportsOpen = useMapStore((s) => s.setReportsOpen);
  const setStatsOpen = useMapStore((s) => s.setStatsOpen);
  const reports = useMapStore((s) => s.reports);
  const selectedId = useMapStore((s) => s.selectedId);
  const selectReport = useMapStore((s) => s.selectReport);
  const requestFly = useMapStore((s) => s.requestFly);
  const filterType = useMapStore((s) => s.filterType);
  const setFilterType = useMapStore((s) => s.setFilterType);
  const period = useMapStore((s) => s.period);
  const setPeriod = useMapStore((s) => s.setPeriod);
  const removeReport = useMapStore((s) => s.removeReport);
  const membership = useMapStore((s) => s.membership);

  const visible = useMemo(() => {
    const list = filterType ? reports.filter((r) => r.type === filterType) : reports;
    return [...list].sort((a, b) => b.createdAt - a.createdAt);
  }, [reports, filterType]);

  const selected = reports.find((r) => r.id === selectedId) ?? null;

  const counts = useMemo(() => {
    const inP = reports.filter((r) => inPeriod(r.createdAt, period));
    return REPORT_TYPES.map((t) => ({
      ...t,
      n: inP.filter((r) => r.type === t.id).length,
    }));
  }, [reports, period]);
  const max = Math.max(1, ...counts.map((c) => c.n));

  return (
    <div className="pointer-events-auto absolute inset-x-3 bottom-4 z-20 md:inset-x-auto md:right-[4.4rem] md:bottom-4 md:w-[min(28rem,calc(100vw-8rem))]">
      {statsOpen ? (
        <div className="hud-panel mb-2 rounded-xl p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="flex items-center gap-2 font-display text-sm tracking-widest text-accent uppercase">
              <BarChart3 className="size-4" />
              Reportes por:
            </p>
            <button type="button" className="grid size-8 place-items-center" onClick={() => setStatsOpen(false)}>
              <ChevronDown className="size-4 rotate-180" />
            </button>
          </div>
          <div className="mb-3 flex flex-wrap gap-1">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={cn("seg-btn", period === p.id && "is-on")}
                onClick={() => setPeriod(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <ul className="space-y-1.5">
            {counts.map((c) => (
              <li key={c.id} className="flex items-center gap-2">
                <span className="w-28 truncate text-xs text-muted">{c.label}</span>
                <div className="stat-bar flex-1">
                  <span style={{ width: `${(c.n / max) * 100}%`, ["--pin-bg" as string]: `var(--color-${c.token})` }} />
                </div>
                <span className="w-5 text-right text-xs tabular-nums">{c.n}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <button
          type="button"
          className="hud-panel mb-2 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left"
          onClick={() => setStatsOpen(true)}
        >
          <BarChart3 className="size-4 text-accent" />
          <span className="text-sm">Estadísticas</span>
        </button>
      )}

      {reportsOpen ? (
        <div className="hud-panel overflow-hidden rounded-xl">
          <div className="flex items-center justify-between px-3 py-2">
            <p className="flex items-center gap-2 font-display text-sm tracking-widest text-accent uppercase">
              <Calendar className="size-4" />
              Últimos reportes
            </p>
            <button type="button" className="grid size-8 place-items-center" onClick={() => setReportsOpen(false)}>
              <X className="size-4" />
            </button>
          </div>
          <div className="max-h-44 overflow-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[0.65rem] tracking-widest text-muted uppercase">
                <tr>
                  <th className="px-2 py-1 font-medium">Fecha</th>
                  <th className="px-2 py-1 font-medium">Hora</th>
                  <th className="px-2 py-1 font-medium">Punto</th>
                  <th className="px-2 py-1 font-medium">Reporte</th>
                  <th className="px-2 py-1 font-medium">Por</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => {
                  const t = REPORT_TYPE_MAP[r.type];
                  return (
                    <tr
                      key={r.id}
                      className={cn("cursor-pointer border-t border-white/5", r.id === selectedId && "bg-accent/10")}
                      onClick={() => {
                        selectReport(r.id);
                        requestFly(r.lat, r.lng, r.id);
                      }}
                    >
                      <td className="px-2 py-2">{formatDate(r.createdAt)}</td>
                      <td className="px-2 py-2 tabular-nums">{formatTime(r.createdAt)}</td>
                      <td className="px-2 py-2">
                        <span className="type-dot size-6" style={{ ["--pin-bg" as string]: `var(--color-${t.token})` }}>
                          <t.icon className="size-3" />
                        </span>
                      </td>
                      <td className="px-2 py-2">{t.label}</td>
                      <td className="px-2 py-2 text-muted">{r.author}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {selected ? (
            <div className="border-t border-accent/20 px-3 py-2 text-sm">
              <p className="text-fg">{selected.note || "Sin nota extra."}</p>
              {membership?.role === "admin" || selected.userId === membership?.userId ? (
                <button
                  type="button"
                  className="mt-1 text-xs text-muted"
                  onClick={() => {
                    void removeReport(selected.id).catch((err: unknown) => {
                      toast.error(err instanceof Error ? err.message : "No se pudo quitar.");
                    });
                  }}
                >
                  Quitar del mapa
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          className="hud-panel mb-2 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left"
          onClick={() => setReportsOpen(true)}
        >
          <Calendar className="size-4 text-accent" />
          <span className="text-sm">Últimos reportes</span>
        </button>
      )}
    </div>
  );
}

function ZoomCluster({ mapRef }: { mapRef: RefObject<MapHandle | null> }) {
  const locate = () => {
    mapRef.current?.locate();
  };
  return (
    <div className="pointer-events-auto absolute right-[max(1rem,env(safe-area-inset-right))] bottom-[12.5rem] flex flex-col gap-2 md:bottom-4">
      <button type="button" className="hud-icon-btn" aria-label="Acercar" onClick={() => mapRef.current?.zoomIn()}>
        <Plus className="size-5" />
      </button>
      <button type="button" className="hud-icon-btn" aria-label="Alejar" onClick={() => mapRef.current?.zoomOut()}>
        <Minus className="size-5" />
      </button>
      <button type="button" className="hud-icon-btn" aria-label="Mi ubicación" onClick={locate}>
        <Crosshair className="size-5" />
      </button>
    </div>
  );
}
