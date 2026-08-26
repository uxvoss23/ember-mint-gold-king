import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth/server";
import { captureOAuthHandoff } from "@/lib/auth/popup.server";

async function handle(request: Request) {
  const response = await auth.handler(request);
  try {
    captureOAuthHandoff(request, response);
  } catch {
    /* handoff is best-effort */
  }
  return response;
}

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => handle(request),
      POST: ({ request }) => handle(request),
    },
  },
});
