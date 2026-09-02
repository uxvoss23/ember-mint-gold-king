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
    const parsed = parseZodMessage(err.message);
    if (parsed) return parsed;
    return err.message;
  }
  return "Something went wrong. Try again.";
}

function parseZodMessage(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("[")) {
    if (/too_big|280000/.test(trimmed)) {
      return "That photo is too large. Try a smaller one.";
    }
    return null;
  }
  try {
    const issues = JSON.parse(trimmed) as Array<{
      code?: string;
      path?: unknown[];
      message?: string;
    }>;
    if (!Array.isArray(issues) || !issues.length) return null;
    const photo = issues.some((i) =>
      (i.path ?? []).some((p) => String(p).toLowerCase().includes("photo")),
    );
    if (photo || issues.some((i) => i.code === "too_big")) {
      return "Those photos are too large. Try one or two smaller shots.";
    }
    return issues[0]?.message ?? "Something looks off. Try again.";
  } catch {
    return null;
  }
}
