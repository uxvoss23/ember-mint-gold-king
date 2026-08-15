import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import {
  GROK_PROVIDERS,
  authClient,
  authEnabled,
  signIn,
} from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/login")({ component: Login });

type Mode = "signin" | "signup";

function Login() {
  const navigate = useNavigate();
  const { user, isPending } = useCurrentUserState();
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [oauthBusy, setOauthBusy] = useState<string | null>(null);

  // Already signed in
  if (!isPending && user) {
    void navigate({ to: "/" });
  }

  const onEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error: err } = await authClient.signUp.email({
          email: email.trim(),
          password,
          name: name.trim() || email.split("@")[0] || "Player",
        });
        if (err) throw new Error(err.message ?? "Sign-up failed");
      } else {
        const { error: err } = await authClient.signIn.email({
          email: email.trim(),
          password,
        });
        if (err) throw new Error(err.message ?? "Sign-in failed");
      }
      await authClient.getSession();
      void navigate({ to: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const onOAuth = async (providerId: string) => {
    setError(null);
    setOauthBusy(providerId);
    try {
      await signIn(providerId, { callbackURL: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
      setOauthBusy(null);
    }
  };

  return (
    <main className="app-shell mx-auto flex min-h-0 w-full max-w-md flex-col px-5 pb-10 pt-4">
      <Link
        to="/"
        className="mb-8 inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-bg-elevated text-fg transition-colors hover:bg-bg-subtle"
        aria-label="Back"
      >
        <ArrowLeft className="size-5" strokeWidth={1.75} />
      </Link>

      <div className="flex flex-1 flex-col">
        <p className="mb-2 text-sm font-medium tracking-wide text-fg-subtle uppercase">
          Upset City
        </p>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-fg">
          {mode === "signin" ? "Sign in" : "Create account"}
        </h1>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-fg-muted">
          Google, X, or email + password. Your account saves favorites and
          unlocks the competition scene.
        </p>

        <div className="mt-8 space-y-3">
          {authEnabled ? (
            GROK_PROVIDERS.map((p) => (
              <button
                key={p.providerId}
                type="button"
                disabled={!!oauthBusy}
                onClick={() => void onOAuth(p.providerId)}
                className="flex h-12 w-full items-center justify-center rounded-xl border border-border-strong bg-bg-elevated text-sm font-semibold text-fg transition-colors hover:bg-bg-subtle active:scale-[0.98] disabled:opacity-60"
              >
                {oauthBusy === p.providerId
                  ? "Opening…"
                  : `Continue with ${p.label}`}
              </button>
            ))
          ) : (
            <p className="text-sm text-fg-muted">Sign-in is disabled.</p>
          )}
        </div>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-[11px] font-medium text-fg-subtle uppercase">
            or email
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={(e) => void onEmailSubmit(e)} className="space-y-3">
          {mode === "signup" ? (
            <label className="block text-[11px] font-medium text-fg-muted">
              Name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                className="mt-1 h-11 w-full rounded-xl border border-border bg-bg-elevated px-3 text-sm text-fg outline-none focus:border-court"
                placeholder="What should we call you?"
              />
            </label>
          ) : null}
          <label className="block text-[11px] font-medium text-fg-muted">
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="mt-1 h-11 w-full rounded-xl border border-border bg-bg-elevated px-3 text-sm text-fg outline-none focus:border-court"
              placeholder="you@email.com"
            />
          </label>
          <label className="block text-[11px] font-medium text-fg-muted">
            Password
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={
                mode === "signup" ? "new-password" : "current-password"
              }
              className="mt-1 h-11 w-full rounded-xl border border-border bg-bg-elevated px-3 text-sm text-fg outline-none focus:border-court"
              placeholder="At least 8 characters"
            />
          </label>

          {error ? (
            <p className="text-xs font-medium text-danger" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy || !authEnabled}
            className="flex h-12 w-full items-center justify-center rounded-xl bg-court text-sm font-semibold text-white active:scale-[0.98] disabled:opacity-60"
          >
            {busy
              ? "Working…"
              : mode === "signin"
                ? "Sign in with email"
                : "Create account"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-fg-muted">
          {mode === "signin" ? (
            <>
              New here?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("signup");
                  setError(null);
                }}
                className="font-semibold text-court"
              >
                Create an account
              </button>
            </>
          ) : (
            <>
              Already have one?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("signin");
                  setError(null);
                }}
                className="font-semibold text-court"
              >
                Sign in
              </button>
            </>
          )}
        </p>
      </div>
    </main>
  );
}
