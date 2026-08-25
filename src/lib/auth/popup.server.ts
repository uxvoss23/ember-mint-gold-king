import { auth, SESSION_TOKEN_COOKIE } from "./server";

/** Message shape the popup posts to the opener (must match `client.ts`). */
type PopupMessage = {
  source: "grok-auth-popup";
  token: string | null;
  error?: string;
};

const HANDOFF_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  handoffs.set(id, { ...row, at: Date.now() });
  if (handoffs.size > 40) {
    const cutoff = Date.now() - 5 * 60 * 1000;
    for (const [k, v] of handoffs) {
      if (v.at < cutoff) handoffs.delete(k);
    }
  }
}

function takeHandoff(id: string): HandoffRow | null {
  const row = handoffs.get(id) ?? null;
  if (row) handoffs.delete(id);
  return row;
}

/**
 * Handle `GET /auth/popup`. Invoked by the Vite `authPopupPlugin` (dev / live
 * preview). Do not re-export this from a React route file.
 */
export async function handleAuthPopupRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const pollId = parseHandoff(url.searchParams.get("poll"));
  if (pollId) {
    const row = takeHandoff(pollId);
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
  const handoffId = parseHandoff(url.searchParams.get("handoff"));

  if (done) {
    const errored = url.searchParams.has("error");
    const token = errored ? null : readCookie(request, SESSION_TOKEN_COOKIE);
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

  // Stay first-party for the callback so the session cookie lands in THIS popup.
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
      // Forward the preview host so Better Auth derives the correct baseURL /
      // redirect_uri for the dynamic `*.grok-sandbox.com` origin.
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

    // 302 to the broker (which headlessly forwards to Google/X). Forward any
    // Set-Cookie (OAuth state / PKCE) so the callback can complete in this popup.
    const headers = new Headers({ location, "cache-control": "no-store" });
    for (const cookie of apiRes.headers.getSetCookie()) {
      headers.append("set-cookie", cookie);
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

/** Minimal HTML: postMessage the token to the opener and close. No React. */
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
  .hint{display:none;margin-top:12px;color:#f4f4f5;font-weight:600}
</style>
</head>
<body>
<main>
  <p id="status">${ok ? "Signed in — returning to Upset City…" : "Sign-in didn’t finish."}</p>
  <p class="hint" id="hint">You can close this window and go back to the app.</p>
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
  try { window.close(); } catch (e) {}
  setTimeout(function () {
    var hint = document.getElementById("hint");
    if (hint) hint.style.display = "block";
  }, 600);
})();
</script>
</body>
</html>`;
}

/** Read a single cookie value from the request (handles `=` inside values). */
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
