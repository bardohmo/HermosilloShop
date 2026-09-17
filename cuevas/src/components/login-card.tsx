import { useState, type FormEvent } from "react";
import { ChevronLeft, Eye, EyeOff, Lock, LogIn, Mail, UserPlus, UserRound } from "lucide-react";
import { toast } from "sonner";
import { GROK_PROVIDERS, authClient, authEnabled, signIn } from "@/lib/auth/client";
import { useMapStore } from "@/lib/store";
import { cn } from "@/lib/utils";

type Tab = "login" | "register";
type Legal = "terms" | "privacy" | null;

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path
        fill="#EA4335"
        d="M12 10.2v3.6h5.1c-.2 1.2-.9 2.2-1.9 2.9l3.1 2.4c1.8-1.7 2.9-4.1 2.9-7 0-.7-.1-1.3-.2-1.9z"
      />
      <path
        fill="#34A853"
        d="M6.6 14.3 5.5 15.2 3.1 17c1.5 3 4.5 5 8.9 5 2.7 0 4.9-.9 6.5-2.4l-3.1-2.4c-.9.6-2 .9-3.4.9-2.6 0-4.8-1.7-5.6-4.1z"
      />
      <path
        fill="#4A90E2"
        d="M3.1 7c-.6 1.2-1 2.6-1 4s.4 2.8 1 4l3.5-2.7c-.2-.6-.3-1.2-.3-1.3s.1-.8.3-1.3z"
      />
      <path
        fill="#FBBC05"
        d="M12 5.5c1.5 0 2.8.5 3.8 1.5l2.8-2.8C16.9 2.4 14.7 1.5 12 1.5 7.6 1.5 4.6 3.5 3.1 7l3.5 2.7C7.2 7.2 9.4 5.5 12 5.5z"
      />
    </svg>
  );
}

function XMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden>
      <path d="M14.7 10.3 22 2h-1.7l-6.3 7.2L8.9 2H2.2l7.7 11.1L2.2 22h1.7l6.7-7.7L15.1 22h6.7zm-2.4 2.7-.8-1.1L4.7 3.3h2.6l5.2 7.4.8 1.1 6.9 9.9h-2.6z" />
    </svg>
  );
}

