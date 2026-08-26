import { genericOAuthClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { GROK_PROVIDERS } from "./providers";
import { needsOAuthPopup, safeReturnTo } from "./return-to";

export { needsOAuthPopup, isLikelyIosSafari } from "./return-to";

/**
 * Better Auth client for this React SPA (browser-side).
 *
 * Talks to this app's OWN Better Auth at same-origin `/api/auth/*`. In the live
 * preview the app is an embedded iframe with PARTITIONED cookies, so after a
 * popup sign-in it can't read the session cookie — it authenticates with a
 * bearer token instead (captured from the popup, see `signIn`). The `onRequest`
 * hook attaches that token when present; when deployed (cookie auth) no token
 * is stored, so nothing changes.
 */
export const authClient = createAuthClient({
  plugins: [genericOAuthClient()],
  fetchOptions: {
    onRequest(ctx) {
      const token = getBearerToken();
      if (token) ctx.headers.set("Authorization", `Bearer ${token}`);
      return ctx;
    },
  },
});

/**
 * True when sign-in UI should be shown. On by default (preview via the baked
 * preview client, deployed apps via the injected per-app client); set
 * `VITE_AUTH_ENABLED=false` to force it off (dev user — see `use-current-user`).
 */
export const authEnabled = import.meta.env.VITE_AUTH_ENABLED !== "false";

/** The upstream providers to render sign-in buttons for. */
export { GROK_PROVIDERS };

const BEARER_KEY = "grok-auth.bearer-token";

/** The stored preview bearer token, or null. */
export function getBearerToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(BEARER_KEY);
  } catch {
    return null;
  }
}

function setBearerToken(token: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (token) window.sessionStorage.setItem(BEARER_KEY, token);
    else window.sessionStorage.removeItem(BEARER_KEY);
  } catch {
    /* storage unavailable — ignore */
  }
}

/** Message the popup posts back to the opener once sign-in completes. */
type PopupMessage = { source: "grok-auth-popup"; token: string | null; error?: string };

function newHandoffId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export type SignInOpts = {
  callbackURL?: string;
  errorCallbackURL?: string;
  /** Skip popup even in the preview iframe (Safari fallback). */
  forceRedirect?: boolean;
};

/**
 * Start sign-in with one upstream provider.
 *
 * - Live preview iframe: popup + same-origin handoff poll (partitioned cookies).
 * - Standalone (including iPhone Safari): full-page OAuth redirect.
 * - `forceRedirect`: always full-page, for “Continue in this window”.
 */
export async function signIn(providerId: string, opts: SignInOpts = {}): Promise<void> {
  const callbackURL = safeReturnTo(opts.callbackURL ?? "/");
  const errorCallbackURL = safeReturnTo(opts.errorCallbackURL ?? "/login");
  const usePopup = !opts.forceRedirect && needsOAuthPopup();
  const handoffId = newHandoffId();

  const popup = usePopup ? openSignInPopup(providerId, handoffId) : null;

  const hadBearer = Boolean(getBearerToken());
  if (hadBearer || !needsOAuthPopup()) {
    try {
      await authClient.signOut();
    } catch {
      /* proceed */
    }
  }
  setBearerToken(null);

  if (usePopup) {
    if (!popup) {
      const err = new Error("Pop-up blocked — allow pop-ups, or continue in this window.");
      (err as Error & { code?: string }).code = "popup_blocked";
      throw err;
    }
    const token = await waitForPopupToken(popup, handoffId);
    if (!token) {
      const err = new Error("Sign-in was cancelled or didn’t finish.");
      (err as Error & { code?: string }).code = "popup_failed";
      throw err;
    }
    setBearerToken(token);
    try {
      await authClient.getSession();
    } catch {
      /* session store will recover */
    }
    if (typeof window !== "undefined") {
      const dest = new URL(callbackURL, window.location.origin);
      const here = window.location;
      if (dest.origin !== here.origin || dest.pathname !== here.pathname || dest.search !== here.search) {
        window.location.href = callbackURL;
      }
    }
    return;
  }

  const { data, error } = await authClient.signIn.oauth2({
    providerId,
    callbackURL,
    errorCallbackURL,
  });
  if (error) throw new Error(error.message ?? "Sign-in failed");
  if (data?.url) window.location.assign(data.url);
}

function openSignInPopup(providerId: string, handoffId: string): Window | null {
  const origin = window.location.origin;
  const url = `${origin}/auth/popup?providerId=${encodeURIComponent(providerId)}&handoff=${encodeURIComponent(handoffId)}`;
  const name = `grok-signin-${Date.now()}`;
  return window.open(url, name, "popup,width=500,height=700,scrollbars=yes");
}

function waitForPopupToken(popup: Window, handoffId: string): Promise<string | null> {
  return new Promise((resolve) => {
    const origin = window.location.origin;
    let settled = false;
    let bc: BroadcastChannel | null = null;
    const settle = (token: string | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(token);
    };
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== origin) return;
      const data = event.data as PopupMessage | undefined;
      if (!data || data.source !== "grok-auth-popup") return;
      if (data.token) settle(data.token);
      else if (data.error) settle(null);
    };
    const pollHandoff = async () => {
      try {
        const res = await fetch(
          `${origin}/auth/popup?poll=${encodeURIComponent(handoffId)}`,
          { cache: "no-store" },
        );
        if (res.status === 204 || !res.ok) return;
        const data = (await res.json()) as { token?: string | null; error?: string | null };
        if (data.token) settle(data.token);
        else if (data.error) settle(null);
      } catch {
        /* keep waiting */
      }
    };
    // iOS often reports popup.closed immediately while Google continues in
    // another tab — do not abort; keep polling until timeout.
    const pollTimer = window.setInterval(() => {
      void pollHandoff();
    }, 400);
    void pollHandoff();
    const timeoutTimer = window.setTimeout(() => settle(null), 120_000);
    try {
      bc = new BroadcastChannel("grok-auth-popup");
      bc.onmessage = (event) => {
        const data = event.data as PopupMessage | undefined;
        if (!data || data.source !== "grok-auth-popup") return;
        if (data.token) settle(data.token);
        else if (data.error) settle(null);
      };
    } catch {
      bc = null;
    }
    function cleanup() {
      window.clearInterval(pollTimer);
      window.clearTimeout(timeoutTimer);
      window.removeEventListener("message", onMessage);
      try {
        bc?.close();
      } catch {
        /* ignore */
      }
    }
    window.addEventListener("message", onMessage);
  });
}

/** Sign out of THIS app's local session, clear the preview token, then redirect. */
export async function signOut(redirectTo = "/"): Promise<void> {
  try {
    await authClient.signOut();
  } finally {
    setBearerToken(null);
  }
  window.location.href = safeReturnTo(redirectTo);
}
