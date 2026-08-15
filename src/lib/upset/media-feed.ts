import { create } from "zustand";
import { persist } from "zustand/middleware";

export type FeedKind =
  | "win"
  | "upset"
  | "season"
  | "scheduled"
  | "open"
  | "streak"
  | "top10"
  | "user"
  | "hooping";

export interface FeedComment {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  at: string;
  mentionedIds?: string[];
}

export interface FeedPost {
  id: string;
  kind: FeedKind;
  headline: string;
  body: string;
  playerId: string;
  playerName: string;
  opponentId?: string;
  opponentName?: string;
  matchId?: string;
  /** Court linked from pickup / hooping posts */
  courtId?: string;
  courtName?: string;
  checkInId?: string;
  /** Primary court gallery photo for collage layout */
  courtImageUrl?: string;
  mediaUrl?: string;
  mediaType?: "image" | "video";
  at: string;
  likes: string[];
  comments: FeedComment[];
  /** Players @mentioned in the post body */
  mentionedIds?: string[];
}

export interface MentionNotice {
  id: string;
  toPlayerId: string;
  fromPlayerId: string;
  fromPlayerName: string;
  postId: string;
  snippet: string;
  at: string;
  read: boolean;
  /** When set, this is a pickup invite to a live court */
  kind?: "mention" | "pickup_invite";
  courtId?: string;
  courtName?: string;
}

const SEED: FeedPost[] = [
  {
    id: "mp1",
    kind: "win",
    headline: "Andre Kline takes Battle Bend under the lights",
    body: "Rated 1v1 · closed out Devon 2–1 (11–7, 9–11, 11–8). Clean series, city board stays stacked.",
    playerId: "p-andre",
    playerName: "Andre Kline",
    opponentId: "p-devon",
    opponentName: "Devon Brooks",
    at: "2026-08-02T18:00:00-05:00",
    likes: ["p-sean", "p-kai", "p-jia", "p-marcus"],
    comments: [
      {
        id: "c1",
        authorId: "p-sean",
        authorName: "Sean Rivera",
        text: "Deserved. That second half was locked in.",
        at: "2026-08-02T19:00:00-05:00",
      },
    ],
  },
  {
    id: "mp2",
    kind: "upset",
    headline: "Upset: Riley Cho drops a big dog at Zilker",
    body: "Riley walks into Zilker and takes a higher-rated matchup 2–0. Pure Upset City.",
    playerId: "p-riley",
    playerName: "Riley Cho",
    opponentId: "p-marcus",
    opponentName: "Marcus Webb",
    at: "2026-08-03T21:00:00-05:00",
    likes: ["p-you", "p-cam", "p-tess"],
    comments: [],
  },
  {
    id: "mp3",
    kind: "win",
    headline: "Kai Thompson wins a war at Pease",
    body: "Kai over Andre in a physical three-game set. Two of the best in Austin going full speed.",
    playerId: "p-kai",
    playerName: "Kai Thompson",
    opponentId: "p-andre",
    opponentName: "Andre Kline",
    at: "2026-08-04T17:30:00-05:00",
    likes: ["p-andre", "p-sean", "p-devon", "p-noah", "p-you"],
    comments: [],
  },
  {
    id: "mp4",
    kind: "streak",
    headline: "Sean Rivera is on a heater — 6 in a row",
    body: "City board heat check. Sean’s win streak hits 6 straight rated 1v1s. Who slows him down?",
    playerId: "p-sean",
    playerName: "Sean Rivera",
    at: "2026-08-03T16:00:00-05:00",
    likes: ["p-you", "p-kai", "p-jia"],
    comments: [],
  },
  {
    id: "mp5",
    kind: "top10",
    headline: "Top 10 game of the week: Kai vs Andre",
    body: "Two of the city’s best went the full three. Final 11–9, 9–11, 11–8. Pure cinema under the lights.",
    playerId: "p-kai",
    playerName: "Kai Thompson",
    opponentId: "p-andre",
    opponentName: "Andre Kline",
    at: "2026-08-04T21:00:00-05:00",
    likes: ["p-andre", "p-sean", "p-you", "p-devon", "p-marcus"],
    comments: [],
  },
  {
    id: "mp6",
    kind: "season",
    headline: "Weekend runs stacking up across ATX",
    body: "Open 1v1s are live citywide — Zilker, Battle Bend, Circle C. Post a game and get on the board.",
    playerId: "p-you",
    playerName: "Upset City",
    at: "2026-08-05T12:00:00-05:00",
    likes: ["p-you", "p-sean"],
    comments: [],
  },
];

