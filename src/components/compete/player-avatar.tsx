import { memo, useMemo } from "react";
import { Crown } from "lucide-react";
import {
  cityRankOf,
  ensureCityRanks,
} from "@/lib/upset/city-rank";
import { cn } from "@/lib/utils";
import type { Player } from "@/lib/upset/types";

/**
 * Face-forward avatar — real photo when available, else color + initials.
 * #1: gold ring + crown
 * #2–10: cool platinum ring (elite hoopers)
 * showRank: optional #N chip left of face
 *
 * Does NOT subscribe to the global store (that made every avatar re-render
 * and re-sort the full city list on any state change → multi-second freezes).
 * Rank comes from a module cache kept warm by `ensureCityRanks` in the store,
 * or an explicit `rank` prop.
 */
export const PlayerAvatar = memo(function PlayerAvatar({
  player,
  size = "md",
  className,
  showRank = true,
  showElite = true,
  rank: rankProp,
}: {
  player: Pick<Player, "name" | "hue" | "photoUrl" | "id">;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  /** Show #rank chip left of face (top 50). Off on leaderboard rows. */
  showRank?: boolean;
  /** Crown / gold or platinum ring for top city ranks. Default on. */
  showElite?: boolean;
  /** Optional precomputed city rank (1-based). */
  rank?: number | null;
}) {
  const rank = useMemo(() => {
    if (rankProp != null) return rankProp > 0 && rankProp <= 50 ? rankProp : null;
    if (!showRank && !showElite) return null;
    if (!player.id) return null;
    return cityRankOf(player.id);
  }, [rankProp, player.id, showRank, showElite]);

  const dim =
    size === "xs"
      ? "size-8"
      : size === "sm"
        ? "size-10"
        : size === "lg"
          ? "size-16"
          : size === "xl"
            ? "size-24"
            : "size-12";
  const text =
    size === "xs"
      ? "text-[10px]"
      : size === "sm"
        ? "text-xs"
        : size === "lg"
          ? "text-lg"
          : size === "xl"
            ? "text-2xl"
            : "text-sm";
  const badgeText =
    size === "xs" || size === "sm"
      ? "text-[10px] px-1 py-0.5 min-w-[1.2rem]"
      : size === "xl"
        ? "text-[13px] px-1.5 py-0.5 min-w-[1.6rem]"
        : "text-[11px] px-1.5 py-0.5 min-w-[1.35rem]";

  const crownSize =
    size === "xs"
      ? "size-2.5"
      : size === "sm"
        ? "size-3"
        : size === "lg"
          ? "size-4"
          : size === "xl"
            ? "size-5"
            : "size-3.5";

  const initials = useMemo(() => {
    const parts = player.name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
    return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
  }, [player.name]);

  const isKing = showElite && rank === 1;
  const isElite = showElite && rank != null && rank >= 2 && rank <= 10;

  return (
    <div className={cn("relative inline-flex shrink-0", className)}>
      {isKing ? (
        <Crown
          className={cn(
            "absolute -top-2 left-1/2 z-10 -translate-x-1/2 text-amber-400 drop-shadow",
            crownSize,
          )}
          fill="currentColor"
          strokeWidth={1.5}
          aria-hidden
        />
      ) : null}
      <div
        className={cn(
          "relative overflow-hidden rounded-full bg-bg-subtle",
          dim,
          isKing
            ? "ring-[2.5px] ring-amber-400 ring-offset-1 ring-offset-bg"
            : isElite
              ? "ring-[2px] ring-slate-300/85 ring-offset-1 ring-offset-bg"
              : "ring-1 ring-border",
        )}
        style={
          player.photoUrl
            ? undefined
            : {
                background: `linear-gradient(145deg, oklch(0.42 0.1 ${player.hue}), oklch(0.28 0.06 ${player.hue}))`,
              }
        }
      >
        {player.photoUrl ? (
          <img
            src={player.photoUrl}
            alt=""
            className="h-full w-full object-cover object-[center_18%]"
            loading="lazy"
            decoding="async"
            draggable={false}
          />
        ) : (
          <span
            className={cn(
              "flex h-full w-full items-center justify-center font-bold text-white/90",
              text,
            )}
          >
            {initials}
          </span>
        )}
      </div>
      {showRank && rank != null ? (
        <span
          className={cn(
            "absolute -bottom-0.5 -left-1 z-10 rounded-full text-center font-bold tabular-nums shadow-sm",
            badgeText,
            isKing
              ? "bg-amber-400 text-amber-950"
              : isElite
                ? "bg-slate-200 text-slate-900"
                : "bg-bg-elevated text-fg ring-1 ring-border",
          )}
        >
          #{rank}
        </span>
      ) : null}
    </div>
  );
});

/** Warm rank cache (call from store when players change). */
export { ensureCityRanks, cityRankOf };
