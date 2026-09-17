import { create } from "zustand";
import { createReport, deleteReport, type Membership } from "@/lib/community";
import type { Period, Report, ReportTypeId } from "@/lib/report-types";

const AUTHOR_KEY = "alerta-cuevas-author";
const GUEST_KEY = "alerta-cuevas-guest";

function readAuthor(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(AUTHOR_KEY) ?? "";
  } catch {
    return "";
  }
}

function readGuestLock(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(GUEST_KEY) === "1";
  } catch {
    return false;
  }
}

export type Draft = { lat: number; lng: number; type: ReportTypeId };

type MapStore = {
  reports: Report[];
  membership: Membership | null;
  selectedId: string | null;
  placingType: ReportTypeId | null;
  draft: Draft | null;
  authorName: string;
  period: Period;
  typeMenuOpen: boolean;
  reportsOpen: boolean;
  statsOpen: boolean;
  searchOpen: boolean;
  layersOpen: boolean;
  adminOpen: boolean;
  showStreets: boolean;
  showReports: boolean;
  filterType: ReportTypeId | null;
  searchQuery: string;
  flyRequest: { lat: number; lng: number; id?: string } | null;
  guestLock: boolean;
  setReports: (reports: Report[]) => void;
  setMembership: (membership: Membership | null) => void;
  setTypeMenuOpen: (open: boolean) => void;
  setReportsOpen: (open: boolean) => void;
  setStatsOpen: (open: boolean) => void;
  setSearchOpen: (open: boolean) => void;
  setLayersOpen: (open: boolean) => void;
  setAdminOpen: (open: boolean) => void;
  setShowStreets: (show: boolean) => void;
  setShowReports: (show: boolean) => void;
  setPeriod: (period: Period) => void;
  setFilterType: (type: ReportTypeId | null) => void;
  setSearchQuery: (q: string) => void;
  setAuthorName: (name: string) => void;
  selectReport: (id: string | null) => void;
  startPlacing: (type: ReportTypeId) => void;
  cancelPlacing: () => void;
  setDraft: (draft: Draft | null) => void;
  addReport: (input: Omit<Report, "id" | "createdAt">) => Promise<Report>;
  removeReport: (id: string) => Promise<void>;
  requestFly: (lat: number, lng: number, id?: string) => void;
  clearFly: () => void;
  setGuestLock: (lock: boolean) => void;
};

export const useMapStore = create<MapStore>((set, get) => ({
  reports: [],
  membership: null,
  selectedId: null,
  placingType: null,
  draft: null,
  authorName: readAuthor(),
  period: "day",
  typeMenuOpen: true,
  reportsOpen: true,
  statsOpen: true,
  searchOpen: false,
  layersOpen: false,
  adminOpen: false,
  showStreets: true,
  showReports: true,
  filterType: null,
  searchQuery: "",
  flyRequest: null,
  guestLock: readGuestLock(),
  setReports: (reports) => set({ reports }),
  setMembership: (membership) => set({ membership }),
  setTypeMenuOpen: (typeMenuOpen) =>
    set({
      typeMenuOpen,
      searchOpen: typeMenuOpen ? false : get().searchOpen,
      layersOpen: typeMenuOpen ? false : get().layersOpen,
      adminOpen: typeMenuOpen ? false : get().adminOpen,
    }),
  setReportsOpen: (reportsOpen) => set({ reportsOpen }),
  setStatsOpen: (statsOpen) => set({ statsOpen }),
  setSearchOpen: (searchOpen) =>
    set({
      searchOpen,
      typeMenuOpen: searchOpen ? false : get().typeMenuOpen,
      layersOpen: searchOpen ? false : get().layersOpen,
      adminOpen: searchOpen ? false : get().adminOpen,
    }),
  setLayersOpen: (layersOpen) =>
    set({
      layersOpen,
      typeMenuOpen: layersOpen ? false : get().typeMenuOpen,
      searchOpen: layersOpen ? false : get().searchOpen,
      adminOpen: layersOpen ? false : get().adminOpen,
    }),
  setAdminOpen: (adminOpen) =>
    set({
      adminOpen,
      typeMenuOpen: adminOpen ? false : get().typeMenuOpen,
      searchOpen: adminOpen ? false : get().searchOpen,
      layersOpen: adminOpen ? false : get().layersOpen,
    }),
  setShowStreets: (showStreets) => set({ showStreets }),
  setShowReports: (showReports) => set({ showReports }),
  setPeriod: (period) => set({ period }),
  setFilterType: (filterType) => set({ filterType }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setAuthorName: (authorName) => {
    set({ authorName });
    try {
      localStorage.setItem(AUTHOR_KEY, authorName);
    } catch {
      /* ignore */
    }
  },
  selectReport: (selectedId) => set({ selectedId }),
  startPlacing: (placingType) =>
    set({
      placingType,
      draft: null,
      typeMenuOpen: true,
      searchOpen: false,
      layersOpen: false,
      adminOpen: false,
    }),
  cancelPlacing: () => set({ placingType: null, draft: null }),
  setDraft: (draft) => set({ draft, placingType: draft ? null : get().placingType }),
  addReport: async (input) => {
    const report = await createReport({
      data: {
        type: input.type,
        lat: input.lat,
        lng: input.lng,
        note: input.note,
        author: input.author,
      },
    });
    set({
      reports: [report, ...get().reports.filter((r) => r.id !== report.id)],
      draft: null,
      placingType: null,
      selectedId: report.id,
      reportsOpen: true,
      filterType: null,
    });
    return report;
  },
  removeReport: async (id) => {
    await deleteReport({ data: id });
    set({
      reports: get().reports.filter((r) => r.id !== id),
      selectedId: get().selectedId === id ? null : get().selectedId,
    });
  },
  requestFly: (lat, lng, id) => set({ flyRequest: { lat, lng, id }, selectedId: id ?? get().selectedId }),
  clearFly: () => set({ flyRequest: null }),
  setGuestLock: (guestLock) => {
    set({ guestLock, adminOpen: guestLock ? false : get().adminOpen });
    try {
      if (guestLock) sessionStorage.setItem(GUEST_KEY, "1");
      else sessionStorage.removeItem(GUEST_KEY);
    } catch {
      /* ignore */
    }
  },
}));