export type Mentionable = {
  id: string;
  name: string;
  handle: string;
};

/** Detect active @query at caret in text. */
export function getMentionQuery(
  text: string,
  caret: number,
): { start: number; query: string } | null {
  const left = text.slice(0, caret);
  const at = left.lastIndexOf("@");
  if (at < 0) return null;
  // @ must be start or after whitespace / punctuation
  if (at > 0 && /[A-Za-z0-9_]/.test(left[at - 1]!)) return null;
  const query = left.slice(at + 1);
  // stop if space after @ without more typing of multi-word - allow spaces for full names until 3 words
  if (query.includes("\n")) return null;
  if (query.length > 40) return null;
  // if user typed two spaces, not a mention
  if (/\s{2,}/.test(query)) return null;
  return { start: at, query };
}

export function filterMentionCandidates(
  players: Mentionable[],
  query: string,
  meId: string,
  limit = 6,
): Mentionable[] {
  const q = query.trim().toLowerCase();
  const list = players.filter((p) => p.id !== meId);
  if (!q) return list.slice(0, limit);
  return list
    .filter((p) => {
      const name = p.name.toLowerCase();
      const handle = p.handle.toLowerCase();
      const first = name.split(" ")[0] ?? "";
      return (
        name.includes(q) ||
        handle.includes(q) ||
        first.startsWith(q) ||
        name.replace(/\s+/g, "").includes(q.replace(/\s+/g, ""))
      );
    })
    .slice(0, limit);
}

/** Insert @Name into text replacing the active query. */
export function applyMention(
  text: string,
  caret: number,
  start: number,
  player: Mentionable,
): { text: string; caret: number } {
  const mention = `@${player.name}`;
  const before = text.slice(0, start);
  const after = text.slice(caret);
  // ensure trailing space after mention
  const next = `${before}${mention} ${after.replace(/^\s*/, "")}`;
  const nextCaret = before.length + mention.length + 1;
  return { text: next, caret: nextCaret };
}

/** Resolve mentioned player ids from free text using longest name/handle match. */
export function resolveMentionIds(
  text: string,
  players: Mentionable[],
): string[] {
  const ids = new Set<string>();
  // Sort longer names first so "Sean Rivera" beats "Sean"
  const ranked = [...players].sort(
    (a, b) => b.name.length - a.name.length || b.handle.length - a.handle.length,
  );
  const lower = text.toLowerCase();
  for (const p of ranked) {
    const tokens = [
      `@${p.name}`.toLowerCase(),
      `@${p.handle}`.toLowerCase(),
      `@${p.name.split(" ")[0]}`.toLowerCase(),
    ];
    for (const tok of tokens) {
      if (tok.length < 2) continue;
      if (lower.includes(tok)) {
        ids.add(p.id);
        break;
      }
    }
  }
  return [...ids];
}

interface MediaFeedState {
  posts: FeedPost[];
  notices: MentionNotice[];
  createPost: (input: {
    authorId: string;
    authorName: string;
    text: string;
    mediaUrl?: string;
    mediaType?: "image" | "video";
    mentionedIds?: string[];
    kind?: FeedKind;
    courtId?: string;
    courtName?: string;
    checkInId?: string;
    courtImageUrl?: string;
    headline?: string;
  }) => string | null;
  /** Invite players to a live pickup court — shows in Social notices */
  inviteToPickup: (input: {
    fromPlayerId: string;
    fromPlayerName: string;
    courtId: string;
    courtName: string;
    checkInId: string;
    toPlayerIds: string[];
  }) => number;
  toggleLike: (postId: string, playerId: string) => void;
  addComment: (
    postId: string,
    authorId: string,
    authorName: string,
    text: string,
    mentionedIds?: string[],
  ) => void;
  markNoticesRead: (playerId: string) => void;
}

