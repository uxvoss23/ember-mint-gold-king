import { useCallback, useEffect, useState } from "react";
import { isDemoMode } from "@/lib/config";
import { ensureMyPlayer, loadCompetitiveSnapshot } from "@/lib/game/fns";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { applyServerSnapshot, useUpsetStore } from "@/lib/upset/store";

export function useCompetitiveSync() {
  const { user, isPending } = useCurrentUserState();
  const store = useUpsetStore();
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    isDemoMode() ? "ready" : "loading",
  );
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (isDemoMode()) {
      setStatus("ready");
      return;
    }
    setStatus("loading");
    try {
      const snap = await loadCompetitiveSnapshot();
      applyServerSnapshot(snap);
      setError(null);
      setStatus("ready");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Couldn’t load games.");
    }
  }, []);

  useEffect(() => {
    if (isPending) return;
    if (isDemoMode()) {
      if (user) store.syncAuthIdentity(user);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        if (user) {
          await ensureMyPlayer({
            data: {
              name: user.displayName ?? undefined,
              image: user.profileImageUrl ?? undefined,
            },
          });
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

  return { status, error, refresh, demo: isDemoMode() };
}