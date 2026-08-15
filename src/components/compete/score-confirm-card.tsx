import { useEffect, useState } from "react";
import type { Match, MatchGame, Player } from "@/lib/upset/types";
import { cn } from "@/lib/utils";

/**
 * Dual-confirm scores — rating only locks after opponent confirms.
 * Blank until someone enters; opponent sees preloaded scores for review.
 */
export function ScoreConfirmCard({
  match,
  me,
  host,
  opp,
  onEnterScore,
  onConfirm,
  onDispute,
}: {
  match: Match;
  me: Player;
  host?: Player | null;
  opp?: Player | null;
  onEnterScore: (scores: MatchGame[]) => void;
  onConfirm: () => void;
  onDispute: () => void;
}) {
  const isParty =
    me.id === match.hostId || me.id === match.opponentId;
  /** Empty strings = blank fields until user types (or scores are preloaded) */
  const [g1a, setG1a] = useState("");
  const [g1b, setG1b] = useState("");
  const [g2a, setG2a] = useState("");
  const [g2b, setG2b] = useState("");
  const [g3a, setG3a] = useState("");
  const [g3b, setG3b] = useState("");
  const [useG3, setUseG3] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  /** Prefill only when scores already exist (review / edit / dispute) */
  useEffect(() => {
    const s = match.scores;
    if (!s?.length) {
      setG1a("");
      setG1b("");
      setG2a("");
      setG2b("");
      setG3a("");
      setG3b("");
      setUseG3(false);
      return;
    }
    setG1a(String(s[0]?.a ?? ""));
    setG1b(String(s[0]?.b ?? ""));
    setG2a(String(s[1]?.a ?? ""));
    setG2b(String(s[1]?.b ?? ""));
    if (s[2]) {
      setUseG3(true);
      setG3a(String(s[2].a));
      setG3b(String(s[2].b));
    } else {
      setUseG3(false);
      setG3a("");
      setG3b("");
    }
  }, [match.id, match.status, match.scores]);

  if (!isParty || !match.opponentId) return null;

  if (match.status === "confirmed" && match.scores?.length) {
    return (
      <div className="rounded-xl border border-success/25 bg-success/10 px-3 py-2.5">
        <p className="text-xs font-semibold text-success">
          Score locked · dual-confirmed
        </p>
        <p className="mt-0.5 text-[11px] text-fg-muted">
          {match.scores.map((g) => `${g.a}–${g.b}`).join(", ")}
          {match.ratingDeltaHost != null ? ` · ratings updated` : ""}
        </p>
      </div>
    );
  }

  if (match.status === "disputed") {
    // fall through to re-enter form (preloaded)
  } else if (
    match.status === "cancelled" ||
    match.status === "no_show" ||
    match.status === "open"
  ) {
    return null;
  }

  const hostLabel = host?.name?.split(" ")[0] ?? "Host";
  const oppLabel = opp?.name?.split(" ")[0] ?? "Opp";
  const entererName =
    match.scoreEnteredBy === host?.id
      ? host?.name
      : match.scoreEnteredBy === opp?.id
        ? opp?.name
        : "Opponent";

  if (match.status === "played_pending" && match.scores?.length) {
    const iEntered = match.scoreEnteredBy === me.id;
    const games = match.scores;

    return (
      <div className="space-y-2.5 rounded-2xl border border-border bg-bg-elevated p-3">
        <div>
          <p className="text-[10px] font-bold tracking-wide text-fg-subtle uppercase">
            {iEntered ? "Waiting on opponent" : "Review submitted score"}
          </p>
          <p className="mt-0.5 text-[11px] text-fg-muted">
            {iEntered
              ? "They’ll see this preloaded and confirm. Rating doesn’t move until then."
              : `${entererName?.split(" ")[0] ?? "Opponent"} submitted — scores are filled in for you. Confirm if correct.`}
          </p>
        </div>

        <div className="flex items-center gap-2 px-0.5 text-[10px] font-semibold text-fg-subtle">
          <span className="w-14" />
          <span className="flex-1 text-center">{hostLabel}</span>
          <span className="w-3" />
          <span className="flex-1 text-center">{oppLabel}</span>
        </div>

        {games.map((g, i) => (
          <ScoreRow
            key={i}
            label={`Game ${i + 1}`}
            a={String(g.a)}
            b={String(g.b)}
            readOnly
          />
        ))}

        {!iEntered ? (
          <div className="flex gap-2 pt-0.5">
            <button
              type="button"
              onClick={onConfirm}
              className="h-11 flex-1 rounded-xl bg-court text-sm font-semibold text-white"
            >
              Looks right · confirm
            </button>
            <button
              type="button"
              onClick={onDispute}
              className="h-11 flex-1 rounded-xl border border-border text-sm font-semibold text-fg-muted"
            >
              Dispute
            </button>
          </div>
        ) : (
          <p className="rounded-lg bg-bg-subtle px-2.5 py-2 text-center text-[11px] font-medium text-fg-muted">
            Pending their confirm…
          </p>
        )}
      </div>
    );
  }

  const canEnter =
    match.status === "scheduled" ||
    match.status === "matched" ||
    match.status === "disputed";

  if (!canEnter) return null;

  return (
    <div className="space-y-2.5 rounded-2xl border border-border bg-bg-elevated p-3">
      {match.status === "disputed" ? (
        <p className="rounded-lg border border-border bg-bg-subtle px-2.5 py-2 text-[11px] font-medium text-fg-muted">
          Fix the score if you made a mistake, then re-submit for them to confirm.
        </p>
      ) : null}
      <div>
        <p className="text-[10px] font-bold tracking-wide text-fg-subtle uppercase">
          Enter final score
        </p>
        <p className="mt-0.5 text-[11px] text-fg-muted">
          {hostLabel} (left) · {oppLabel} (right). Leave blank until you know the
          result.
        </p>
      </div>
      <div className="flex items-center gap-2 px-0.5 text-[10px] font-semibold text-fg-subtle">
        <span className="w-14" />
        <span className="flex-1 text-center">{hostLabel}</span>
        <span className="w-3" />
        <span className="flex-1 text-center">{oppLabel}</span>
      </div>
      <ScoreRow label="Game 1" a={g1a} b={g1b} setA={setG1a} setB={setG1b} />
      <ScoreRow label="Game 2" a={g2a} b={g2b} setA={setG2a} setB={setG2b} />
      {useG3 ? (
        <ScoreRow label="Game 3" a={g3a} b={g3b} setA={setG3a} setB={setG3b} />
      ) : (
        <button
          type="button"
          onClick={() => setUseG3(true)}
          className="text-[11px] font-semibold text-court"
        >
          + Game 3 (if needed)
        </button>
      )}
      {err ? <p className="text-[11px] text-danger">{err}</p> : null}
      <button
        type="button"
        onClick={() => {
          const parse = (v: string) => {
            if (v.trim() === "") return null;
            const n = Number(v);
            return Number.isFinite(n) ? n : null;
          };
          const p1a = parse(g1a);
          const p1b = parse(g1b);
          const p2a = parse(g2a);
          const p2b = parse(g2b);
          if (
            p1a == null ||
            p1b == null ||
            p2a == null ||
            p2b == null
          ) {
            setErr("Fill in both scores for Game 1 and Game 2.");
            return;
          }
          const scores: MatchGame[] = [
            { a: p1a, b: p1b },
            { a: p2a, b: p2b },
          ];
          if (useG3) {
            const p3a = parse(g3a);
            const p3b = parse(g3b);
            if (p3a == null || p3b == null) {
              setErr("Fill in Game 3 or remove it.");
              return;
            }
            scores.push({ a: p3a, b: p3b });
          }
          const bad = scores.some((g) => g.a === g.b);
          if (bad) {
            setErr("Games can’t be ties — fix scores.");
            return;
          }
          setErr(null);
          onEnterScore(scores);
        }}
        className="h-11 w-full rounded-xl bg-fg text-sm font-semibold text-bg"
      >
        Submit for opponent confirm
      </button>
    </div>
  );
}

