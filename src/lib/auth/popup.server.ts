/**
 * Live-preview sign-in popup — server-only (NEVER import from the client).
 *
 * Wired by the Vite `authPopupPlugin` in `vite.config.ts`. Do NOT create
 * `src/routes/auth/popup.tsx`.
 *
 * iOS Safari often drops the session cookie on the Google bounce and reports
 * `window.opener` null. We stash the session token against a handoff UUID so
 * the opener can poll `/auth/popup?poll=` even when postMessage cannot run.
 */
import { auth, SESSION_TOKEN_COOKIE } from "./server";

type PopupMessage = {
  source: "grok-auth-popup";
  token: string | null;
  error?: string;
};

const HANDOFF_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const HANDOFF_COOKIE = "__Host-uc-auth-handoff";

type HandoffRow = { token: string | null; error?: string; at: number };
const handoffGlobal = globalThis as typeof globalThis & {
  __ucAuthHandoffs?: Map<string, HandoffRow>;
};
const handoffs = (handoffGlobal.__ucAuthHandoffs ??= new Map<string, HandoffRow>());

function parseHandoff(raw: string | null): string | null {
  const id = raw?.trim() ?? "";
  return HANDOFF_RE.test(id) ? id : null;
}

function putHandoff(id: string, row: Omit<HandoffRow, "at">) {
  const prev = handoffs.get(id);
  if (prev?.token && !row.token) {
    handoffs.set(id, { ...prev, error: row.error ?? prev.error, at: Date.now() });
    return;
  }
  handoffs.set(id, { ...row, at: Date.now() });
  if (handoffs.size > 40) {
    const cutoff = Date.now() - 5 * 60 * 1000;
    for (const [k, v] of handoffs) {
      if (v.at < cutoff) handoffs.delete(k);
    }
  }
}

function peekHandoff(id: string): HandoffRow | null {
  return handoffs.get(id) ?? null;
}

