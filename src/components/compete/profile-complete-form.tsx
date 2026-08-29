import { useState } from "react";
import { ETHNICITY_OPTIONS, GENDER_OPTIONS } from "@/lib/upset/browse-filters";
import { completeProfileFn } from "@/lib/game/fns";
import { mutationError, refreshCompetitiveSnapshotSoon } from "@/lib/game/client-actions";
import { upsertPlayer } from "@/lib/upset/store";
import type { Player } from "@/lib/upset/types";
import { cn } from "@/lib/utils";

export function ProfileCompleteForm({
  me,
  onDone,
}: {
  me: Player;
  onDone?: () => void;
}) {
  const [age, setAge] = useState(me.age ? String(me.age) : "");
  const [weightLb, setWeightLb] = useState(me.weightLb ? String(me.weightLb) : "");
  const [gender, setGender] = useState(me.gender ?? "");
  const [ethnicity, setEthnicity] = useState(me.ethnicity ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    setBusy(true);
    try {
      const saved = await completeProfileFn({
        data: {
          age: Number(age),
          weightLb: Number(weightLb),
          gender,
          ethnicity,
        },
      });
      upsertPlayer(saved);
      onDone?.();
      refreshCompetitiveSnapshotSoon();
    } catch (err) {
      setError(mutationError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-fg">Finish your profile</p>
      <p className="text-xs text-fg-muted">
        Age, weight, gender, and ethnicity are required to post or join a 1v1.
        They’re stored on your account — not shown on other players’ cards.
      </p>
      <label className="block">
        <span className="text-[10px] font-bold tracking-wide text-fg-subtle uppercase">Age</span>
        <input
          inputMode="numeric"
          value={age}
          onChange={(e) => setAge(e.target.value.replace(/\D/g, "").slice(0, 2))}
          className="mt-1 h-11 w-full rounded-xl border border-border bg-bg-subtle px-3 text-sm text-fg outline-none"
          placeholder="24"
        />
      </label>
      <label className="block">
        <span className="text-[10px] font-bold tracking-wide text-fg-subtle uppercase">Weight (lb)</span>
        <input
          inputMode="numeric"
          value={weightLb}
          onChange={(e) => setWeightLb(e.target.value.replace(/\D/g, "").slice(0, 3))}
          className="mt-1 h-11 w-full rounded-xl border border-border bg-bg-subtle px-3 text-sm text-fg outline-none"
          placeholder="180"
        />
      </label>
      <div>
        <p className="text-[10px] font-bold tracking-wide text-fg-subtle uppercase">Gender</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {GENDER_OPTIONS.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setGender(g.id)}
              className={cn(
                "rounded-full px-3 py-1.5 text-[11px] font-semibold",
                gender === g.id
                  ? "bg-fg text-bg"
                  : "border border-border bg-bg-subtle text-fg-muted",
              )}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-[10px] font-bold tracking-wide text-fg-subtle uppercase">Ethnicity</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {ETHNICITY_OPTIONS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setEthnicity(e)}
              className={cn(
                "rounded-full px-3 py-1.5 text-[11px] font-semibold",
                ethnicity === e
                  ? "bg-fg text-bg"
                  : "border border-border bg-bg-subtle text-fg-muted",
              )}
            >
              {e}
            </button>
          ))}
        </div>
      </div>
      {error ? <p className="text-xs text-danger">{error}</p> : null}
      <button
        type="button"
        disabled={busy}
        onClick={() => void save()}
        className="flex h-11 w-full items-center justify-center rounded-xl bg-court text-sm font-semibold text-white disabled:opacity-60"
      >
        {busy ? "Saving…" : "Save and play"}
      </button>
    </div>
  );
}
