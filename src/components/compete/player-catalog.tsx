import { useMemo, useState } from "react";
import { Search, Swords } from "lucide-react";
import { PlayerAvatar } from "@/components/compete/player-avatar";
import { PlayerChip } from "@/components/compete/player-chip";
import { displayRating } from "@/lib/rating/engine";
import type { Player } from "@/lib/upset/types";
import { cn, formatHeightInches } from "@/lib/utils";

export function PlayerCatalog({
  players,
  onOpen,
  onChallenge,
}: {
  players: Player[];
  onOpen: (p: Player) => void;
  onChallenge: (p: Player) => void;
}) {
  const [q, setQ] = useState("");
  const [hMin, setHMin] = useState(60);
  const [hMax, setHMax] = useState(84);
  const [rMin, setRMin] = useState(1200);
  const [rMax, setRMax] = useState(2200);
  const [activeOnly, setActiveOnly] = useState(false);

  const list = useMemo(() => {
    return players
      .filter((p) => {
        if (p.heightIn < hMin || p.heightIn > hMax) return false;
        if (p.rating < rMin || p.rating > rMax) return false;
        if (activeOnly && p.availability !== "available") return false;
        if (q.trim()) {
          const s = q.trim().toLowerCase();
          if (
            !p.name.toLowerCase().includes(s) &&
            !p.handle.toLowerCase().includes(s) &&
            !(p.neighborhood?.toLowerCase().includes(s) ?? false)
          ) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => b.rating - a.rating);
  }, [players, q, hMin, hMax, rMin, rMax, activeOnly]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-subtle" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search players"
          className="h-11 w-full rounded-xl border border-border bg-bg-elevated pr-3 pl-10 text-sm text-fg outline-none"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterChip
          active={activeOnly}
          onClick={() => setActiveOnly((v) => !v)}
          label="Available now"
        />
        <select
          value={`${hMin}-${hMax}`}
          onChange={(e) => {
            const [a, b] = e.target.value.split("-").map(Number);
            setHMin(a!);
            setHMax(b!);
          }}
          className="h-9 rounded-full border border-border bg-bg-elevated px-3 text-xs text-fg"
        >
          <option value="60-84">Any height</option>
          <option value="72-81">6′0″–6′9″</option>
          <option value="60-72">Under 6′0″</option>
          <option value="76-90">6′4″+</option>
        </select>
        <select
          value={`${rMin}-${rMax}`}
          onChange={(e) => {
            const [a, b] = e.target.value.split("-").map(Number);
            setRMin(a!);
            setRMax(b!);
          }}
          className="h-9 rounded-full border border-border bg-bg-elevated px-3 text-xs text-fg"
        >
          <option value="1200-2200">Any rating</option>
          <option value="1500-2000">1500–2000</option>
          <option value="1800-2400">1800+</option>
          <option value="800-1600">Under 1600</option>
        </select>
      </div>

      <p className="px-1 text-xs text-fg-subtle">
        {list.length} player{list.length === 1 ? "" : "s"} · neighborhood only,
        never exact location
      </p>

      <div className="space-y-2">
        {list.map((p) => (
          <div
            key={p.id}
            className="rounded-2xl border border-border bg-bg-elevated p-3"
          >
            <div className="flex items-start gap-3">
              <button type="button" onClick={() => onOpen(p)}>
                <PlayerAvatar player={p} size="xl" />
              </button>
              <div className="min-w-0 flex-1">
                <PlayerChip player={p} onOpen={onOpen} showRating />
                <p className="mt-1 text-[11px] text-fg-muted">
                  {formatHeightInches(p.heightIn)} · {p.weightLb} lb ·{" "}
                  {p.wins}W–{p.losses}L · streak {p.streak}
                </p>
                <p className="text-[11px] text-fg-subtle">
                  sports {p.sportsmanship.toFixed(1)}★ · show{" "}
                  {p.reliability.toFixed(1)}★ ·{" "}
                  <span className="capitalize">{p.availability}</span>
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onChallenge(p)}
              className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-border text-sm font-semibold text-fg"
            >
              <Swords className="size-3.5 text-court" strokeWidth={2} />
              Challenge
            </button>
          </div>
        ))}
        {list.length === 0 && (
          <div className="rounded-2xl border border-border bg-bg-elevated px-6 py-10 text-center text-sm text-fg-muted">
            No players match these filters. Widen height or rating.
          </div>
        )}
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-9 rounded-full px-3 text-xs font-semibold",
        active
          ? "bg-accent text-accent-fg"
          : "border border-border bg-bg-elevated text-fg-muted",
      )}
    >
      {label}
    </button>
  );
}
