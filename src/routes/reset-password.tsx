import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { authClient } from "@/lib/auth/client";

export const Route = createFileRoute("/reset-password")({
  validateSearch: (s: Record<string, unknown>): { token?: string; error?: string } => ({
    token: typeof s.token === "string" ? s.token : undefined,
    error: typeof s.error === "string" ? s.error : undefined,
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const { token, error: searchError } = Route.useSearch();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    searchError === "INVALID_TOKEN" ? "This reset link is invalid or expired." : null,
  );

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!token) {
      setError("This reset link is missing a token. Request a new one.");
      return;
    }
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don’t match.");
      return;
    }
    setBusy(true);
    try {
      const { error: err } = await authClient.resetPassword({
        newPassword: password,
        token,
      });
      if (err) throw new Error(err.message ?? "Could not reset password");
      await navigate({ to: "/login" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset password");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="app-shell mx-auto flex min-h-0 w-full max-w-md flex-col overflow-y-auto px-5 pb-10 pt-4">
      <Link
        to="/login"
        className="mb-8 inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-bg-elevated text-fg"
        aria-label="Back to sign in"
      >
        <ArrowLeft className="size-5" strokeWidth={1.75} />
      </Link>
      <p className="mb-2 text-sm font-medium tracking-wide text-fg-subtle uppercase">
        Upset City
      </p>
      <h1 className="font-display text-3xl font-semibold tracking-tight text-fg">
        New password
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-fg-muted">
        Choose a new password for your account. Then sign in.
      </p>
      {error ? (
        <p className="mt-4 text-xs font-medium text-danger" role="alert">
          {error}
        </p>
      ) : null}
      <form onSubmit={(e) => void onSubmit(e)} className="mt-6 space-y-3">
        <label className="block text-[11px] font-medium text-fg-muted">
          New password
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            className="mt-1 h-11 w-full rounded-xl border border-border bg-bg-elevated px-3 text-sm text-fg outline-none focus:border-court"
            placeholder="At least 8 characters"
          />
        </label>
        <label className="block text-[11px] font-medium text-fg-muted">
          Confirm password
          <input
            type="password"
            required
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            className="mt-1 h-11 w-full rounded-xl border border-border bg-bg-elevated px-3 text-sm text-fg outline-none focus:border-court"
          />
        </label>
        <button
          type="submit"
          disabled={busy || !token}
          className="flex h-12 w-full items-center justify-center rounded-xl bg-court text-sm font-semibold text-white active:scale-[0.98] disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save password"}
        </button>
      </form>
      <p className="mt-5 text-center text-sm text-fg-muted">
        <Link to="/login" className="font-semibold text-court">
          Back to sign in
        </Link>
      </p>
    </main>
  );
}
