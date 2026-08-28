import { createFileRoute } from "@tanstack/react-router";
import { auth, SESSION_TOKEN_COOKIE } from "@/lib/auth/server";
import { captureOAuthHandoff } from "@/lib/auth/popup.server";

const EXPIRE =
  "Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure; HttpOnly; SameSite=Lax";

function expireSessionCookies(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const name of [
    SESSION_TOKEN_COOKIE,
    "__Host-grok-auth.session_data",
    "__Host-grok-auth.account_data",
    "__Host-grok-auth.dont_remember",
  ]) {
    headers.append("Set-Cookie", `${name}=; ${EXPIRE}`);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function handle(request: Request) {
  const url = new URL(request.url);
  const signingOut =
    request.method === "POST" && /\/sign-out\/?$/.test(url.pathname);

  const response = await auth.handler(request);
  try {
    captureOAuthHandoff(request, response);
  } catch {
    /* handoff is best-effort */
  }
  return signingOut ? expireSessionCookies(response) : response;
}

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => handle(request),
      POST: ({ request }) => handle(request),
    },
  },
});
