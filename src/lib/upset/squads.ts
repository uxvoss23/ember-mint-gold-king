import { create } from "zustand";
import { persist } from "zustand/middleware";

export type SquadSize = 3 | 5;

export interface SquadMember {
  playerId: string;
  role: "captain" | "member";
  status: "active" | "invited";
}

export interface Squad {
  id: string;
  name: string;
  logo: string; // emoji or short code
  size: SquadSize;
  homeCourtId: string;
  homeCourtName: string;
  captainId: string;
  members: SquadMember[];
  record: { wins: number; losses: number; pointsFor: number; pointsAgainst: number };
  /** City squad rank last week (1 = best) */
  rankLastWeek: number;
  /** Current win streak (positive only for hottest) */
  streak: number;
  createdAt: string;
}

export interface SquadChallenge {
  id: string;
  fromSquadId: string;
  toSquadId: string;
  status: "pending" | "accepted" | "declined" | "played";
  at: string;
  courtName?: string;
}

interface SquadsState {
  mySquadId: string | null;
  squads: Squad[];
  challenges: SquadChallenge[];
  createSquad: (input: {
    name: string;
    logo: string;
    size: SquadSize;
    homeCourtId: string;
    homeCourtName: string;
    captainId: string;
  }) => Squad;
  inviteMember: (squadId: string, playerId: string) => void;
  acceptInvite: (squadId: string, playerId: string) => void;
  challengeSquad: (fromSquadId: string, toSquadId: string, courtName?: string) => void;
  respondChallenge: (
    challengeId: string,
    status: "accepted" | "declined",
  ) => void;
}

const SEED_SQUADS: Squad[] = [
  {
    id: "sq-east",
    name: "East Side Run",
    logo: "🔥",
    size: 5,
    homeCourtId: "cat-givens",
    homeCourtName: "Givens District Park",
    captainId: "p-sean",
    members: [
      { playerId: "p-sean", role: "captain", status: "active" },
      { playerId: "p-marcus", role: "member", status: "active" },
      { playerId: "p-jia", role: "member", status: "active" },
      { playerId: "p-kai", role: "member", status: "active" },
      { playerId: "p-devon", role: "member", status: "active" },
    ],
    record: { wins: 12, losses: 4, pointsFor: 148, pointsAgainst: 102 },
    rankLastWeek: 2,
    streak: 4,
    createdAt: "2026-06-01T12:00:00.000Z",
  },
  {
    id: "sq-south",
    name: "Battle Bend",
    logo: "⚡",
    size: 3,
    homeCourtId: "cat-battle-bend",
    homeCourtName: "Battle Bend Springs",
    captainId: "p-riley",
    members: [
      { playerId: "p-riley", role: "captain", status: "active" },
      { playerId: "p-cam", role: "member", status: "active" },
      { playerId: "p-tess", role: "member", status: "active" },
    ],
    record: { wins: 8, losses: 3, pointsFor: 96, pointsAgainst: 78 },
    rankLastWeek: 1,
    streak: 2,
    createdAt: "2026-07-01T12:00:00.000Z",
  },
  {
    id: "sq-zilker",
    name: "Zilker 5",
    logo: "🏀",
    size: 5,
    homeCourtId: "cat-zilker",
    homeCourtName: "Zilker Park",
    captainId: "p-andre",
    members: [
      { playerId: "p-andre", role: "captain", status: "active" },
      { playerId: "p-noah", role: "member", status: "active" },
      { playerId: "p-sam", role: "member", status: "active" },
    ],
    record: { wins: 5, losses: 6, pointsFor: 88, pointsAgainst: 94 },
    rankLastWeek: 4,
    streak: 0,
    createdAt: "2026-07-15T12:00:00.000Z",
  },
  {
    id: "sq-riverside",
    name: "Riverside Trios",
    logo: "🌊",
    size: 3,
    homeCourtId: "cat-zilker",
    homeCourtName: "Zilker Park",
    captainId: "p-jia",
    members: [
      { playerId: "p-jia", role: "captain", status: "active" },
      { playerId: "p-noah", role: "member", status: "active" },
      { playerId: "p-sam", role: "member", status: "active" },
    ],
    record: { wins: 9, losses: 5, pointsFor: 110, pointsAgainst: 98 },
    rankLastWeek: 2,
    streak: 3,
    createdAt: "2026-07-20T12:00:00.000Z",
  },
];

function uid(p: string) {
  return `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export const useSquads = create<SquadsState>()(
  persist(
    (set, get) => ({
      mySquadId: null,
      squads: SEED_SQUADS,
      challenges: [],
      createSquad: (input) => {
        const squad: Squad = {
          id: uid("sq"),
          name: input.name.trim(),
          logo: input.logo,
          size: input.size,
          homeCourtId: input.homeCourtId,
          homeCourtName: input.homeCourtName,
          captainId: input.captainId,
          members: [
            {
              playerId: input.captainId,
              role: "captain",
              status: "active",
            },
          ],
          record: { wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 },
          rankLastWeek: 99,
          streak: 0,
          createdAt: new Date().toISOString(),
        };
        set((s) => ({
          squads: [squad, ...s.squads.filter((x) => x.captainId !== input.captainId)],
          mySquadId: squad.id,
        }));
        return squad;
      },
      inviteMember: (squadId, playerId) => {
        set((s) => ({
          squads: s.squads.map((sq) => {
            if (sq.id !== squadId) return sq;
            if (sq.members.some((m) => m.playerId === playerId)) return sq;
            if (sq.members.filter((m) => m.status === "active" || m.status === "invited").length >= sq.size)
              return sq;
            return {
              ...sq,
              members: [
                ...sq.members,
                { playerId, role: "member", status: "invited" },
              ],
            };
          }),
        }));
      },
      acceptInvite: (squadId, playerId) => {
        set((s) => ({
          squads: s.squads.map((sq) =>
            sq.id !== squadId
              ? sq
              : {
                  ...sq,
                  members: sq.members.map((m) =>
                    m.playerId === playerId
                      ? { ...m, status: "active" as const }
                      : m,
                  ),
                },
          ),
          mySquadId: get().mySquadId ?? squadId,
        }));
      },
      challengeSquad: (fromSquadId, toSquadId, courtName) => {
        const ch: SquadChallenge = {
          id: uid("sc"),
          fromSquadId,
          toSquadId,
          status: "pending",
          at: new Date().toISOString(),
          courtName,
        };
        set((s) => ({ challenges: [ch, ...s.challenges] }));
      },
      respondChallenge: (challengeId, status) => {
        set((s) => ({
          challenges: s.challenges.map((c) =>
            c.id === challengeId ? { ...c, status } : c,
          ),
        }));
      },
    }),
    { name: "upset-squads-v3" },
  ),
);
