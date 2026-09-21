import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import {
  GROK_PROVIDERS,
  authClient,
  authEnabled,
  isLikelyIosSafari,
  needsOAuthPopup,
  signIn,
} from "@/lib/auth/client";
import { getAuthProvidersFn, peekAuthMailFn } from "@/lib/auth/status-fn";
import { safeReturnTo } from "@/lib/auth/return-to";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { consumeAuthIntent, peekAuthIntent } from "@/lib/game/guest";
import { authReasonCopy } from "@/lib/game/use-require-auth";

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>): {
    next?: string;
    reason?: string;
    signedout?: boolean;
    verified?: boolean;
  } => ({
    next: typeof s.next === "string" ? safeReturnTo(s.next) : undefined,
    reason: typeof s.reason === "string" ? s.reason : undefined,
    signedout: s.signedout === true || s.signedout === "true" || s.signedout === "1",
    verified: s.verified === true || s.verified === "true" || s.verified === "1",
  }),
  component: Login,
});

type Mode = "signin" | "signup" | "forgot";

function Login() {
  const navigate = useNavigate();
  const { next, reason: searchReason, signedout, verified } = Route.useSearch();
  const reason = searchReason ?? peekAuthIntent()?.action;
  const { user, isPending } = useCurrentUserState();
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [oauthBusy, setOauthBusy] = useState<string | null>(null);
  const [showWindowFallback, setShowWindowFallback] = useState(false);
  const [oauthLive, setOauthLive] = useState(false);
  const [resetEmail, setResetEmail] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [previewResetUrl, setPreviewResetUrl] = useState<string | null>(null);
  const popupEnv = typeof window !== "undefined" && needsOAuthPopup();
  const ios = typeof window !== "undefined" && isLikelyIosSafari();

  const goAfterAuth = () => {
    const intent = consumeAuthIntent();
    const dest = safeReturnTo(intent?.next ?? next ?? "/");
    if (intent?.action === "create") {
      try {
        sessionStorage.setItem("uc-open-create", "1");
      } catch {
        /* ignore */
      }
    }
    void navigate({ to: dest });
  };

  useEffect(() => {
    if (signedout) return;
    if (!isPending && user) goAfterAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPending, user?.id, signedout]);

  useEffect(() => {
    let cancelled = false;
    void getAuthProvidersFn().then((s) => {
      if (!cancelled) {
        setOauthLive(s.oauth);
        setResetEmail(s.resetEmail);
      }
    }).catch(() => {
      if (!cancelled) {
        setOauthLive(false);
        setResetEmail(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

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
        if (!resetEmail) {
          try {
            const peeked = await peekAuthMailFn({
              data: { email: email.trim(), kind: "verify" },
            });
            if (peeked.url) sessionStorage.setItem("uc-verify-url", peeked.url);
          } catch {
            /* preview-only */
          }
        }
      } else {
        const { error: err } = await authClient.signIn.email({
          email: email.trim(),
          password,
        });
        if (err) throw new Error(err.message ?? "Sign-in failed");
      }
      await authClient.getSession();
      goAfterAuth();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const onForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setForgotSent(false);
    setPreviewResetUrl(null);
    setBusy(true);
    try {
      const { error: err } = await authClient.requestPasswordReset({
        email: email.trim(),
        redirectTo: "/reset-password",
      });
      if (err) throw new Error(err.message ?? "Could not send reset email");
      setForgotSent(true);
      if (!resetEmail) {
        const peeked = await peekAuthMailFn({ data: { email: email.trim(), kind: "reset" } });
        setPreviewResetUrl(peeked.url);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send reset email");
    } finally {
      setBusy(false);
    }
  };

  const onOAuth = async (providerId: string, forceRedirect = false) => {
    setError(null);
    setOauthBusy(providerId);
    const giveUp = window.setTimeout(() => {
      setError(
        "Sign-in is taking too long. Try continuing in this window, or use email.",
      );
      setOauthBusy(null);
      setShowWindowFallback(true);
    }, 90_000);
    try {
      await signIn(providerId, {
        callbackURL: safeReturnTo(next ?? "/"),
        errorCallbackURL: "/login",
        forceRedirect,
      });
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      const msg = err instanceof Error ? err.message : "Sign-in failed";
      setShowWindowFallback(true);
      setError(
        code === "popup_blocked"
          ? "Pop-up was blocked. Continue in this window, or sign in with email."
          : msg,
      );
    } finally {
      window.clearTimeout(giveUp);
      setOauthBusy(null);
    }
  };

  return (
    <main className="app-shell mx-auto flex min-h-0 w-full max-w-md flex-col overflow-y-auto px-5 pb-10 pt-4">
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
          {mode === "signin"
            ? "Sign in"
            : mode === "signup"
              ? "Create account"
              : "Reset password"}
        </h1>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-fg-muted">
          {mode === "forgot"
            ? resetEmail
              ? "We’ll email a link to choose a new password. The link expires in one hour."
              : "Password reset isn’t configured on this server yet. Use Google/X, or contact Upset City."
            : reason
              ? authReasonCopy(reason)
              : oauthLive
                ? "Google, X, or email + password. An account is required to post games, chat, and confirm scores."
                : "Use email and password. An account is required to post games, chat, and confirm scores."}
        </p>

        {verified ? (
          <p className="mt-4 rounded-xl border border-court/30 bg-court/10 px-3 py-2 text-[13px] font-medium text-fg">
            Email verified. You can sign in.
          </p>
        ) : null}

        {mode === "forgot" ? null : authEnabled && oauthLive ? (
        <div className="mt-8 space-y-3">
          {GROK_PROVIDERS.map((p) => (
              <button
                key={p.providerId}
                type="button"
                disabled={!!oauthBusy}
                onClick={() => void onOAuth(p.providerId)}
                className="flex h-12 w-full items-center justify-center rounded-xl border border-border-strong bg-bg-elevated text-sm font-semibold text-fg transition-colors hover:bg-bg-subtle active:scale-[0.98] disabled:opacity-60"
              >
                {oauthBusy === p.providerId
                  ? `Waiting for ${p.label}…`
                  : `Continue with ${p.label}`}
              </button>
            ))}
        </div>
        ) : authEnabled ? (
          <p className="mt-8 text-sm text-fg-muted">
            Google and X sign-in aren’t configured on this server. Use email below.
          </p>
        ) : (
          <p className="mt-8 text-sm text-fg-muted">Sign-in is disabled.</p>
        )}

        {mode !== "forgot" && oauthLive && (showWindowFallback || (popupEnv && ios)) ? (
          <div className="mt-3 space-y-2">
            <button
              type="button"
              disabled={!!oauthBusy}
              onClick={() => void onOAuth(GROK_PROVIDERS[0]?.providerId ?? "google", true)}
              className="flex h-11 w-full items-center justify-center rounded-xl border border-border bg-bg-subtle text-[13px] font-semibold text-fg disabled:opacity-60"
            >
              Continue sign-in in this window
            </button>
            {popupEnv ? (
              <p className="text-[11px] leading-relaxed text-fg-muted">
                Preview sign-in uses a pop-up. If it stalls on iPhone, use the
                button above, or open Upset City in Safari (not inside this
                preview) and sign in there.
              </p>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <p className="mt-3 text-xs font-medium text-danger" role="alert">
            {error}
          </p>
        ) : null}

        {mode !== "forgot" ? (
        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-[11px] font-medium text-fg-subtle uppercase">
            or email
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>
        ) : <div className="mt-6" />}

        {mode === "forgot" ? (
          <form onSubmit={(e) => void onForgotSubmit(e)} className="space-y-3">
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
            {forgotSent ? (
              <div className="space-y-2 rounded-xl border border-court/30 bg-court/10 px-3 py-2">
                <p className="text-[13px] font-medium text-fg">
                  {resetEmail
                    ? "If that email is in Upset City, check it for a reset link."
                    : previewResetUrl
                      ? "Email sending isn’t configured on this preview. Use the reset link below."
                      : "If that email is in Upset City, a reset was created. Email sending isn’t configured here, so check this screen again in a moment."}
                </p>
                {previewResetUrl ? (
                  <a
                    href={previewResetUrl}
                    className="inline-flex h-10 items-center justify-center rounded-full bg-court px-4 text-[12px] font-semibold text-white"
                  >
                    Choose a new password
                  </a>
                ) : null}
              </div>
            ) : null}
            <button
              type="submit"
              disabled={busy || !authEnabled}
              className="flex h-12 w-full items-center justify-center rounded-xl bg-court text-sm font-semibold text-white active:scale-[0.98] disabled:opacity-60"
            >
              {busy ? "Sending…" : "Send reset link"}
            </button>
          </form>
        ) : (
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
          {mode === "signin" ? (
            <button
              type="button"
              onClick={() => {
                setMode("forgot");
                setError(null);
                setForgotSent(false);
              }}
              className="text-[12px] font-semibold text-court"
            >
              Forgot password?
            </button>
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
        )}

        {mode === "signup" ? (
          <p className="mt-4 text-center text-[11px] leading-relaxed text-fg-subtle">
            By creating an account you agree to the{" "}
            <Link to="/terms" className="font-semibold text-fg">
              Terms
            </Link>
            ,{" "}
            <Link to="/privacy" className="font-semibold text-fg">
              Privacy Policy
            </Link>
            , and{" "}
            <Link to="/safety" className="font-semibold text-fg">
              Community Guidelines
            </Link>
            . Players must be 17+.
          </p>
        ) : null}

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
              {mode === "forgot" ? "Remember it?" : "Already have one?"}{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("signin");
                  setError(null);
                  setForgotSent(false);
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