function tokenFromSetCookie(response: Response): string | null {
  const cookies =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [];
  const prefix = `${SESSION_TOKEN_COOKIE}=`;
  for (const c of cookies) {
    const part = (c.split(";")[0] ?? "").trim();
    if (!part.startsWith(prefix)) continue;
    const raw = part.slice(prefix.length);
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return null;
}

/**
 * Capture the session token from Better Auth's callback Set-Cookie before
 * Safari ITP can drop it. Called from `/api/auth/$`.
 */
export function captureOAuthHandoff(request: Request, response: Response) {
  const token = tokenFromSetCookie(response);
  if (!token) return;
  let handoff: string | null = null;
  const loc = response.headers.get("location") ?? "";
  if (loc) {
    try {
      handoff = parseHandoff(new URL(loc, request.url).searchParams.get("handoff"));
    } catch {
      /* ignore */
    }
  }
  if (!handoff) handoff = parseHandoff(readCookie(request, HANDOFF_COOKIE));
  if (!handoff) return;
  putHandoff(handoff, { token });
}

export async function handleAuthPopupRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const pollId = parseHandoff(url.searchParams.get("poll"));
  if (pollId) {
    const row = peekHandoff(pollId);
    if (!row) {
      return new Response(null, {
        status: 204,
        headers: { "cache-control": "no-store" },
      });
    }
    return Response.json(
      { token: row.token, error: row.error ?? null },
      { headers: { "cache-control": "no-store" } },
    );
  }

  const done = url.searchParams.get("done") === "1";
  const handoffId =
    parseHandoff(url.searchParams.get("handoff")) ??
    parseHandoff(readCookie(request, HANDOFF_COOKIE));

  if (done) {
    const errored = url.searchParams.has("error");
    const cookieToken = errored ? null : readCookie(request, SESSION_TOKEN_COOKIE);
    const prior = handoffId ? peekHandoff(handoffId) : null;
    const token = errored ? null : (cookieToken ?? prior?.token ?? null);
    const message: PopupMessage = {
      source: "grok-auth-popup",
      token,
      ...(errored ? { error: url.searchParams.get("error") ?? "sign_in_failed" } : {}),
    };
    if (handoffId) {
      putHandoff(handoffId, { token: message.token, error: message.error });
    }
    return new Response(completionHtml(message), {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  }

  const providerId = url.searchParams.get("providerId")?.trim();
  if (!providerId) {
    return new Response("Missing providerId", {
      status: 400,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  const back = new URL("/auth/popup", url.origin);
  back.searchParams.set("done", "1");
  if (handoffId) back.searchParams.set("handoff", handoffId);
  const errorBack = new URL(back);
  errorBack.searchParams.set("error", "1");
  try {
    const apiRes = await auth.api.signInWithOAuth2({
      body: {
        providerId,
        callbackURL: back.toString(),
        errorCallbackURL: errorBack.toString(),
      },
      headers: request.headers,
      asResponse: true,
    });

    if (!apiRes.ok) {
      const detail = await apiRes.text().catch(() => "");
      const fail: PopupMessage = {
        source: "grok-auth-popup",
        token: null,
        error: detail || `oauth_init_failed_${apiRes.status}`,
      };
      if (handoffId) putHandoff(handoffId, { token: null, error: fail.error });
      return completionResponse(fail);
    }

    const body = (await apiRes.json().catch(() => null)) as {
      url?: string;
    } | null;
    const location = body?.url;
    if (!location) {
      const fail: PopupMessage = {
        source: "grok-auth-popup",
        token: null,
        error: "oauth_init_missing_url",
      };
      if (handoffId) putHandoff(handoffId, { token: null, error: fail.error });
      return completionResponse(fail);
    }

    const headers = new Headers({ location, "cache-control": "no-store" });
    for (const cookie of apiRes.headers.getSetCookie()) {
      headers.append("set-cookie", cookie);
    }
    if (handoffId) {
      headers.append(
        "set-cookie",
        `${HANDOFF_COOKIE}=${handoffId}; Path=/; Secure; SameSite=Lax; Max-Age=600; HttpOnly`,
      );
    }
    return new Response(null, { status: 302, headers });
  } catch (err) {
    const message = err instanceof Error ? err.message : "oauth_init_threw";
    const fail: PopupMessage = {
      source: "grok-auth-popup",
      token: null,
      error: message,
    };
    if (handoffId) putHandoff(handoffId, { token: null, error: fail.error });
    return completionResponse(fail);
  }
}

function completionResponse(message: PopupMessage): Response {
  return new Response(completionHtml(message), {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function completionHtml(message: PopupMessage): string {
  const payload = JSON.stringify(message).replace(/</g, "\\u003c");
  const ok = Boolean(message.token);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${ok ? "Signed in" : "Sign-in"}</title>
<style>
  html,body{margin:0;min-height:100%;background:#0b0b0c;color:#a1a1aa;
    font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
  main{min-height:100dvh;display:grid;place-items:center;padding:1.5rem;text-align:center}
  p{margin:0}
  .hint{margin-top:12px;color:#f4f4f5;font-weight:600}
</style>
</head>
<body>
<main>
  <p id="status">${ok ? "Signed in — returning to Upset City…" : "Sign-in didn’t finish."}</p>
  <p class="hint" id="hint">${ok ? "You can close this window and go back to the app." : "Close this window and try again, or use email."}</p>
</main>
<script type="application/json" id="grok-auth-popup-msg">${payload}</script>
<script>
(function () {
  var el = document.getElementById("grok-auth-popup-msg");
  var msg = { source: "grok-auth-popup", token: null };
  try { if (el && el.textContent) msg = JSON.parse(el.textContent); } catch (e) {}
  try {
    if (window.opener) window.opener.postMessage(msg, window.location.origin);
  } catch (e) {}
  try {
    var bc = new BroadcastChannel("grok-auth-popup");
    bc.postMessage(msg);
    bc.close();
  } catch (e) {}
  try { if (msg.token) window.close(); } catch (e) {}
  setTimeout(function () {
    try { if (msg.token) window.close(); } catch (e) {}
  }, 400);
})();
</script>
</body>
</html>`;
}

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    if (trimmed.slice(0, eq) !== name) continue;
    const raw = trimmed.slice(eq + 1);
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return null;
}