function ScoreRow({
  label,
  a,
  b,
  setA,
  setB,
  readOnly,
}: {
  label: string;
  a: string;
  b: string;
  setA?: (n: string) => void;
  setB?: (n: string) => void;
  readOnly?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 text-[11px] font-medium text-fg-muted">{label}</span>
      {readOnly ? (
        <>
          <div className="flex h-10 w-full items-center justify-center rounded-xl border border-border bg-bg-subtle text-sm font-bold tabular-nums text-fg">
            {a}
          </div>
          <span className="text-xs text-fg-subtle">–</span>
          <div className="flex h-10 w-full items-center justify-center rounded-xl border border-border bg-bg-subtle text-sm font-bold tabular-nums text-fg">
            {b}
          </div>
        </>
      ) : (
        <>
          <input
            type="number"
            min={0}
            max={99}
            inputMode="numeric"
            placeholder="—"
            value={a}
            onChange={(e) => setA?.(e.target.value)}
            className={cn(
              "h-10 w-full rounded-xl border border-border bg-bg px-2 text-center text-sm font-semibold tabular-nums placeholder:text-fg-subtle",
            )}
          />
          <span className="text-xs text-fg-subtle">–</span>
          <input
            type="number"
            min={0}
            max={99}
            inputMode="numeric"
            placeholder="—"
            value={b}
            onChange={(e) => setB?.(e.target.value)}
            className="h-10 w-full rounded-xl border border-border bg-bg px-2 text-center text-sm font-semibold tabular-nums placeholder:text-fg-subtle"
          />
        </>
      )}
    </div>
  );
}
