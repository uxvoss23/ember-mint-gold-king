import { PlayerAvatar } from "@/components/compete/player-avatar";
import type { Player } from "@/lib/upset/types";
import { displayRating } from "@/lib/rating/engine";
import { cn, formatHeightInches } from "@/lib/utils";

/**
 * One shared chip — name/photo always open the same profile destination.
 */
export function PlayerChip({
  player,
  onOpen,
  subtitle,
  showRating = true,
  size = "md",
  className,
}: {
  player: Player;
  onOpen: (p: Player) => void;
  subtitle?: string;
  showRating?: boolean;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpen(player);
      }}
      className={cn(
        "flex min-w-0 items-center gap-2.5 rounded-xl text-left transition-colors hover:bg-bg-subtle/80",
        size === "sm" ? "py-1" : "py-1.5 pr-2",
        className,
      )}
    >
      <PlayerAvatar player={player} size={size === "sm" ? "sm" : "md"} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-fg">{player.name}</p>
        <p className="truncate text-[11px] text-fg-muted">
          {subtitle ??
            `${formatHeightInches(player.heightIn)} · ${player.neighborhood ?? player.city}`}
        </p>
      </div>
      {showRating && (
        <span className="shrink-0 text-sm font-semibold tabular-nums text-fg">
          {displayRating(player.rating)}
        </span>
      )}
    </button>
  );
}
