import {
  CAMPAIGN_CHARITY,
  campaignProgress,
  formatCampaignMoney,
  useCampaign,
} from "@/lib/upset/campaign";
import { cn } from "@/lib/utils";

/** Slim city goal progress — Play + Media */
export function CampaignBanner({
  compact,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  const raised = useCampaign((s) => s.raisedDollars);
  const goal = useCampaign((s) => s.goalDollars);
  const { pct } = campaignProgress(raised, goal);

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-bg-elevated px-3 py-2",
        className,
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="truncate text-[11px] font-medium text-fg-muted">
          Alzheimer's research
        </p>
        <p className="shrink-0 text-[11px] font-semibold tabular-nums text-fg">
          {formatCampaignMoney(raised)}
          <span className="font-medium text-fg-muted">
            {" "}
            / {formatCampaignMoney(goal)}
          </span>
        </p>
      </div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-bg-subtle">
        <div
          className="h-full rounded-full bg-fg/70 transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      {!compact ? (
        <p className="mt-1 text-[10px] text-fg-subtle">
          {pct}% ·{" "}
          <a
            href={CAMPAIGN_CHARITY.url}
            target="_blank"
            rel="noopener noreferrer"
            className="underline-offset-2 hover:underline"
          >
            Donate
          </a>
        </p>
      ) : null}
    </div>
  );
}
