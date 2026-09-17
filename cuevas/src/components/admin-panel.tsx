import { useEffect, useState } from "react";
import { ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { listMembers, setMemberStatus, getMembership, type MemberRow } from "@/lib/community";
import { useMapStore } from "@/lib/store";
import { formatDate } from "@/lib/report-types";
import { cn } from "@/lib/utils";

export function AdminPanel() {
  const open = useMapStore((s) => s.adminOpen);
  const setAdminOpen = useMapStore((s) => s.setAdminOpen);
  const membership = useMapStore((s) => s.membership);
  const [rows, setRows] = useState<MemberRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!open || membership?.role !== "admin") return;
    void listMembers()
      .then(setRows)
      .catch(() => toast.error("No se pudo cargar la lista de vecinos."));
  }, [open, membership?.role]);

  if (!open || membership?.role !== "admin") return null;

  return (
    <div className="pointer-events-auto absolute top-36 right-16 z-20 w-[min(22rem,calc(100vw-5rem))]">
      <div className="hud-panel max-h-[60vh] overflow-auto rounded-xl p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="font-display text-sm tracking-widest text-accent uppercase">Vecinos</p>
          <button type="button" className="grid size-8 place-items-center" onClick={() => setAdminOpen(false)}>
            <X className="size-4" />
          </button>
        </div>
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.userId} className="rounded-lg border border-white/10 px-2 py-2">
              <p className="truncate text-sm text-fg">{row.displayName || "Vecino"}</p>
              <p className="truncate text-xs text-muted">{row.email}</p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span
                  className={cn(
                    "font-display text-[0.65rem] tracking-widest uppercase",
                    row.status === "approved" && "text-trash",
                    row.status === "pending" && "text-title",
                    row.status === "rejected" && "text-dump",
                  )}
                >
                  {row.status === "approved" ? "Aprobado" : row.status === "pending" ? "Pendiente" : "Rechazado"}
                  {row.role === "admin" ? " · Admin" : ""}
                </span>
                <span className="text-[0.65rem] text-muted">{formatDate(row.createdAt)}</span>
              </div>
              {row.role !== "admin" && row.status === "pending" ? (
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    className="seg-btn flex-1"
                    disabled={busy === row.userId}
                    onClick={() => {
                      setBusy(row.userId);
                      void setMemberStatus({ data: { userId: row.userId, status: "approved" } })
                        .then(async (next) => {
                          setRows(next);
                          const me = await getMembership();
                          useMapStore.getState().setMembership(me);
                          toast.success(`Aprobaste a ${row.displayName || row.email}`);
                        })
                        .catch(() => toast.error("No se pudo aprobar."))
                        .finally(() => setBusy(null));
                    }}
                  >
                    Aprobar
                  </button>
                  <button
                    type="button"
                    className="seg-btn flex-1"
                    disabled={busy === row.userId}
                    onClick={() => {
                      setBusy(row.userId);
                      void setMemberStatus({ data: { userId: row.userId, status: "rejected" } })
                        .then(async (next) => {
                          setRows(next);
                          const me = await getMembership();
                          useMapStore.getState().setMembership(me);
                          toast.message("Solicitud rechazada");
                        })
                        .catch(() => toast.error("No se pudo rechazar."))
                        .finally(() => setBusy(null));
                    }}
                  >
                    Rechazar
                  </button>
                </div>
              ) : null}
            </li>
          ))}
          {rows.length === 0 ? <li className="px-1 py-3 text-sm text-muted">Nadie en la lista aún.</li> : null}
        </ul>
      </div>
    </div>
  );
}

export function AdminToolButton() {
  const membership = useMapStore((s) => s.membership);
  const adminOpen = useMapStore((s) => s.adminOpen);
  const setAdminOpen = useMapStore((s) => s.setAdminOpen);
  if (membership?.role !== "admin") return null;
  const pending = membership.pendingCount;
  return (
    <button
      type="button"
      className={cn("hud-icon-btn", adminOpen && "is-on", pending > 0 && "is-alert")}
      aria-label="Aprobar vecinos"
      onClick={() => setAdminOpen(!adminOpen)}
    >
      <ShieldCheck className="size-5" />
      {pending > 0 ? (
        <span className="absolute -top-1 -right-1 grid min-w-4 place-items-center rounded-full bg-title px-1 font-display text-[0.6rem] text-hud">
          {pending}
        </span>
      ) : null}
    </button>
  );
}
