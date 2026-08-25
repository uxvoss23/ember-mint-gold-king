import { isDemoMode } from "@/lib/config";
import { loadCompetitiveSnapshot } from "@/lib/game/fns";
import { applyServerSnapshot } from "@/lib/upset/store";

export async function refreshCompetitiveSnapshot() {
  if (isDemoMode()) return;
  const snap = await loadCompetitiveSnapshot();
  applyServerSnapshot(snap);
}

export function mutationError(err: unknown): string {
  if (err instanceof Error) {
    if (err.message === "Unauthorized") return "Sign in to continue.";
    return err.message;
  }
  return "Something went wrong. Try again.";
}
