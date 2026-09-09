import { useCallback, useEffect, useRef, useState } from "react";
import { isDemoMode } from "@/lib/config";
import { ensureMyPlayer, loadCompetitiveSnapshot } from "@/lib/game/fns";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  adoptAuthenticatedPlayer,
  applyServerSnapshot,
  clearAuthenticatedPlayer,
  useUpsetStore,
} from "@/lib/upset/store";

let liveFast = 0;
let inFlight: Promise<void> | null = null;
let queued = false;

/** Chat / invite review wants quicker polls. Nested callers stack. */
export function setLiveSyncFast(on: boolean) {
  liveFast += on ? 1 : -1;
  if (liveFast < 0) liveFast = 0;
}

export function useCompetitiveSync() {
  const { user, isPending } = useCurrentUserState();
  const store = useUpsetStore();
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    isDemoMode() ? "ready" : "loading",
  );
  const [error, setError] = useState<string | null>(null);
  const readyOnce = useRef(isDemoMode());
  const lastUserId = useRef<string | null | undefined>(undefined);

  const refresh = useCallback(async () => {
    if (isDemoMode()) {
      setStatus("ready");
      return;
    }
    if (inFlight) {
      queued = true;
      await inFlight;
      return;
    }
    if (!readyOnce.current) setStatus("loading");
    const run = (async () => {
      try {
        const snap = await loadCompetitiveSnapshot();
        applyServerSnapshot(snap);
        setError(null);
        readyOnce.current = true;
        setStatus("ready");
      } catch (err) {
        if (!readyOnce.current) {
          setStatus("error");
          setError(err instanceof Error ? err.message : "Couldn’t load games.");
        }
      } finally {
        inFlight = null;
        if (queued) {
          queued = false;
          await refresh();
        }
      }
    })();
    inFlight = run;
    await run;
  }, []);

  useEffect(() => {
    if (isPending) return;
    if (isDemoMode()) {
      if (user) store.syncAuthIdentity(user);
      return;
    }
    const userId = user?.id ?? null;
    if (lastUserId.current !== undefined && lastUserId.current !== userId && !userId) {
      clearAuthenticatedPlayer();
    }
    lastUserId.current = userId;
    let cancelled = false;
    void (async () => {
      try {
        if (user) {
          const player = await ensureMyPlayer({
            data: {
              name: user.displayName ?? undefined,
              image: user.profileImageUrl ?? undefined,
            },
          });
          if (!cancelled) adoptAuthenticatedPlayer(player);
        }
        if (!cancelled) await refresh();
      } catch (err) {
        if (cancelled) return;
        setStatus("error");
        setError(err instanceof Error ? err.message : "Couldn’t load your profile.");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPending, user?.id, refresh]);

  useEffect(() => {
    if (isDemoMode() || isPending || !user) return;
    let timer: number | null = null;
    const arm = () => {
      if (timer) window.clearTimeout(timer);
      const wait = liveFast > 0 ? 1800 : 3500;
      timer = window.setTimeout(() => {
        if (!document.hidden) void refresh();
        arm();
      }, wait);
    };
    arm();
    const onVis = () => {
      if (!document.hidden) void refresh();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      if (timer) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [isPending, refresh, user?.id]);

  return { status, error, refresh, demo: isDemoMode() };
}