export const useMediaFeed = create<MediaFeedState>()(
  persist(
    (set, get) => ({
      posts: SEED,
      notices: [],
      createPost: ({
        authorId,
        authorName,
        text,
        mediaUrl,
        mediaType,
        mentionedIds,
        kind = "user",
        courtId,
        courtName,
        checkInId,
        courtImageUrl,
        headline: headlineIn,
      }) => {
        const body = text.trim();
        if (!body && !mediaUrl) return null;
        const id = `mp-user-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
        const headline =
          headlineIn?.trim() ||
          (body.length > 72
            ? `${body.slice(0, 69).trim()}…`
            : body ||
              (mediaType === "video" ? "Shared a video" : "Shared a photo"));
        const mentions = (mentionedIds ?? []).filter((x) => x !== authorId);
        const post: FeedPost = {
          id,
          kind,
          headline,
          body:
            body ||
            (mediaType === "video" ? "Posted a video" : "Posted a photo"),
          playerId: authorId,
          playerName: authorName,
          courtId,
          courtName,
          checkInId,
          courtImageUrl,
          mediaUrl,
          mediaType,
          at: new Date().toISOString(),
          likes: [],
          comments: [],
          mentionedIds: mentions,
        };
        const notices: MentionNotice[] = mentions.map((toId) => ({
          id: `mn-${Date.now().toString(36)}-${toId}`,
          toPlayerId: toId,
          fromPlayerId: authorId,
          fromPlayerName: authorName,
          postId: id,
          snippet: body.slice(0, 120),
          at: new Date().toISOString(),
          read: false,
          kind: "mention",
        }));
        set((s) => ({
          posts: [post, ...s.posts],
          notices: [...notices, ...s.notices],
        }));
        return id;
      },
      inviteToPickup: ({
        fromPlayerId,
        fromPlayerName,
        courtId,
        courtName,
        checkInId,
        toPlayerIds,
      }) => {
        const targets = [...new Set(toPlayerIds)].filter(
          (id) => id && id !== fromPlayerId,
        );
        if (!targets.length) return 0;
        const postId = `pickup:${checkInId}`;
        const notices: MentionNotice[] = targets.map((toId) => ({
          id: `pi-${Date.now().toString(36)}-${toId}`,
          toPlayerId: toId,
          fromPlayerId,
          fromPlayerName,
          postId,
          snippet: `Pickup live at ${courtName} — come through`,
          at: new Date().toISOString(),
          read: false,
          kind: "pickup_invite",
          courtId,
          courtName,
        }));
        set((s) => ({ notices: [...notices, ...s.notices] }));
        return notices.length;
      },
      toggleLike: (postId, playerId) =>
        set((s) => ({
          posts: s.posts.map((p) => {
            if (p.id !== postId) return p;
            const has = p.likes.includes(playerId);
            return {
              ...p,
              likes: has
                ? p.likes.filter((id) => id !== playerId)
                : [...p.likes, playerId],
            };
          }),
        })),
      addComment: (postId, authorId, authorName, text, mentionedIds) => {
        const body = text.trim();
        if (!body) return;
        const mentions = (mentionedIds ?? []).filter((x) => x !== authorId);
        const notices: MentionNotice[] = mentions.map((toId) => ({
          id: `mn-${Date.now().toString(36)}-${toId}`,
          toPlayerId: toId,
          fromPlayerId: authorId,
          fromPlayerName: authorName,
          postId,
          snippet: body.slice(0, 120),
          at: new Date().toISOString(),
          read: false,
          kind: "mention",
        }));
        set((s) => ({
          posts: s.posts.map((p) =>
            p.id !== postId
              ? p
              : {
                  ...p,
                  comments: [
                    ...p.comments,
                    {
                      id: `c-${Date.now().toString(36)}`,
                      authorId,
                      authorName,
                      text: body,
                      at: new Date().toISOString(),
                      mentionedIds: mentions,
                    },
                  ],
                },
          ),
          notices: [...notices, ...s.notices],
        }));
      },
      markNoticesRead: (playerId) =>
        set((s) => ({
          notices: s.notices.map((n) =>
            n.toPlayerId === playerId ? { ...n, read: true } : n,
          ),
        })),
    }),
    {
      name: "upset-city-media-v4",
      partialize: (s) => ({
        posts: s.posts.map((p) => {
          if (
            p.mediaUrl &&
            (p.mediaUrl.startsWith("blob:") || p.mediaUrl.length > 200_000)
          ) {
            const { mediaUrl: _m, mediaType: _t, ...rest } = p;
            return {
              ...rest,
              body:
                p.body ||
                (p.mediaType === "video"
                  ? "Posted a video"
                  : "Posted a photo"),
            };
          }
          return p;
        }),
        notices: s.notices,
      }),
    },
  ),
);

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
