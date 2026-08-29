import { isDemoMode } from "@/lib/config";
import { loadCompetitiveSnapshot } from "@/lib/game/fns";
import { applyServerSnapshot } from "@/lib/upset/store";

export async function refreshCompetitiveSnapshot() {
  if (isDemoMode()) return;
  const snap = await loadCompetitiveSnapshot();
  applyServerSnapshot(snap);
}

/** Fire-and-forget so a mutation doesn’t hold the UI on a full reload. */
export function refreshCompetitiveSnapshotSoon() {
  void refreshCompetitiveSnapshot().catch(() => {
    /* next sync pass will recover */
  });
}

export function mutationError(err: unknown): string {
  if (err instanceof Error) {
    if (err.message === "Unauthorized") return "Sign in to continue.";
    return err.message;
  }
  return "Something went wrong. Try again.";
}
