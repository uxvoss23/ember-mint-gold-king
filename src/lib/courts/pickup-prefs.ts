import { create } from "zustand";
import { persist } from "zustand/middleware";
import { haversineMeters } from "@/lib/utils";
import type { Court } from "@/lib/courts/types";
import type { Player } from "@/lib/upset/types";
import {
  type HoopCheckIn,
} from "@/lib/courts/social";

export interface PickupNotifyPrefs {
  /** User finished the signup questionnaire */
  completed: boolean;
  /** Want alerts when pickup is live nearby */
  notify: boolean;
  /** Miles from home / current area */
  radiusMi: number;
}

export interface PickupRsvp {
  checkInId: string;
  courtId: string;
  courtName: string;
  playerId: string;
  playerName: string;
  status: "going" | "dismissed";
  note?: string;
  at: string;
}

export interface PickupNotifyLog {
  playerId: string;
  courtId: string;
  checkInId: string;
  at: string;
}

interface PickupPrefsState {
  /** Per-player prefs (demo seeds + you) */
  prefsByPlayer: Record<string, PickupNotifyPrefs>;
  rsvps: PickupRsvp[];
  notifyLog: PickupNotifyLog[];
  setPrefs: (playerId: string, prefs: PickupNotifyPrefs) => void;
  getPrefs: (playerId: string) => PickupNotifyPrefs;
  respondInvite: (input: {
    checkInId: string;
    courtId: string;
    courtName: string;
    playerId: string;
    playerName: string;
    status: "going" | "dismissed";
    note?: string;
  }) => void;
  rsvpsForCheckIn: (checkInId: string) => PickupRsvp[];
  goingCount: (checkInId: string) => number;
  /**
   * After a new pickup check-in: notify opted-in players in radius.
   * One notification per player per court while that court is live.
   */
  broadcastPickup: (input: {
    checkIn: HoopCheckIn;
    court: Court;
    author: Player;
    players: Player[];
    courts: Court[];
    /** Author's GPS if known — used only for author context */
    authorLat?: number;
    authorLon?: number;
  }) => { notified: number };
}

const DEFAULT_PREFS: PickupNotifyPrefs = {
  completed: false,
  notify: false,
  radiusMi: 10,
};

/** Seed opted-in players so demo invites work */
const SEED_PREFS: Record<string, PickupNotifyPrefs> = {
  "p-you": { completed: false, notify: false, radiusMi: 10 },
  "p-cam": { completed: true, notify: true, radiusMi: 15 },
  "p-marcus": { completed: true, notify: true, radiusMi: 12 },
  "p-jia": { completed: true, notify: true, radiusMi: 8 },
  "p-riley": { completed: true, notify: true, radiusMi: 20 },
  "p-sean": { completed: true, notify: true, radiusMi: 10 },
  "p-kai": { completed: true, notify: false, radiusMi: 10 },
  "p-tess": { completed: true, notify: true, radiusMi: 6 },
  "p-devon": { completed: true, notify: true, radiusMi: 15 },
  "p-andre": { completed: true, notify: true, radiusMi: 25 },
};

function playerAnchor(
  player: Player,
  courts: Court[],
): { lat: number; lon: number } | null {
  if (player.homeCourtId) {
    const c = courts.find((x) => x.id === player.homeCourtId);
    if (c) return { lat: c.lat, lon: c.lon };
  }
  // Austin default center for players without home court
  return { lat: 30.2672, lon: -97.7431 };
}

function alreadyNotifiedForLiveCourt(
  log: PickupNotifyLog[],
  playerId: string,
  courtId: string,
  liveCheckIns: HoopCheckIn[],
): boolean {
  const liveIds = new Set(
    liveCheckIns.filter((c) => c.courtId === courtId).map((c) => c.id),
  );
  if (liveIds.size === 0) return false;
  return log.some(
    (n) =>
      n.playerId === playerId &&
      n.courtId === courtId &&
      liveIds.has(n.checkInId),
  );
}

export const usePickupPrefs = create<PickupPrefsState>()(
  persist(
    (set, get) => ({
      prefsByPlayer: { ...SEED_PREFS },
      rsvps: [],
      notifyLog: [],
      setPrefs: (playerId, prefs) =>
        set((s) => ({
          prefsByPlayer: { ...s.prefsByPlayer, [playerId]: prefs },
        })),
      getPrefs: (playerId) =>
        get().prefsByPlayer[playerId] ?? { ...DEFAULT_PREFS },
      respondInvite: ({
        checkInId,
        courtId,
        courtName,
        playerId,
        playerName,
        status,
        note,
      }) => {
        set((s) => {
          const rest = s.rsvps.filter(
            (r) => !(r.checkInId === checkInId && r.playerId === playerId),
          );
          return {
            rsvps: [
              {
                checkInId,
                courtId,
                courtName,
                playerId,
                playerName,
                status,
                note: note?.trim() || undefined,
                at: new Date().toISOString(),
              },
              ...rest,
            ],
          };
        });
      },
      rsvpsForCheckIn: (checkInId) =>
        get().rsvps.filter((r) => r.checkInId === checkInId),
      goingCount: (checkInId) =>
        get().rsvps.filter(
          (r) => r.checkInId === checkInId && r.status === "going",
        ).length,
      broadcastPickup: ({
        checkIn,
        court,
        author,
        players,
        courts,
      }) => {
        const state = get();
        // All currently live check-ins (including this one) for dedupe
        // Caller passes only this checkIn in checkIns list conceptually —
        // we treat this checkIn as live and use notifyLog against court.
        const liveForCourt: HoopCheckIn[] = [checkIn];

        const targets: Player[] = [];
        for (const p of players) {
          if (p.id === author.id) continue;
          const prefs = state.prefsByPlayer[p.id] ?? DEFAULT_PREFS;
          if (!prefs.completed || !prefs.notify) continue;
          if (
            alreadyNotifiedForLiveCourt(
              state.notifyLog,
              p.id,
              court.id,
              liveForCourt,
            )
          ) {
            continue;
          }
          // Also skip if any prior notify for this court with a still-live check-in
          // (check log entries for this court that match any recent check-in id)
          const priorForCourt = state.notifyLog.filter(
            (n) => n.playerId === p.id && n.courtId === court.id,
          );
          // If they were notified for this exact check-in already
          if (priorForCourt.some((n) => n.checkInId === checkIn.id)) continue;
          // One per court while "hooping now" window: if notified in last 3h for this court, skip
          const recent = priorForCourt.some((n) => {
            const t = new Date(n.at).getTime();
            return Date.now() - t < 3 * 60 * 60 * 1000;
          });
          if (recent) continue;

          const anchor = playerAnchor(p, courts);
          if (!anchor) continue;
          const distM = haversineMeters(
            anchor.lat,
            anchor.lon,
            court.lat,
            court.lon,
          );
          const distMi = distM / 1609.344;
          if (distMi <= prefs.radiusMi) targets.push(p);
        }

        if (targets.length > 0) {
          set((s) => ({
            notifyLog: [
              ...targets.map((t) => ({
                playerId: t.id,
                courtId: court.id,
                checkInId: checkIn.id,
                at: new Date().toISOString(),
              })),
              ...s.notifyLog,
            ].slice(0, 500),
          }));
        }

        return { notified: targets.length };
      },
    }),
    { name: "pickup-prefs-v1" },
  ),
);

export const PICKUP_RADIUS_OPTIONS = [
  1, 2, 3, 5, 8, 10, 12, 15, 20, 25,
] as const;
