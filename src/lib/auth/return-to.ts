/**
 * Same-origin internal destinations only. Rejects protocol-relative URLs,
 * other origins, and control characters. Never used for tokens.
 */
export function safeReturnTo(raw: unknown, fallback = "/"): string {
  if (typeof raw !== "string") return fallback;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/")) return fallback;
  if (trimmed.startsWith("//")) return fallback;
  if (trimmed.includes("\\")) return fallback;
  for (let i = 0; i < trimmed.length; i += 1) {
    const code = trimmed.charCodeAt(i);
    if (code < 32 || code === 127) return fallback;
  }
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) return fallback;
  if (trimmed.length > 400) return fallback;
  return trimmed;
}

export function isLivePreviewHost(hostname: string): boolean {
  return hostname.endsWith(".grok-sandbox.com");
}

export function inIframe(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

/** Popup OAuth is required in the partitioned preview iframe. */
export function needsOAuthPopup(): boolean {
  if (typeof window === "undefined") return false;
  return isLivePreviewHost(window.location.hostname) || inIframe();
}

export function isLikelyIosSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const iOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (!iOS) return false;
  const webkit = /WebKit/i.test(ua);
  const other = /CriOS|FxiOS|EdgiOS|OPiOS|Chrome|Android/i.test(ua);
  return webkit && !other;
}
