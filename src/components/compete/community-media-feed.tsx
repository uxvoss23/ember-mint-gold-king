import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Heart,
  ImagePlus,
  MessageCircle,
  Plus,
  Swords,
  Trophy,
  Video,
  X,
  Zap,
} from "lucide-react";
import { CampaignBanner } from "@/components/compete/campaign-banner";
import { PlayerAvatar } from "@/components/compete/player-avatar";
import {
  applyMention,
  fileToDataUrl,
  filterMentionCandidates,
  getMentionQuery,
  resolveMentionIds,
  useMediaFeed,
  type FeedKind,
  type FeedPost,
} from "@/lib/upset/media-feed";
import { displayRating } from "@/lib/rating/engine";
import { formatLocalWhen, useUpsetStore } from "@/lib/upset/store";
import type { Match, Player } from "@/lib/upset/types";
import { cn } from "@/lib/utils";

/** Fallback court coords when we only have homeCourtId */
/** Instagram/FB-style: show a few comments, “View all” for the rest */
const COMMENT_PREVIEW = 2;

const COURT_FALLBACK: Record<string, { name: string; lat: number; lon: number }> = {
  "cat-zilker": { name: "Zilker Park", lat: 30.2669, lon: -97.7729 },
  "cat-battle-bend": { name: "Battle Bend", lat: 30.2215, lon: -97.7678 },
  "cat-givens": { name: "Givens District Park", lat: 30.2585, lon: -97.705 },
  "cat-pease": { name: "Pease Park", lat: 30.2818, lon: -97.7525 },
  "cat-bartholomew": { name: "Bartholomew", lat: 30.3025, lon: -97.6912 },
  "cat-rosewood": { name: "Rosewood", lat: 30.2708, lon: -97.7135 },
  "cat-reed": { name: "Reed Park", lat: 30.3055, lon: -97.756 },
  "cat-circle-c": { name: "Circle C", lat: 30.186, lon: -97.889 },
  "cat-west4": { name: "West 4th", lat: 30.269, lon: -97.755 },
  "cat-garrison": { name: "Garrison", lat: 30.25, lon: -97.75 },
  "cat-walnut-creek": { name: "Walnut Creek", lat: 30.38, lon: -97.68 },
  "cat-hancock": { name: "Hancock", lat: 30.295, lon: -97.725 },
  "cat-searight": { name: "Searight", lat: 30.2, lon: -97.8 },
};

/** Split text into plain runs + @mention hits */
function mentionSegments(text: string, players: Player[]) {
  const ranked = [...players].sort((a, b) => b.name.length - a.name.length);
  const segs: { kind: "text" | "mention"; value: string; player?: Player }[] = [];
  let i = 0;
  while (i < text.length) {
    if (text[i] === "@") {
      let hit: Player | null = null;
      let hitLen = 0;
      for (const p of ranked) {
        for (const label of [p.name, p.handle, p.name.split(" ")[0] ?? ""]) {
          if (!label) continue;
          const token = `@${label}`;
          if (
            text.slice(i, i + token.length).toLowerCase() === token.toLowerCase()
          ) {
            // require boundary after token (end or non-name char) for first-name only
            const after = text[i + token.length];
            const ok =
              !after ||
              /[\s.,!?;:)\]}]/.test(after) ||
              label.includes(" ") ||
              label === p.handle;
            if (ok && token.length > hitLen) {
              hit = p;
              hitLen = token.length;
            }
          }
        }
      }
      if (hit && hitLen > 0) {
        segs.push({
          kind: "mention",
          value: text.slice(i, i + hitLen),
          player: hit,
        });
        i += hitLen;
        continue;
      }
    }
    let j = i + 1;
    while (j < text.length && text[j] !== "@") j += 1;
    segs.push({ kind: "text", value: text.slice(i, j) });
    i = j;
  }
  return segs;
}

/** Highlight @mentions in post/comment text */
function MentionText({
  text,
  players,
  onOpenPlayer,
}: {
  text: string;
  players: Player[];
  onOpenPlayer?: (p: Player) => void;
}) {
  const segs = mentionSegments(text, players);
  return (
    <>
      {segs.map((s, idx) =>
        s.kind === "mention" && s.player ? (
          <button
            key={idx}
            type="button"
            onClick={() => onOpenPlayer?.(s.player!)}
            className="font-semibold text-court hover:underline"
          >
            {s.value}
          </button>
        ) : (
          <span key={idx}>{s.value}</span>
        ),
      )}
    </>
  );
}

