import { useEffect, useState } from "react";
import { markNoticesReadFn } from "@/lib/game/notice-fns";
import { refreshCompetitiveSnapshotSoon } from "@/lib/game/client-actions";
import { formatInboxAgo } from "@/lib/messages/inbox";
import { enablePushNotifications } from "@/lib/push/client";
import type { PlayerNotice } from "@/lib/upset/types";

export function NoticeFeed({
  notices,
  onOpenGame,
  onOpenMessages,
}: {
  notices: PlayerNotice[];
  onOpenGame: (matchId: string) => void;
  onOpenMessages: () => void;
}) {
  const unread = notices.filter((n) => !n.readAt).length;
  const [push, setPush] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "denied",
  );

  const enablePush = async () => {
    const result = await enablePushNotifications();
    setPush(result === "granted" ? "granted" : Notification.permission);
  };

  const open = (n: PlayerNotice) => {
    void markNoticesReadFn({ data: { ids: [n.id] } }).then(() =>
      refreshCompetitiveSnapshotSoon(),
    );
    if (n.matchId) onOpenGame(n.matchId);
    else onOpenMessages();
  };

  const markAll = () => {
    void markNoticesReadFn({ data: {} }).then(() => refreshCompetitiveSnapshotSoon());
  };

  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-bg-elevated px-3.5 py-3.5">
        <p className="text-[14px] font-semibold text-fg">Alerts on this phone</p>
        <p className="mt-1 text-[13px] leading-relaxed text-fg-muted">
          On iPhone, install Upset City to your Home Screen first, then enable
          alerts. Invites, lock-in, and score confirms also email you when mail
          is set up.
        </p>
        {typeof Notification !== "undefined" ? (
          <button
            type="button"
            onClick={() => void enablePush()}
            disabled={push === "granted"}
            className="mt-3 h-10 w-full rounded-full border border-border text-[12px] font-semibold text-fg disabled:opacity-60"
          >
            {push === "granted" ? "Phone alerts on" : "Enable phone alerts"}
          </button>
        ) : null}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-[13px] font-semibold text-fg">
          Inbox {unread > 0 ? `· ${unread} new` : ""}
        </p>
        {unread > 0 ? (
          <button type="button" onClick={markAll} className="text-[12px] font-semibold text-court">
            Mark all read
          </button>
        ) : null}
      </div>

      {notices.length === 0 ? (
        <p className="text-[13px] text-fg-muted">No alerts yet. Invites and score confirms land here.</p>
      ) : (
        <ul className="space-y-1.5">
          {notices.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => open(n)}
                className="flex w-full items-start justify-between gap-2 rounded-2xl bg-bg-elevated px-3.5 py-3 text-left"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-semibold text-fg">{n.title}</span>
                  <span className="mt-0.5 block truncate text-[12px] text-fg-muted">{n.body}</span>
                </span>
                <span className="shrink-0 text-[11px] text-fg-subtle">
                  {n.readAt ? formatInboxAgo(n.createdAt) : "New"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function useNoticeToasts(notices: PlayerNotice[]) {
  useEffect(() => {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const unread = notices.filter((n) => !n.readAt);
    const latest = unread[0];
    if (!latest) return;
    try {
      const seen = sessionStorage.getItem("uc-notice-toast");
      if (seen === latest.id) return;
      sessionStorage.setItem("uc-notice-toast", latest.id);
      new Notification(latest.title, { body: latest.body, tag: latest.id });
    } catch {
      /* ignore */
    }
  }, [notices]);
}
