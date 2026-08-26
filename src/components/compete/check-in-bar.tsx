import { useState } from "react";
import { canCheckIn, canReportNoShow } from "@/lib/game/checkin";
import { mutationError, refreshCompetitiveSnapshot } from "@/lib/game/client-actions";
import { checkInFn, contestNoShowFn, reportNoShowFn } from "@/lib/game/fns";
import type { Match } from "@/lib/upset/types";

export function CheckInBar({ match, meId }: { match: Match; meId: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const tip = new Date(match.scheduledAt ?? match.preferredAt).getTime();
  const now = Date.now();
  const party = meId === match.hostId || meId === match.opponentId;
  if (!party || !match.opponentId) return null;

  const check = canCheckIn({
    hostId: match.hostId,
    opponentId: match.opponentId,
    actorId: meId,
    status: match.status,
    tipMs: tip,
    nowMs: now,
  });
  const noshow = canReportNoShow({
    hostId: match.hostId,
    opponentId: match.opponentId,
    actorId: meId,
    actorCheckedIn: true,
    status: match.status,
    tipMs: tip,
    nowMs: now,
  });
  if (!check.ok && !noshow.ok) return null;

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      await refreshCompetitiveSnapshot();
    } catch (e) {
      setErr(mutationError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-bg-elevated px-3 py-3">
      <p className="text-[10px] font-bold tracking-wide text-fg-subtle uppercase">
        At the court
      </p>
      {check.ok ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void run(() => checkInFn({ data: { gameId: match.id } }))}
          className="mt-2 h-10 w-full rounded-xl bg-court text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Saving…" : "I’m here"}
        </button>
      ) : null}
      {noshow.ok ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void run(() => reportNoShowFn({ data: { gameId: match.id } }))}
          className="mt-2 h-10 w-full rounded-xl border border-border text-sm font-semibold text-fg disabled:opacity-50"
        >
          Opponent didn’t show
        </button>
      ) : null}
      <button
        type="button"
        disabled={busy}
        onClick={() => void run(() => contestNoShowFn({ data: { gameId: match.id } }))}
        className="mt-1 w-full text-[11px] font-semibold text-fg-muted"
      >
        Contest a no-show against me
      </button>
      <p className="mt-1 text-[11px] text-fg-muted">
        Location is optional. A no-show never changes ratings by itself.
      </p>
      {err ? <p className="mt-1 text-[11px] text-danger">{err}</p> : null}
    </div>
  );
}
