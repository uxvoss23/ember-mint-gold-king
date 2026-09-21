import { useMemo, useState, useSyncExternalStore } from "react";
import { ChevronRight, MessageCircle } from "lucide-react";
import { PlayerAvatar } from "@/components/compete/player-avatar";
import { DmSheet } from "@/components/compete/dm-sheet";
import {
  buildInbox,
  formatInboxAgo,
  inboxReadVersion,
  markInboxRead,
  subscribeInboxRead,
  type InboxFilter,
  type InboxThread,
} from "@/lib/messages/inbox";
import { formatLocalWhen, useUpsetStore } from "@/lib/upset/store";
import type { Player } from "@/lib/upset/types";
import { cn } from "@/lib/utils";

export function MessagesInbox({
  me,
  players,
  onBack,
  onOpenGameThread,
}: {
  me: Player;
  players: Player[];
  onBack: () => void;
  onOpenGameThread: (matchId: string, threadWithId: string) => void;
}) {
  const store = useUpsetStore();
  useSyncExternalStore(subscribeInboxRead, inboxReadVersion, inboxReadVersion);
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [openDmId, setOpenDmId] = useState<string | null>(null);
  const playerById = useMemo(
    () => new Map(players.map((p) => [p.id, p])),
    [players],
  );

  const threads = useMemo(
    () =>
      buildInbox({
        meId: me.id,
        matches: store.matches,
        dmThreads: store.dmThreads ?? [],
        players,
      }),
    [me.id, store.matches, store.dmThreads, players],
  );

  const visible = threads.filter((t) =>
    filter === "all" ? true : filter === "games" ? t.kind === "game" : t.kind === "dm",
  );
  const openThread = (store.dmThreads ?? []).find((t) => t.id === openDmId) ?? null;
  const openOther = openThread
    ? playerById.get(openThread.participantIds.find((id) => id !== me.id) ?? "") ?? null
    : null;

  const openItem = (item: InboxThread) => {
    markInboxRead(item.key, item.lastId);
    if (item.kind === "dm" && item.dmThreadId) {
      setOpenDmId(item.dmThreadId);
      return;
    }
    if (item.kind === "game" && item.matchId && item.threadWithId) {
      onOpenGameThread(item.matchId, item.threadWithId);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 px-1 pb-3 pt-1">
        <button
          type="button"
          onClick={onBack}
          className="min-h-11 px-1 text-[13px] font-medium text-fg-muted"
        >
          ← Me
        </button>
        <h2 className="flex-1 text-center font-display text-[17px] font-semibold text-fg">
          Messages
        </h2>
        <span className="w-12" aria-hidden />
      </div>

      <div className="mb-3 grid grid-cols-3 gap-1 rounded-xl bg-bg-elevated p-0.5">
        {(
          [
            ["all", "All"],
            ["games", "Games"],
            ["direct", "Direct"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={cn(
              "rounded-lg py-1.5 text-center text-[12px] font-semibold",
              filter === id ? "bg-fg text-bg" : "text-fg-muted",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain pb-6">
        {visible.length === 0 ? (
          <div className="px-2 py-16 text-center">
            <MessageCircle className="mx-auto size-7 text-fg-subtle" />
            <p className="mt-3 text-sm font-semibold text-fg">No conversations yet</p>
            <p className="mt-1 text-[12px] text-fg-muted">
              {filter === "direct"
                ? "Direct messages from player profiles show up here."
                : filter === "games"
                  ? "Game chats show up here when someone messages a listing."
                  : "DMs and game chats will land here."}
            </p>
          </div>
        ) : (
          visible.map((item) => {
            const other = playerById.get(item.otherId);
            const unread = item.unreadCount > 0;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => openItem(item)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-2xl px-2.5 py-2.5 text-left",
                  unread ? "bg-court/10" : "bg-transparent",
                )}
              >
                {other ? (
                  <PlayerAvatar player={other} size="sm" className="!size-11" />
                ) : (
                  <div className="grid size-11 place-items-center rounded-full bg-bg-elevated text-[13px]">
                    {item.kind === "game" ? "🏀" : "💬"}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <p className={cn("min-w-0 truncate text-[14px] text-fg", unread ? "font-bold" : "font-semibold")}>
                      {item.kind === "game"
                        ? item.courtName ?? "Game"
                        : other?.name ?? "Player"}
                    </p>
                    <span className="ml-auto shrink-0 text-[11px] text-fg-subtle">
                      {item.updatedAt ? formatInboxAgo(item.updatedAt) : ""}
                    </span>
                  </div>
                  {item.kind === "game" ? (
                    <p className="truncate text-[11px] text-fg-muted">
                      Game · {other?.name.split(" ")[0] ?? "Player"}
                      {item.whenIso ? ` · ${formatLocalWhen(item.whenIso)}` : ""}
                    </p>
                  ) : (
                    <p className="text-[11px] text-fg-subtle">Direct</p>
                  )}
                  <p className={cn("mt-0.5 truncate text-[13px]", unread ? "text-fg" : "text-fg-muted")}>
                    {item.lastText || "No messages yet"}
                  </p>
                </div>
                {unread ? (
                  <span className="mt-1 inline-flex min-w-[1.15rem] shrink-0 items-center justify-center rounded-full bg-court px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {item.unreadCount > 9 ? "9+" : item.unreadCount}
                  </span>
                ) : (
                  <ChevronRight className="mt-2 size-4 shrink-0 text-fg-subtle" />
                )}
              </button>
            );
          })
        )}
      </div>

      {openThread ? (
        <DmSheet
          me={me}
          other={openOther}
          thread={openThread}
          onClose={() => setOpenDmId(null)}
        />
      ) : null}
    </div>
  );
}
