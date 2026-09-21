import { canAccessGameChat, chatThreadIds, messagesInThread } from "@/lib/game/rules";
import type { ChatMessage, DirectThread, Match, Player } from "@/lib/upset/types";

export type InboxKind = "dm" | "game";
export type InboxFilter = "all" | "games" | "direct";

export type InboxThread = {
  key: string;
  kind: InboxKind;
  updatedAt: string;
  lastText: string;
  lastId?: string;
  unreadCount: number;
  otherId: string;
  matchId?: string;
  courtName?: string;
  whenIso?: string;
  dmThreadId?: string;
  threadWithId?: string;
};

const READ_KEY = "uc-inbox-read";
let readVersion = 0;
const readListeners = new Set<() => void>();

function loadRead(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(READ_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function subscribeInboxRead(cb: () => void) {
  readListeners.add(cb);
  return () => readListeners.delete(cb);
}

export function inboxReadVersion() {
  return readVersion;
}

export function markInboxRead(key: string, lastMessageId: string | undefined) {
  if (!key || !lastMessageId || typeof window === "undefined") return;
  const next = loadRead();
  if (next[key] === lastMessageId) return;
  next[key] = lastMessageId;
  try {
    window.localStorage.setItem(READ_KEY, JSON.stringify(next));
  } catch {
    /* quota */
  }
  readVersion += 1;
  readListeners.forEach((fn) => fn());
}

function unreadCount(messages: ChatMessage[], meId: string, lastSeenId?: string) {
  const rows = messages.filter((m) => !m.system && m.authorId && m.authorId !== meId);
  if (!rows.length) return 0;
  if (!lastSeenId) return rows.length;
  const idx = rows.findIndex((m) => m.id === lastSeenId);
  if (idx < 0) return rows.length;
  return rows.length - idx - 1;
}

function lastUserMessage(messages: ChatMessage[]) {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (!messages[i].system) return messages[i];
  }
  return messages[messages.length - 1];
}

export function buildInbox(input: {
  meId: string;
  matches: Match[];
  dmThreads: DirectThread[];
  players?: Player[];
}): InboxThread[] {
  const read = loadRead();
  const items: InboxThread[] = [];

  for (const thread of input.dmThreads ?? []) {
    const otherId =
      thread.participantIds.find((id) => id !== input.meId) ?? thread.participantIds[0];
    if (!otherId) continue;
    const last = lastUserMessage(thread.messages ?? []);
    const key = `dm:${thread.id}`;
    items.push({
      key,
      kind: "dm",
      updatedAt: last?.at ?? thread.updatedAt,
      lastText: last?.text ?? "",
      lastId: last?.id,
      unreadCount: unreadCount(thread.messages ?? [], input.meId, read[key]),
      otherId,
      dmThreadId: thread.id,
    });
  }

  for (const match of input.matches ?? []) {
    if (match.status === "cancelled") continue;
    const isHost = match.hostId === input.meId;
    const canChat = canAccessGameChat({
      hostId: match.hostId,
      opponentId: match.opponentId,
      actorId: input.meId,
      inviteeIds: match.guestInviteIds,
      inviteOnly: match.inviteOnly,
    });
    if (!isHost && !canChat) continue;

    const chat = match.chat ?? [];
    const threadIds = isHost
      ? [
          ...new Set([
            ...chatThreadIds(chat),
            ...(match.guestInviteIds ?? []),
            ...(match.opponentId ? [match.opponentId] : []),
          ]),
        ].filter((id) => id && id !== match.hostId)
      : [input.meId];

    for (const pid of threadIds) {
      const msgs = messagesInThread(chat, pid, match.opponentId);
      if (msgs.length === 0) continue;
      const last = lastUserMessage(msgs);
      const key = `game:${match.id}:${pid}`;
      items.push({
        key,
        kind: "game",
        updatedAt: last?.at ?? match.createdAt,
        lastText: last?.text ?? "",
        lastId: last?.id,
        unreadCount: unreadCount(msgs, input.meId, read[key]),
        otherId: isHost ? pid : match.hostId,
        matchId: match.id,
        courtName: match.courtName,
        whenIso: match.scheduledAt ?? match.preferredAt,
        threadWithId: pid,
      });
    }
  }

  items.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  return items;
}

export function inboxUnreadTotal(threads: InboxThread[]) {
  return threads.reduce((sum, t) => sum + t.unreadCount, 0);
}

export function formatInboxAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "";
  const mins = Math.round(ms / 60_000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d`;
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}
