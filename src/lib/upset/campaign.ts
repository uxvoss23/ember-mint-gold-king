import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ALZHEIMERS_CHARITY } from "@/lib/upset/stakes";

/** City-wide cause — every charity game moves this bar */
export const CAMPAIGN_GOAL_DOLLARS = 50_000;
export const CAMPAIGN_YEAR = 2026;
export const CAMPAIGN_TITLE = "Austin for Alzheimer's";
export const CAMPAIGN_CHARITY = ALZHEIMERS_CHARITY;

export interface CampaignDonation {
  id: string;
  matchId?: string;
  playerId: string;
  playerName: string;
  amount: number;
  at: string;
  note?: string;
}

interface CampaignState {
  raisedDollars: number;
  goalDollars: number;
  donations: CampaignDonation[];
  addDonation: (input: {
    amount: number;
    playerId: string;
    playerName: string;
    matchId?: string;
    note?: string;
  }) => void;
}

/** Seed so the bar doesn't start at $0 empty — feels alive */
const SEED_RAISED = 12_480;

export const useCampaign = create<CampaignState>()(
  persist(
    (set, get) => ({
      raisedDollars: SEED_RAISED,
      goalDollars: CAMPAIGN_GOAL_DOLLARS,
      donations: [
        {
          id: "don-seed-1",
          playerId: "p-sean",
          playerName: "Sean",
          amount: 13,
          at: new Date(Date.now() - 86400e3).toISOString(),
          note: "Margin gift · Givens",
        },
        {
          id: "don-seed-2",
          playerId: "p-kai",
          playerName: "Kai",
          amount: 8,
          at: new Date(Date.now() - 3600e3 * 5).toISOString(),
          note: "Charity 1v1",
        },
      ],
      addDonation: ({ amount, playerId, playerName, matchId, note }) => {
        const n = Math.round(Math.max(0, amount) * 100) / 100;
        if (n <= 0) return;
        const id = `don-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
        set({
          raisedDollars: Math.round((get().raisedDollars + n) * 100) / 100,
          donations: [
            {
              id,
              matchId,
              playerId,
              playerName,
              amount: n,
              at: new Date().toISOString(),
              note,
            },
            ...get().donations,
          ].slice(0, 200),
        });
      },
    }),
    { name: "upset-city-campaign-v1" },
  ),
);

export function campaignProgress(raised: number, goal = CAMPAIGN_GOAL_DOLLARS) {
  const pct = Math.min(100, Math.round((raised / goal) * 1000) / 10);
  const remaining = Math.max(0, goal - raised);
  return { pct, remaining };
}

export function formatCampaignMoney(n: number) {
  return n >= 1000
    ? `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
    : n % 1 === 0
      ? `$${n}`
      : `$${n.toFixed(2)}`;
}
