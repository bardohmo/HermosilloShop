import {
  CircleEllipsis,
  Droplets,
  Trash2,
  UserRoundSearch,
  UserRoundX,
  Recycle,
  Zap,
  type LucideIcon,
} from "lucide-react";

export type ReportTypeId =
  | "water"
  | "trash"
  | "suspect"
  | "dump"
  | "robbery"
  | "power"
  | "other";

export type ReportType = {
  id: ReportTypeId;
  label: string;
  icon: LucideIcon;
  token: string;
};

export const REPORT_TYPES: ReportType[] = [
  { id: "water", label: "Fuga de agua", icon: Droplets, token: "water" },
  { id: "trash", label: "Basura", icon: Trash2, token: "trash" },
  { id: "suspect", label: "Persona sospechosa", icon: UserRoundSearch, token: "suspect" },
  { id: "dump", label: "Persona tirando basura", icon: Recycle, token: "dump" },
  { id: "robbery", label: "Robo", icon: UserRoundX, token: "robbery" },
  { id: "power", label: "Corte de luz", icon: Zap, token: "power" },
  { id: "other", label: "Otro reporte", icon: CircleEllipsis, token: "other" },
];

export const REPORT_TYPE_MAP = Object.fromEntries(
  REPORT_TYPES.map((t) => [t.id, t]),
) as Record<ReportTypeId, ReportType>;

export type Report = {
  id: string;
  type: ReportTypeId;
  lat: number;
  lng: number;
  createdAt: number;
  author: string;
  note: string;
  userId?: string;
};

export type Period = "day" | "week" | "month" | "year";

export const PERIODS: { id: Period; label: string }[] = [
  { id: "day", label: "Día" },
  { id: "week", label: "Semana" },
  { id: "month", label: "Mes" },
  { id: "year", label: "Año" },
];

export function inPeriod(ts: number, period: Period, now = Date.now()): boolean {
  const day = 86_400_000;
  const span =
    period === "day" ? day : period === "week" ? 7 * day : period === "month" ? 30 * day : 365 * day;
  return now - ts <= span;
}

export function formatDate(ts: number): string {
  const d = new Date(ts);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function formatTime(ts: number): string {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${min}`;
}

export function weatherLabel(code: number, isDay: boolean): string {
  if (code === 0) return isDay ? "Soleado" : "Despejado";
  if (code <= 3) return "Parcial nublado";
  if (code <= 48) return "Niebla";
  if (code <= 67) return "Lluvia";
  if (code <= 77) return "Chubasco frío";
  if (code <= 82) return "Chubascos";
  if (code <= 99) return "Tormenta";
  return "Variable";
}