/** Colored mirror layer for editor (textarea/input must use transparent text) */
function MentionHighlightLayer({
  text,
  players,
  multiline,
}: {
  text: string;
  players: Player[];
  multiline?: boolean;
}) {
  const segs = mentionSegments(text, players);
  // trailing space keeps height when empty lines; zero-width space helps caret align
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words text-sm leading-normal text-fg",
        multiline ? "px-3 py-2.5" : "flex items-center px-3",
      )}
    >
      {text.length === 0 ? (
        <span className="text-transparent">.</span>
      ) : (
        segs.map((s, idx) =>
          s.kind === "mention" ? (
            <span key={idx} className="font-semibold text-court">
              {s.value}
            </span>
          ) : (
            <span key={idx} className="text-fg">
              {s.value}
            </span>
          ),
        )
      )}
    </div>
  );
}

function kindLabel(kind: FeedKind) {
  switch (kind) {
    case "upset":
      return "Upset";
    case "season":
      return "League";
    case "scheduled":
      return "Locked";
    case "open":
      return "Open game";
    case "streak":
      return "Streak";
    case "top10":
      return "Top 10";
    case "user":
      return "Post";
    case "hooping":
      return "Pickup live";
    case "win":
    default:
      return "Win";
  }
}

function KindPill({ kind }: { kind: FeedKind }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px] font-semibold",
        kind === "upset" && "bg-danger/15 text-danger",
        kind === "win" && "bg-court-soft text-court",
        kind === "season" && "bg-bg-subtle text-fg-muted",
        kind === "scheduled" && "bg-accent/15 text-accent",
        kind === "open" && "bg-court-soft text-court",
        kind === "streak" && "bg-success/15 text-success",
        kind === "top10" && "bg-fg text-bg",
        kind === "user" && "bg-bg-subtle text-fg-muted",
        kind === "hooping" && "bg-emerald-600/20 text-emerald-400",
      )}
    >
      {kindLabel(kind)}
    </span>
  );
}

/**
 * Open listings + locked games appear in Media (capped so the feed doesn’t flood).
 * CTA jumps into Play so you can scout the listing before accepting.
 */
function postsFromMatches(matches: Match[], players: Player[]): FeedPost[] {
  const byId = new Map(players.map((p) => [p.id, p]));
  const open = matches
    .filter((m) => m.status === "open")
    .sort(
      (a, b) =>
        new Date(b.createdAt ?? b.preferredAt).getTime() -
        new Date(a.createdAt ?? a.preferredAt).getTime(),
    )
    .slice(0, 8)
    .map((m) => {
      const host = byId.get(m.hostId);
      const when = formatLocalWhen(m.scheduledAt ?? m.preferredAt);
      const first = (host?.name ?? "Someone").split(" ")[0];
      return {
        id: `auto-match-${m.id}`,
        kind: "open" as const,
        headline: `${first} posted an open 1v1 · ${m.courtName}`,
        body: `${when}${m.notes ? ` · ${m.notes}` : " · Best of 3 · games to 11"}. Tap to open the listing, scout the host, and join if it’s a fit.`,
        playerId: m.hostId,
        playerName: host?.name ?? "Host",
        matchId: m.id,
        at: m.createdAt ?? m.preferredAt,
        likes: [],
        comments: [],
      };
    });

  const locked = matches
    .filter(
      (m) =>
        (m.status === "scheduled" || m.status === "matched") &&
        !!m.opponentId,
    )
    .slice(0, 6)
    .map((m) => {
      const host = byId.get(m.hostId);
      const opp = m.opponentId ? byId.get(m.opponentId) : undefined;
      const when = formatLocalWhen(m.scheduledAt ?? m.preferredAt);
      return {
        id: `auto-match-${m.id}`,
        kind: "scheduled" as const,
        headline: `Game locked · ${m.courtName}`,
        body: `${host?.name ?? "Host"} vs ${opp?.name ?? "opponent"} · ${when}`,
        playerId: m.hostId,
        playerName: host?.name ?? "Host",
        opponentId: m.opponentId,
        opponentName: opp?.name,
        matchId: m.id,
        at: m.scheduledAt ?? m.preferredAt,
        likes: [],
        comments: [],
      };
    });

  return [...open, ...locked];
}

function postsFromStreaks(players: Player[]): FeedPost[] {
  return players
    .filter((p) => (p.streak ?? 0) >= 3)
    .slice(0, 5)
    .map((p) => ({
      id: `auto-streak-${p.id}-${p.streak}`,
      kind: "streak" as const,
      headline: `${p.name} is on a ${p.streak}-game win streak`,
      body: `Rated 1v1 only. ${displayRating(p.rating)} · ${p.wins}W–${p.losses}L. The board is watching.`,
      playerId: p.id,
      playerName: p.name,
      at: p.lastPlayedAt ?? new Date().toISOString(),
      likes: [],
      comments: [],
    }));
}

