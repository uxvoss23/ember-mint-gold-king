import { useEffect, useState, type ReactNode } from "react";
import { Bell, CalendarPlus } from "lucide-react";
import {
  downloadMatchIcs,
  googleCalendarUrl,
  markReminder,
  remindersCompleted,
  scheduleBrowserReminders,
  type ReminderMatch,
} from "@/lib/match-reminders";

/**
 * Stronger one-shot reminders: calendar (24h + 3h VALARM) + optional browser pings.
 */
export function MatchRemindersCard({
  match,
  emphasize,
  onDone,
  title,
  subtitle,
}: {
  match: ReminderMatch;
  emphasize?: boolean;
  /** Called after calendar set or "Not now" */
  onDone?: () => void;
  title?: string;
  subtitle?: ReactNode;
}) {
  const [hidden, setHidden] = useState(() => remindersCompleted(match.id));
  const [flash, setFlash] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (remindersCompleted(match.id)) setHidden(true);
  }, [match.id]);

  const finish = (message: string) => {
    setFlash(message);
    setHidden(true);
    window.setTimeout(() => setFlash(null), 1800);
    onDone?.();
  };

  const onBoth = async () => {
    setBusy(true);
    downloadMatchIcs(match);
    markReminder(match.id, "calendar");
    const r = await scheduleBrowserReminders(match);
    setBusy(false);
    finish(
      r.ok
        ? "Calendar + browser alerts set (24h & 3h)."
        : "Calendar added. " + (r.reason ?? "Browser alerts unavailable — phone calendar will still ping."),
    );
  };

  const onCalendarOnly = () => {
    downloadMatchIcs(match);
    markReminder(match.id, "calendar");
    finish("Calendar added — alerts 24h & 3h before.");
  };

  const onGoogle = () => {
    window.open(googleCalendarUrl(match), "_blank", "noopener,noreferrer");
    markReminder(match.id, "calendar");
    finish("Google Calendar opened — set 1 day + 3 hour alerts if asked.");
  };

  if (hidden) {
    if (!flash) return null;
    return (
      <p
        className="rounded-xl border border-success/30 bg-success/10 px-3 py-2.5 text-center text-xs font-medium text-success"
        role="status"
      >
        {flash}
      </p>
    );
  }

  return (
    <div
      className={
        emphasize
          ? "rounded-2xl border-2 border-court bg-court-soft/40 p-3.5 shadow-sm"
          : "rounded-2xl border border-court/30 bg-court-soft/30 p-3.5"
      }
    >
      <div className="flex items-start gap-2">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-court text-white">
          <Bell className="size-4" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-fg">
            {title ??
              (emphasize ? "Set your game alerts" : "Game reminders")}
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-fg-muted">
            {subtitle ?? (
              <>
                Phone alerts at{" "}
                <span className="font-semibold text-fg">24 hours</span> and{" "}
                <span className="font-semibold text-fg">3 hours</span> before
                tip-off.
              </>
            )}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void onBoth()}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-fg text-sm font-semibold text-bg disabled:opacity-60"
        >
          <CalendarPlus className="size-4" />
          {busy ? "Setting…" : "Add calendar + browser alerts"}
        </button>
        <button
          type="button"
          onClick={onGoogle}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-border bg-bg-elevated text-xs font-semibold text-fg"
        >
          Open in Google Calendar
        </button>
        <button
          type="button"
          onClick={onCalendarOnly}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-border text-xs font-semibold text-fg-muted"
        >
          Download .ics only
        </button>
        <button
          type="button"
          onClick={() => {
            markReminder(match.id, "dismissed");
            setHidden(true);
            onDone?.();
          }}
          className="py-1 text-center text-[11px] font-medium text-fg-subtle"
        >
          Not now
        </button>
      </div>
    </div>
  );
}
