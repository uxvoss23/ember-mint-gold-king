import { useEffect, useState } from "react";
import {
  dismissReportFn,
  listModerationQueueFn,
  setPlayerDisciplineFn,
  voidGameFn,
} from "@/lib/game/moderation";
import { mutationError } from "@/lib/game/client-actions";

export function ModerationQueue() {
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<Awaited<ReturnType<typeof listModerationQueueFn>> | null>(
    null,
  );

  const load = async () => {
    setErr(null);
    try {
      setData(await listModerationQueueFn());
    } catch (e) {
      setData(null);
      setErr(mutationError(e));
    }
  };

  useEffect(() => {
    void load();
  }, []);

  if (err && !data) {
    return null;
  }

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      await load();
    } catch (e) {
      setErr(mutationError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-bg-elevated p-3.5">
      <p className="text-[10px] font-bold tracking-wide text-fg-subtle uppercase">
        Moderation
      </p>
      {err ? <p className="mt-2 text-[11px] text-danger">{err}</p> : null}
      <div className="mt-2 space-y-2">
        <p className="text-[11px] font-semibold text-fg">Open disputes</p>
        {(data?.disputes ?? []).length === 0 ? (
          <p className="text-[12px] text-fg-muted">None.</p>
        ) : (
          (data?.disputes ?? []).map((d) => (
            <div key={d.id} className="rounded-xl border border-border bg-bg px-3 py-2">
              <p className="text-[12px] font-semibold text-fg">{d.court_name}</p>
              <p className="text-[11px] text-fg-muted">{d.reason ?? "Score dispute"}</p>
              <button
                type="button"
                disabled={busy}
                onClick={() => void run(() => voidGameFn({ data: { gameId: d.game_id } }))}
                className="mt-2 text-[11px] font-semibold text-danger"
              >
                Void game (no rating)
              </button>
            </div>
          ))
        )}
        <p className="pt-1 text-[11px] font-semibold text-fg">Open reports</p>
        {(data?.reports ?? []).length === 0 ? (
          <p className="text-[12px] text-fg-muted">None.</p>
        ) : (
          (data?.reports ?? []).map((r) => (
            <div key={r.id} className="rounded-xl border border-border bg-bg px-3 py-2">
              <p className="text-[12px] text-fg">{r.reason}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void run(() => dismissReportFn({ data: { reportId: r.id } }))}
                  className="text-[11px] font-semibold text-fg-muted"
                >
                  Dismiss
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void run(() =>
                      setPlayerDisciplineFn({
                        data: { playerId: r.target_id, action: "warn", note: r.reason },
                      }),
                    )
                  }
                  className="text-[11px] font-semibold text-court"
                >
                  Warn
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
