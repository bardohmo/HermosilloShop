import { useCallback, useEffect, useRef, useState } from "react";
import { Toaster } from "sonner";
import { Hud } from "@/components/hud";
import { AdminPanel } from "@/components/admin-panel";
import { AuthOverlay } from "@/components/auth-overlay";
import { LeafletMap, type MapHandle } from "@/components/leaflet-map";
import { SEED_REPORTS } from "@/data/seed";
import { listReports, type Membership } from "@/lib/community";
import { useMapStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export function MapApp() {
  const mapRef = useRef<MapHandle>(null);
  const [unlocked, setUnlocked] = useState(false);
  const guestLock = useMapStore((s) => s.guestLock);
  const mapOpen = unlocked && !guestLock;

  const onReady = useCallback((member: Membership) => {
    if (useMapStore.getState().guestLock) return;
    useMapStore.getState().setMembership(member);
    if (member.displayName) useMapStore.getState().setAuthorName(member.displayName);
    setUnlocked(true);
    void listReports()
      .then((rows) => useMapStore.getState().setReports(rows))
      .catch(() => useMapStore.getState().setReports(SEED_REPORTS));
  }, []);

  useEffect(() => {
    useMapStore.getState().setReports(SEED_REPORTS);
    const compact = window.matchMedia("(max-width: 767px)").matches;
    if (compact) {
      useMapStore.setState({
        typeMenuOpen: false,
        statsOpen: false,
        reportsOpen: true,
      });
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        useMapStore.getState().cancelPlacing();
        useMapStore.getState().setAdminOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-hud text-fg">
      <h1 className="sr-only">Alerta Cuevas — mapa vecinal de Las Cuevas, Hermosillo</h1>
      <div className={cn("absolute inset-0", !mapOpen && "map-locked")}>
        <LeafletMap ref={mapRef} />
        <div className="map-vignette" />
        {mapOpen ? <Hud mapRef={mapRef} /> : null}
        {mapOpen ? <AdminPanel /> : null}
      </div>
      {mapOpen ? null : <AuthOverlay onReady={onReady} />}
      <Toaster
        theme="dark"
        position="top-center"
        toastOptions={{
          className: "hud-panel !border-accent/40 font-sans",
        }}
      />
    </main>
  );
}
