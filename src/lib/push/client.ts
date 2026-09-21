import { getPushPublicKeyFn, savePushSubscriptionFn } from "./fns";

const ASKED_KEY = "uc-push-asked";

function urlBase64ToUint8Array(base64: string): BufferSource {
  const _padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob(base64.replace(/-/g, "+").replace(/_/g, "/") + _padding);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

export async function enablePushNotifications(): Promise<"granted" | "denied" | "unsupported"> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    return "unsupported";
  }
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return perm === "denied" ? "denied" : "denied";
  const { publicKey } = await getPushPublicKeyFn();
  if (!publicKey) return "unsupported";
  const reg = await navigator.serviceWorker.register("/uc-push-sw.js");
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    }));
  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return "unsupported";
  await savePushSubscriptionFn({
    data: {
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    },
  });
  return "granted";
}

/** After the user creates or joins a game — not on first paint. */
export function maybeAskPushAfterGame() {
  if (typeof window === "undefined") return;
  try {
    if (sessionStorage.getItem(ASKED_KEY) === "1") return;
    sessionStorage.setItem(ASKED_KEY, "1");
  } catch {
    return;
  }
  if (!window.confirm("Turn on notifications so you know when someone joins or messages you?")) {
    return;
  }
  void enablePushNotifications();
}