export function CommunityMediaFeed({
  me,
  players,
  matches,
  onOpenPlayer,
  onViewMatch,
  onViewCourt,
}: {
  me: Player;
  players: Player[];
  matches: Match[];
  onOpenPlayer?: (p: Player) => void;
  /** Jump to Play tab and open this listing */
  onViewMatch?: (matchId: string) => void;
  /** Jump to Courts for a pickup post */
  onViewCourt?: (courtId: string) => void;
}) {
  const posts = useMediaFeed((s) => s.posts);
  const createPost = useMediaFeed((s) => s.createPost);
  const toggleLike = useMediaFeed((s) => s.toggleLike);
  const addComment = useMediaFeed((s) => s.addComment);
  const store = useUpsetStore();

  const [composerOpen, setComposerOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [mediaUrl, setMediaUrl] = useState<string | undefined>();
  const [mediaType, setMediaType] = useState<"image" | "video" | undefined>();
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [commentFor, setCommentFor] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  /** postIds with comments fully expanded (IG “View all comments”) */
  const [expandedComments, setExpandedComments] = useState<Set<string>>(
    () => new Set(),
  );
  const fileRef = useRef<HTMLInputElement>(null);
  const draftRef = useRef<HTMLTextAreaElement>(null);
  const commentRef = useRef<HTMLInputElement>(null);
  const [draftCaret, setDraftCaret] = useState(0);
  const [commentCaret, setCommentCaret] = useState(0);
  const notices = useMediaFeed((s) => s.notices);
  const markNoticesRead = useMediaFeed((s) => s.markNoticesRead);

  const mentionables = useMemo(
    () =>
      players.map((p) => ({ id: p.id, name: p.name, handle: p.handle })),
    [players],
  );

  const draftMention = useMemo(
    () => getMentionQuery(draft, draftCaret),
    [draft, draftCaret],
  );
  const draftSuggestions = useMemo(() => {
    if (!draftMention) return [];
    return filterMentionCandidates(mentionables, draftMention.query, me.id);
  }, [draftMention, mentionables, me.id]);

  const commentMention = useMemo(
    () => getMentionQuery(commentText, commentCaret),
    [commentText, commentCaret],
  );
  const commentSuggestions = useMemo(() => {
    if (!commentMention) return [];
    return filterMentionCandidates(mentionables, commentMention.query, me.id);
  }, [commentMention, mentionables, me.id]);

  const myUnread = useMemo(
    () => notices.filter((n) => n.toPlayerId === me.id && !n.read),
    [notices, me.id],
  );

  useEffect(() => {
    if (myUnread.length > 0) markNoticesRead(me.id);
  }, [myUnread.length, me.id, markNoticesRead]);

  const pickDraftMention = (p: { id: string; name: string; handle: string }) => {
    if (!draftMention) return;
    const next = applyMention(draft, draftCaret, draftMention.start, p);
    setDraft(next.text);
    setDraftCaret(next.caret);
    requestAnimationFrame(() => {
      const el = draftRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(next.caret, next.caret);
    });
  };

  const pickCommentMention = (p: { id: string; name: string; handle: string }) => {
    if (!commentMention) return;
    const next = applyMention(commentText, commentCaret, commentMention.start, p);
    setCommentText(next.text);
    setCommentCaret(next.caret);
    requestAnimationFrame(() => {
      const el = commentRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(next.caret, next.caret);
    });
  };

  const challengeFromPost = (target: Player) => {
    if (target.id === me.id) {
      setFlash("That’s you — pick someone else’s streak.");
      window.setTimeout(() => setFlash(null), 2500);
      return;
    }
    const courtId = target.homeCourtId ?? "cat-battle-bend";
    const meta = COURT_FALLBACK[courtId] ?? COURT_FALLBACK["cat-battle-bend"]!;
    const first = target.name.split(" ")[0] ?? target.name;

    // Already have a live game with them? Jump to it.
    const existing = store.matches.find((m) => {
      if (
        m.status !== "scheduled" &&
        m.status !== "matched" &&
        m.status !== "open"
      )
        return false;
      return (
        (m.hostId === me.id && m.opponentId === target.id) ||
        (m.hostId === target.id && m.opponentId === me.id)
      );
    });
    if (existing) {
      setFlash(`You already have a game with ${first} — opening it.`);
      window.setTimeout(() => setFlash(null), 2500);
      if (onViewMatch) onViewMatch(existing.id);
      else onOpenPlayer?.(target);
      return;
    }

    const r = store.challengePlayer(target.id, {
      courtId,
      courtName: meta.name,
      lat: meta.lat,
      lon: meta.lon,
      preferredAt: new Date(Date.now() + 3600e3).toISOString(),
      notes: `Streak challenge · end the ${target.streak ?? 0}-game run · ${me.name}`,
    });

    if (r.ok) {
      setFlash(`Opening ${first}’s listing — join only if you want it.`);
      window.setTimeout(() => setFlash(null), 2800);
      // Detail only — do NOT auto-accept / match
      if (onViewMatch) onViewMatch(r.match.id);
      else onOpenPlayer?.(target);
      return;
    }

    setFlash(r.reason);
    window.setTimeout(() => setFlash(null), 3200);
    // Still give a destination — open their profile to challenge / DM
    onOpenPlayer?.(target);
  };

  const feed = useMemo(() => {
    const autoMatch = postsFromMatches(matches, players);
    const autoStreak = postsFromStreaks(players);
    const storedIds = new Set(posts.map((p) => p.id));
    const auto = [...autoMatch, ...autoStreak].filter(
      (p) => !storedIds.has(p.id),
    );
    return [...posts, ...auto].sort(
      (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
    );
  }, [posts, matches, players]);

  const publish = () => {
    setError(null);
    const body = draft.trim();
    if (!body && !mediaUrl) {
      setError("Write something or add a photo/video.");
      return;
    }
    const mentionedIds = resolveMentionIds(body, mentionables);
    const id = createPost({
      authorId: me.id,
      authorName: me.name,
      text: body,
      mediaUrl,
      mediaType,
      mentionedIds,
    });
    if (!id) {
      setError("Couldn’t post — try again.");
      return;
    }
    setDraft("");
    setDraftCaret(0);
    setMediaUrl(undefined);
    setMediaType(undefined);
    setComposerOpen(false);
    if (mentionedIds.length > 0) {
      const names = mentionedIds
        .map((id) => players.find((p) => p.id === id)?.name.split(" ")[0] ?? "player")
        .join(", ");
      setFlash(`Posted · notified ${names}`);
    } else {
      setFlash("Posted to Media.");
    }
    window.setTimeout(() => setFlash(null), 2800);
  };

  const onPickFile = async (file: File | null) => {
    if (!file) return;
    setPicking(true);
    setError(null);
    try {
      const isVideo = file.type.startsWith("video/");
      // Prefer data URL for images so the post survives refresh
      if (!isVideo && file.size < 1_800_000) {
        const data = await fileToDataUrl(file);
        setMediaUrl(data);
        setMediaType("image");
      } else if (isVideo && file.size < 8_000_000) {
        const data = await fileToDataUrl(file);
        setMediaUrl(data);
        setMediaType("video");
      } else {
        // Fall back to blob preview (session only)
        setMediaUrl(URL.createObjectURL(file));
        setMediaType(isVideo ? "video" : "image");
      }
    } catch {
      setError("Couldn’t load that file.");
    } finally {
      setPicking(false);
    }
  };

  return (
    <div className="space-y-3 pb-8">

      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-[0.12em] text-court uppercase">
            Media
          </p>
          <p className="text-[11px] text-fg-muted">
            Wins · upsets · streaks · locked games · your posts
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setComposerOpen(true);
            setError(null);
          }}
          className="inline-flex shrink-0 items-center gap-1 rounded-full bg-court px-3 py-1.5 text-xs font-semibold text-white"
        >
          <Plus className="size-3.5" strokeWidth={2.5} />
          Post
        </button>
      </div>

      <CampaignBanner />

      {flash ? (
        <p
          className="sticky top-0 z-10 rounded-lg border border-court/30 bg-court px-3 py-2.5 text-xs font-semibold text-white shadow-sm"
          role="status"
        >
          {flash}
        </p>
      ) : null}

      {myUnread.length > 0 ? (
        <div className="rounded-xl border border-border bg-bg-elevated px-3 py-2.5">
          <p className="text-[10px] font-bold tracking-wide text-court uppercase">
            For you
          </p>
          <ul className="mt-1 space-y-1.5">
            {myUnread.slice(0, 5).map((n) => (
              <li key={n.id} className="text-xs text-fg-muted">
                {n.kind === "pickup_invite" ? (
                  <>
                    <span className="font-semibold text-fg">
                      {n.fromPlayerName}
                    </span>{" "}
                    invited you to pickup
                    {n.courtName ? (
                      <span className="font-semibold text-emerald-400">
                        {" "}
                        · {n.courtName}
                      </span>
                    ) : null}
                    {n.courtId && onViewCourt ? (
                      <button
                        type="button"
                        onClick={() => onViewCourt(n.courtId!)}
                        className="ml-1 font-semibold text-court underline underline-offset-2"
                      >
                        View court
                      </button>
                    ) : null}
                  </>
                ) : (
                  <>
                    <span className="font-semibold text-fg">
                      {n.fromPlayerName}
                    </span>{" "}
                    tagged you
                    {n.snippet ? (
                      <span className="text-fg-subtle"> · “{n.snippet}”</span>
                    ) : null}
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {composerOpen ? (
        <div className="space-y-2 rounded-2xl border border-border bg-bg-elevated p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-fg">Share with ATX</p>
            <button
              type="button"
              onClick={() => {
                setComposerOpen(false);
                setDraft("");
                setMediaUrl(undefined);
                setMediaType(undefined);
                setError(null);
              }}
              className="p-1 text-fg-muted"
              aria-label="Close composer"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="relative">
            <div className="relative rounded-xl border border-border bg-bg focus-within:border-court">
              <MentionHighlightLayer text={draft} players={players} multiline />
              <textarea
                ref={draftRef}
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  setDraftCaret(e.target.selectionStart ?? e.target.value.length);
                }}
                onKeyUp={(e) =>
                  setDraftCaret(
                    (e.target as HTMLTextAreaElement).selectionStart ?? 0,
                  )
                }
                onClick={(e) =>
                  setDraftCaret(
                    (e.target as HTMLTextAreaElement).selectionStart ?? 0,
                  )
                }
                onSelect={(e) =>
                  setDraftCaret(
                    (e.target as HTMLTextAreaElement).selectionStart ?? 0,
                  )
                }
                rows={3}
                placeholder="What’s going on in ATX…"
                className="relative z-[1] w-full resize-none bg-transparent px-3 py-2.5 text-sm leading-normal text-transparent outline-none placeholder:text-fg-subtle"
                style={{ WebkitTextFillColor: "transparent", caretColor: "var(--color-fg, #111)" }}
              />
            </div>
            {draftSuggestions.length > 0 ? (
              <div className="absolute inset-x-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-xl border border-border bg-bg-elevated py-1 shadow-lg">
                <p className="px-3 py-1 text-[10px] font-bold tracking-wide text-fg-subtle uppercase">
                  Tag a player
                </p>
                {draftSuggestions.map((p) => {
                  const full = players.find((x) => x.id === p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        pickDraftMention(p);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-bg-subtle"
                    >
                      {full ? (
                        <PlayerAvatar player={full} size="sm" className="!size-7" />
                      ) : (
                        <div className="size-7 rounded-full bg-bg-subtle" />
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-fg">
                          {p.name}
                        </p>
                        <p className="truncate text-[11px] text-fg-muted">
                          @{p.handle}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
          {mediaUrl ? (
            <div className="relative overflow-hidden rounded-xl border border-border">
              {mediaType === "video" ? (
                <video
                  src={mediaUrl}
                  controls
                  className="max-h-56 w-full bg-black object-contain"
                />
              ) : (
                <img
                  src={mediaUrl}
                  alt=""
                  className="max-h-56 w-full object-cover"
                />
              )}
              <button
                type="button"
                onClick={() => {
                  setMediaUrl(undefined);
                  setMediaType(undefined);
                }}
                className="absolute top-2 right-2 rounded-full bg-black/55 p-1.5 text-white"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ) : null}
          {error ? (
            <p className="text-xs text-danger" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={(e) => {
                void onPickFile(e.target.files?.[0] ?? null);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={picking}
              className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1.5 text-[11px] font-semibold text-fg-muted disabled:opacity-60"
            >
              <ImagePlus className="size-3.5" />
              Photo
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={picking}
              className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1.5 text-[11px] font-semibold text-fg-muted disabled:opacity-60"
            >
              <Video className="size-3.5" />
              Video
            </button>
            <button
              type="button"
              onClick={publish}
              disabled={picking || (!draft.trim() && !mediaUrl)}
              className={cn(
                "ml-auto rounded-full px-3.5 py-1.5 text-xs font-semibold",
                draft.trim() || mediaUrl
                  ? "bg-fg text-bg"
                  : "bg-bg-subtle text-fg-subtle",
              )}
            >
              Share
            </button>
          </div>
        </div>
      ) : null}

      {feed.length === 0 ? (
        <div className="rounded-2xl border border-border bg-bg-elevated px-4 py-10 text-center">
          <p className="text-sm text-fg-muted">No posts yet.</p>
          <button
            type="button"
            onClick={() => setComposerOpen(true)}
            className="mt-2 text-sm font-semibold text-court"
          >
            Be first to post
          </button>
        </div>
      ) : (
        feed.map((post) => {
          const liked = post.likes.includes(me.id);
          const author =
            players.find((p) => p.id === post.playerId) ??
            (post.playerId === me.id ? me : null);
          // Auto match/streak cards are ephemeral — only store posts take likes
          const canEngage = posts.some((p) => p.id === post.id);

          return (
            <article
              key={post.id}
              className="rounded-2xl border border-border bg-bg-elevated p-3.5 pb-3.5"
            >
              <div className="flex items-start gap-2.5">
                {author ? (
                  <button
                    type="button"
                    onClick={() => onOpenPlayer?.(author)}
                    className="shrink-0"
                  >
                    <PlayerAvatar player={author} size="sm" />
                  </button>
                ) : (
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-court-soft text-court">
                    <Trophy className="size-4" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <KindPill kind={post.kind} />
                    <span className="text-[11px] font-semibold text-fg">
                      {post.playerName}
                    </span>
                  </div>
                  <h4 className="mt-1 text-sm font-semibold leading-snug text-fg">
                    {post.headline}
                  </h4>
                  {post.kind !== "hooping" ? (
                    <p className="mt-1 text-sm leading-relaxed text-fg-muted">
                      <MentionText
                        text={post.body}
                        players={players}
                        onOpenPlayer={onOpenPlayer}
                      />
                    </p>
                  ) : null}
                  {(post.mentionedIds?.length ?? 0) > 0 ? (
                    <p className="mt-1 text-[10px] text-fg-subtle">
                      Tagged{" "}
                      {post.mentionedIds!
                        .map(
                          (id) =>
                            players.find((x) => x.id === id)?.name.split(" ")[0] ??
                            "player",
                        )
                        .join(", ")}
                    </p>
                  ) : null}
                  {post.kind === "hooping" && post.mediaUrl ? (
                    <div className="relative mt-2 overflow-hidden rounded-xl border border-emerald-500/25 bg-bg-subtle">
                      {/* Court primary photo as hero */}
                      <div className="relative aspect-[16/10] w-full">
                        <img
                          src={post.courtImageUrl || post.mediaUrl}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-black/10" />
                        <span className="absolute top-2.5 left-2.5 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold tracking-wide text-white uppercase shadow-sm">
                          Hooping now
                        </span>
                        {post.courtName ? (
                          <p className="absolute right-2.5 bottom-2.5 max-w-[60%] text-right text-[13px] font-semibold text-white drop-shadow">
                            {post.courtName}
                          </p>
                        ) : null}
                        {/* User-submitted pickup photo */}
                        <div className="absolute bottom-2.5 left-2.5">
                          <img
                            src={post.mediaUrl}
                            alt=""
                            className="size-[4.75rem] rounded-2xl border-2 border-white object-cover shadow-lg"
                          />
                        </div>
                      </div>
                      <div className="space-y-1 px-3 py-2.5">
                        <p className="text-[13px] font-semibold leading-snug text-fg">
                          {post.body}
                        </p>
                        <p className="text-[12px] text-fg-muted">
                          <span className="font-medium text-fg">
                            {post.playerName}
                          </span>
                          <span className="text-fg-subtle"> · confirmed pickup</span>
                        </p>
                      </div>
                    </div>
                  ) : post.mediaUrl ? (
                    <div className="mt-2 overflow-hidden rounded-xl border border-border bg-bg-subtle">
                      {post.mediaType === "video" ? (
                        <video
                          src={post.mediaUrl}
                          controls
                          className="max-h-64 w-full object-contain"
                        />
                      ) : (
                        <img
                          src={post.mediaUrl}
                          alt=""
                          className="max-h-64 w-full object-cover"
                        />
                      )}
                    </div>
                  ) : null}
                  <p className="mt-1.5 text-[10px] text-fg-subtle">
                    {new Date(post.at).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>

              {post.kind === "streak" &&
              author &&
              author.id !== me.id ? (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => challengeFromPost(author)}
                    className="flex w-full items-center justify-center gap-2 rounded-full bg-court py-2.5 text-sm font-semibold text-white shadow-sm active:scale-[0.99]"
                  >
                    <Swords className="size-4" strokeWidth={2.25} />
                    Challenge {author.name.split(" ")[0]} · end the streak
                  </button>
                </div>
              ) : null}

              {post.kind === "open" && post.matchId && onViewMatch ? (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => onViewMatch(post.matchId!)}
                    className="flex w-full items-center justify-center gap-2 rounded-full bg-fg py-2.5 text-sm font-semibold text-bg shadow-sm active:scale-[0.99]"
                  >
                    <Zap className="size-4" strokeWidth={2.25} />
                    {post.playerId === me.id
                      ? "View your listing on Play"
                      : "View listing · see if it’s a fit"}
                  </button>
                </div>
              ) : null}

              {post.kind === "scheduled" && post.matchId && onViewMatch ? (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => onViewMatch(post.matchId!)}
                    className="flex w-full items-center justify-center gap-2 rounded-full border border-border bg-bg-elevated py-2.5 text-sm font-semibold text-fg active:scale-[0.99]"
                  >
                    <Zap className="size-4 text-court" strokeWidth={2.25} />
                    View game on Play
                  </button>
                </div>
              ) : null}

              {post.kind === "hooping" && post.courtId && onViewCourt ? (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => onViewCourt(post.courtId!)}
                    className="flex w-full items-center justify-center gap-2 rounded-full bg-emerald-600 py-2.5 text-sm font-semibold text-white shadow-sm active:scale-[0.99]"
                  >
                    <Zap className="size-4" strokeWidth={2.25} />
                    {post.courtName
                      ? `See pickup · ${post.courtName}`
                      : "See pickup on Courts"}
                  </button>
                </div>
              ) : null}

              <div className="mt-2 flex items-center gap-3 border-t border-border pt-2">
                <button
                  type="button"
                  disabled={!canEngage}
                  onClick={() => canEngage && toggleLike(post.id, me.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 text-xs font-semibold",
                    liked ? "text-court" : "text-fg-muted",
                    !canEngage && "opacity-50",
                  )}
                >
                  <Heart
                    className={cn("size-3.5", liked && "fill-current")}
                    strokeWidth={2}
                  />
                  {post.likes.length}
                </button>
                <button
                  type="button"
                  disabled={!canEngage}
                  onClick={() =>
                    canEngage &&
                    setCommentFor((id) => (id === post.id ? null : post.id))
                  }
                  className={cn(
                    "inline-flex items-center gap-1.5 text-xs font-semibold text-fg-muted",
                    !canEngage && "opacity-50",
                  )}
                >
                  <MessageCircle className="size-3.5" strokeWidth={2} />
                  {post.comments.length}
                </button>
              </div>

              {/* IG / FB style: like row → view-all → preview comments → composer */}
              {post.comments.length > 0 ? (
                <div className="mt-1.5 space-y-1.5">
                  {post.comments.length > COMMENT_PREVIEW &&
                  !expandedComments.has(post.id) ? (
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedComments((prev) => {
                          const next = new Set(prev);
                          next.add(post.id);
                          return next;
                        })
                      }
                      className="text-left text-xs font-medium text-fg-muted"
                    >
                      View all {post.comments.length} comments
                    </button>
                  ) : post.comments.length > COMMENT_PREVIEW &&
                    expandedComments.has(post.id) ? (
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedComments((prev) => {
                          const next = new Set(prev);
                          next.delete(post.id);
                          return next;
                        })
                      }
                      className="text-left text-xs font-medium text-fg-muted"
                    >
                      Hide comments
                    </button>
                  ) : null}

                  <div className="space-y-1.5">
                    {(expandedComments.has(post.id)
                      ? post.comments
                      : post.comments.slice(-COMMENT_PREVIEW)
                    ).map((c) => {
                      const cAuthor =
                        players.find((p) => p.id === c.authorId) ??
                        (c.authorId === me.id ? me : null);
                      return (
                        <div key={c.id} className="flex items-start gap-2">
                          {cAuthor ? (
                            <button
                              type="button"
                              onClick={() => onOpenPlayer?.(cAuthor)}
                              className="mt-0.5 shrink-0"
                              aria-label={`${cAuthor.name} profile`}
                            >
                              <PlayerAvatar
                                player={cAuthor}
                                size="xs"
                                showRank
                                showElite
                              />
                            </button>
                          ) : (
                            <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-bg-subtle text-[10px] font-bold text-fg-muted ring-1 ring-border">
                              {(c.authorName ?? "?")
                                .split(" ")
                                .map((w) => w[0])
                                .join("")
                                .slice(0, 2)
                                .toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0 flex-1 pt-0.5">
                            {/* IG: name + body on one flowing block */}
                            <p className="text-xs leading-snug text-fg">
                              <button
                                type="button"
                                onClick={() =>
                                  cAuthor && onOpenPlayer?.(cAuthor)
                                }
                                className="mr-1 font-semibold hover:text-court"
                              >
                                {c.authorName}
                              </button>
                              <span className="text-fg-muted">
                                <MentionText
                                  text={c.text}
                                  players={players}
                                  onOpenPlayer={onOpenPlayer}
                                />
                              </span>
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {/* Always-available “Add a comment…” like IG (opens composer) */}
              {canEngage && commentFor !== post.id ? (
                <button
                  type="button"
                  onClick={() => setCommentFor(post.id)}
                  className="mt-1.5 flex w-full items-center gap-2 text-left"
                >
                  <PlayerAvatar
                    player={me}
                    size="xs"
                    showRank
                    showElite
                    className="shrink-0"
                  />
                  <span className="flex-1 rounded-full border border-border bg-bg px-3 py-2 text-xs text-fg-subtle">
                    Add a comment…
                  </span>
                </button>
              ) : null}

              {commentFor === post.id && canEngage ? (
                <div className="relative mt-1.5 space-y-1.5">
                  {commentSuggestions.length > 0 ? (
                    <div className="max-h-40 overflow-y-auto rounded-xl border border-border bg-bg-elevated py-1 shadow-md">
                      {commentSuggestions.map((p) => {
                        const full = players.find((x) => x.id === p.id);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              pickCommentMention(p);
                            }}
                            className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left hover:bg-bg-subtle"
                          >
                            {full ? (
                              <PlayerAvatar
                                player={full}
                                size="sm"
                                className="!size-6"
                              />
                            ) : null}
                            <span className="truncate text-xs font-semibold">
                              {p.name}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                  <div className="flex items-center gap-2">
                    <PlayerAvatar
                      player={me}
                      size="xs"
                      showRank
                      showElite
                      className="shrink-0"
                    />
                    <div className="relative h-10 min-w-0 flex-1 rounded-full border border-border bg-bg focus-within:border-court">
                      <MentionHighlightLayer
                        text={commentText}
                        players={players}
                      />
                      <input
                        ref={commentRef}
                        value={commentText}
                        autoFocus
                        onChange={(e) => {
                          setCommentText(e.target.value);
                          setCommentCaret(
                            e.target.selectionStart ?? e.target.value.length,
                          );
                        }}
                        onKeyUp={(e) =>
                          setCommentCaret(
                            (e.target as HTMLInputElement).selectionStart ?? 0,
                          )
                        }
                        onClick={(e) =>
                          setCommentCaret(
                            (e.target as HTMLInputElement).selectionStart ?? 0,
                          )
                        }
                        onSelect={(e) =>
                          setCommentCaret(
                            (e.target as HTMLInputElement).selectionStart ?? 0,
                          )
                        }
                        placeholder="Add a comment…"
                        className="relative z-[1] h-full w-full rounded-full bg-transparent px-3 text-sm text-transparent outline-none placeholder:text-fg-subtle"
                        style={{
                          WebkitTextFillColor: "transparent",
                          caretColor: "var(--color-fg, #111)",
                        }}
                        onKeyDown={(e) => {
                          if (
                            e.key === "Enter" &&
                            commentSuggestions.length === 0
                          ) {
                            const mids = resolveMentionIds(
                              commentText,
                              mentionables,
                            );
                            addComment(
                              post.id,
                              me.id,
                              me.name,
                              commentText,
                              mids,
                            );
                            setCommentText("");
                            setCommentCaret(0);
                            setExpandedComments((prev) => {
                              const next = new Set(prev);
                              next.add(post.id);
                              return next;
                            });
                          }
                          if (e.key === "Escape") {
                            setCommentFor(null);
                            setCommentText("");
                          }
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const mids = resolveMentionIds(
                          commentText,
                          mentionables,
                        );
                        addComment(
                          post.id,
                          me.id,
                          me.name,
                          commentText,
                          mids,
                        );
                        setCommentText("");
                        setCommentCaret(0);
                        setExpandedComments((prev) => {
                          const next = new Set(prev);
                          next.add(post.id);
                          return next;
                        });
                      }}
                      className="text-xs font-semibold text-court disabled:text-fg-subtle"
                      disabled={!commentText.trim()}
                    >
                      Post
                    </button>
                  </div>
                </div>
              ) : null}

            </article>
          );
        })
      )}
    </div>
  );
}
