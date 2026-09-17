import { useEffect, useState } from "react";
import { MapPin, Shield } from "lucide-react";
import { COLONIA } from "@/lib/geo";
import { getMembership, type Membership } from "@/lib/community";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { signOut } from "@/lib/auth/client";
import { hasGateSessionMarker } from "@/lib/auth/gate-session-marker";
import { LoginCard } from "@/components/login-card";
import { useMapStore } from "@/lib/store";
import { cn } from "@/lib/utils";

function LocationLockup() {
  return (
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
      </div>
    </div>
  );
}

function OverlayChrome({
  children,
  expanded,
}: {
  children: React.ReactNode;
  expanded?: boolean;
}) {
  return (
    <div
      className={cn(
        "auth-scrim absolute inset-0 z-30 flex flex-col px-4 py-5 md:px-8 md:py-6",
        expanded && "is-expanded",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <LocationLockup />
        <div className="hidden text-right sm:block">
          <svg viewBox="0 0 220 78" className="ml-auto h-10 w-auto text-title" aria-hidden>
            <path
              d="M18 58 55 18l22 24 18-20 28 36H18z"
              fill="none"
              stroke="currentColor"
              strokeWidth="3.2"
              strokeLinejoin="round"
            />
            <path d="M40 58 62 32l16 18 12-14 22 22H40z" fill="currentColor" opacity="0.18" />
          </svg>
          <p className="font-display text-xl leading-none font-bold tracking-[0.12em] text-fg uppercase">
            Alerta
          </p>
          <p className="font-display text-xl leading-none font-bold tracking-[0.14em] text-title uppercase">
            Cuevas
          </p>
        </div>
      </div>
      <div
        className={cn(
          "flex flex-1 justify-center",
          expanded ? "items-center overflow-y-auto py-6" : "items-center pb-6",
        )}
      >
        {children}
      </div>
      {expanded ? null : (
        <p className="pt-2 text-center font-display text-xs tracking-[0.28em] text-title uppercase">
          Las Cuevas somos todos
        </p>
      )}
    </div>
  );
}

function StatusCard({
  title,
  body,
  allowSignOut,
}: {
  title: string;
  body: string;
  allowSignOut: boolean;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="auth-card mx-auto w-[min(26.5rem,calc(100vw-1.5rem))] rounded-3xl px-6 py-8 text-center">
      <div className="mx-auto mb-4 grid size-16 place-items-center rounded-full border-2 border-title text-title">
        <Shield className="size-8" />
      </div>
      <h2 className="font-display text-2xl font-semibold text-fg">{title}</h2>
      <p className="mt-3 text-sm leading-relaxed text-muted">{body}</p>
      {allowSignOut ? (
        <button
          type="button"
          className="auth-social mt-6 w-full"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            useMapStore.getState().setGuestLock(true);
            void signOut("/").catch(() => setBusy(false));
          }}
        >
          {busy ? "Saliendo…" : "Usar otra cuenta"}
        </button>
      ) : null}
    </div>
  );
}

export function AuthOverlay({
  onReady,
}: {
  onReady: (member: Membership) => void;
}) {
  const { user, isPending } = useCurrentUserState();
  const [member, setMember] = useState<Membership | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const guestLock = useMapStore((s) => s.guestLock);
  const gateSession = typeof document !== "undefined" && hasGateSessionMarker();

  useEffect(() => {
    if (guestLock || !user) {
      setMember(null);
      return;
    }
    let live = true;
    setLoadError(false);

    const load = () =>
      getMembership()
        .then((row) => {
          if (!live) return;
          setMember(row);
          if (row.status === "approved") onReady(row);
        })
        .catch(() => {
          if (live) setLoadError(true);
        });

    void load();
    const id = window.setInterval(() => {
      void load();
    }, 4000);
    return () => {
      live = false;
      window.clearInterval(id);
    };
  }, [user?.id, onReady, guestLock]);

  if (guestLock || !user) {
    if (isPending && !guestLock) {
      return (
        <OverlayChrome>
          <div className="auth-card auth-card-compact h-28 w-[min(22rem,calc(100vw-1.5rem))] animate-pulse rounded-3xl" />
        </OverlayChrome>
      );
    }
    return (
      <OverlayChrome expanded={formOpen}>
        <LoginCard onExpandedChange={setFormOpen} />
      </OverlayChrome>
    );
  }

  if (isPending || (!member && !loadError)) {
    return (
      <OverlayChrome>
        <div className="auth-card auth-card-compact h-28 w-[min(22rem,calc(100vw-1.5rem))] animate-pulse rounded-3xl" />
      </OverlayChrome>
    );
  }

  if (loadError) {
    return (
      <OverlayChrome expanded>
        <StatusCard
          title="No se pudo validar tu cuenta"
          body="Intenta de nuevo en un momento."
          allowSignOut={!gateSession}
        />
      </OverlayChrome>
    );
  }

  if (!member || member.status === "pending") {
    return (
      <OverlayChrome expanded>
        <StatusCard
          title="Esperando aprobación"
          body={`Hola${member?.displayName ? `, ${member.displayName}` : ""}. El administrador (Bardohmo@gmail.com) debe aprobar tu cuenta antes de ver el mapa nítido.`}
          allowSignOut={!gateSession}
        />
      </OverlayChrome>
    );
  }

  if (member.status === "rejected") {
    return (
      <OverlayChrome expanded>
        <StatusCard
          title="Solicitud rechazada"
          body="Tu acceso no fue aprobado. Escribe a Bardohmo@gmail.com si crees que es un error."
          allowSignOut={!gateSession}
        />
      </OverlayChrome>
    );
  }

  return null;
}