export function LoginCard({ onExpandedChange }: { onExpandedChange?: (open: boolean) => void }) {
  const [tab, setTab] = useState<Tab | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [confirm, setConfirm] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [legal, setLegal] = useState<Legal>(null);

  function openTab(next: Tab) {
    setTab(next);
    onExpandedChange?.(true);
  }

  function collapse() {
    setTab(null);
    setLegal(null);
    onExpandedChange?.(false);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!authEnabled) {
      toast.error("El registro aún no está activo.");
      return;
    }
    if (!tab) return;
    setBusy(true);
    try {
      if (tab === "register") {
        if (name.trim().length < 2) throw new Error("Escribe tu nombre.");
        if (password.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres.");
        if (password !== confirm) throw new Error("Las contraseñas no coinciden.");
        const { error } = await authClient.signUp.email({
          email: email.trim(),
          password,
          name: name.trim(),
        });
        if (error) throw new Error(error.message ?? "No se pudo registrar.");
        useMapStore.getState().setGuestLock(false);
        toast.success("Cuenta creada. El administrador debe aprobarte.");
      } else {
        const { error } = await authClient.signIn.email({
          email: email.trim(),
          password,
          rememberMe: remember,
        });
        if (error) throw new Error(error.message ?? "Correo o contraseña incorrectos.");
        useMapStore.getState().setGuestLock(false);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo continuar.");
    } finally {
      setBusy(false);
    }
  }

  if (!tab) {
    return (
      <div className="auth-card auth-card-compact mx-auto rounded-3xl px-4 py-4 md:px-5">
        <p className="text-center font-display text-lg font-semibold tracking-wide text-fg">Bienvenido</p>
        <p className="mx-auto mt-1 max-w-xs text-center text-xs leading-relaxed text-muted">
          Entra para ver el mapa nítido y reportar.
        </p>
        <div className="mt-4 grid gap-2">
          <button type="button" className="auth-cta" onClick={() => openTab("login")}>
            <LogIn className="size-4" />
            Iniciar sesión
          </button>
          <button type="button" className="auth-social font-display text-xs font-bold tracking-[0.12em] uppercase" onClick={() => openTab("register")}>
            <UserPlus className="size-4" />
            Registrarse
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-card relative mx-auto w-[min(26.5rem,calc(100vw-1.5rem))] rounded-3xl px-5 pt-11 pb-5 md:px-7">
      <button
        type="button"
        className="absolute top-3 left-3 grid size-9 place-items-center rounded-full text-muted"
        aria-label="Volver"
        onClick={collapse}
      >
        <ChevronLeft className="size-5" />
      </button>
      <div className="auth-avatar absolute -top-8 left-1/2 grid size-16 -translate-x-1/2 place-items-center rounded-full border-2 border-title bg-hud text-title">
        <UserRound className="size-8" strokeWidth={1.7} />
      </div>
      <h2 className="text-center font-display text-3xl font-semibold tracking-wide text-fg">Bienvenido</h2>
      <p className="mx-auto mt-2 max-w-sm text-center text-sm leading-relaxed text-muted">
        {tab === "login"
          ? "Inicia sesión para ver Las Cuevas con claridad."
          : "Regístrate para ser parte de la comunidad de Las Cuevas."}
      </p>

      <div className="mt-5 rounded-2xl border border-white/10 bg-hud/50 p-3 md:p-4">
        <div className="mb-4 grid grid-cols-2 gap-1">
          <button
            type="button"
            className={cn("auth-tab", tab === "login" && "is-on")}
            onClick={() => openTab("login")}
          >
            <UserRound className="size-4" />
            Iniciar sesión
          </button>
          <button
            type="button"
            className={cn("auth-tab", tab === "register" && "is-on")}
            onClick={() => openTab("register")}
          >
            <UserPlus className="size-4" />
            Registrarse
          </button>
        </div>

        <form className="space-y-3" onSubmit={(e) => void onSubmit(e)}>
          {tab === "register" ? (
            <label className="auth-field">
              <UserRound className="size-4 text-title" />
              <input
                required
                autoComplete="name"
                placeholder="Nombre"
                aria-label="Nombre"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
          ) : null}
          <label className="auth-field">
            <Mail className="size-4 text-title" />
            <input
              required
              id="auth-email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="Correo electrónico"
              aria-label="Correo electrónico"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="auth-field">
            <Lock className="size-4 text-title" />
            <input
              required
              id="auth-password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete={tab === "login" ? "current-password" : "new-password"}
              placeholder="Contraseña"
              aria-label="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="grid size-8 place-items-center text-title"
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </label>
          {tab === "register" ? (
            <label className="auth-field">
              <Lock className="size-4 text-title" />
              <input
                required
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Confirmar contraseña"
                aria-label="Confirmar contraseña"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </label>
          ) : (
            <div className="flex items-center justify-between gap-2 px-1 text-sm">
              <label className="flex cursor-pointer items-center gap-2 text-muted">
                <input
                  type="checkbox"
                  className="size-4 accent-title"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                Recordarme
              </label>
              <button
                type="button"
                className="text-accent"
                onClick={() =>
                  toast.message("Escribe a Bardohmo@gmail.com para recuperar tu cuenta.")
                }
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>
          )}
          <button type="submit" className="auth-cta" disabled={busy}>
            <LogIn className="size-4" />
            {busy ? "Un momento…" : tab === "login" ? "Iniciar sesión" : "Crear cuenta"}
          </button>
        </form>

        <div className="my-4 flex items-center gap-3 text-xs tracking-[0.3em] text-muted uppercase">
          <span className="h-px flex-1 bg-white/15" />
          o
          <span className="h-px flex-1 bg-white/15" />
        </div>

        {authEnabled ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {GROK_PROVIDERS.map((p) => (
              <button
                key={p.providerId}
                type="button"
                className="auth-social"
                onClick={() => {
                  useMapStore.getState().setGuestLock(false);
                  void signIn(p.providerId, { callbackURL: "/" }).catch((err: unknown) => {
                    toast.error(err instanceof Error ? err.message : "No se pudo conectar.");
                  });
                }}
              >
                {p.idp === "google" ? <GoogleMark /> : <XMark />}
                {p.idp === "google" ? "Continuar con Google" : "Continuar con X"}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-center text-sm text-muted">El registro está desactivado.</p>
        )}

        <p className="mt-4 text-center text-xs leading-relaxed text-muted">
          Al continuar, aceptas nuestros{" "}
          <button type="button" className="text-accent" onClick={() => setLegal("terms")}>
            Términos de uso
          </button>{" "}
          y{" "}
          <button type="button" className="text-accent" onClick={() => setLegal("privacy")}>
            Política de privacidad
          </button>
          .
        </p>
      </div>

      {legal ? (
        <div className="absolute inset-3 z-10 overflow-auto rounded-2xl border border-accent/40 bg-hud p-4 text-sm text-fg">
          <p className="font-display text-lg tracking-wide text-title uppercase">
            {legal === "terms" ? "Términos de uso" : "Política de privacidad"}
          </p>
          <p className="mt-3 leading-relaxed text-muted">
            {legal === "terms"
              ? "Alerta Cuevas es un mapa vecinal de Predio Las Cuevas. Los reportes son para avisar a la comunidad. No sustituyen al 911. Quien publique es responsable de su contenido. El administrador puede aprobar o rechazar cuentas y retirar reportes."
              : "Guardamos tu correo, nombre y reportes para operar la comunidad. No vendemos datos. Solo vecinos aprobados ven el mapa nítido. El administrador (Bardohmo@gmail.com) puede ver solicitudes de acceso."}
          </p>
          <button type="button" className="auth-cta mt-4" onClick={() => setLegal(null)}>
            Cerrar
          </button>
        </div>
      ) : null}
    </div>
  );
}
