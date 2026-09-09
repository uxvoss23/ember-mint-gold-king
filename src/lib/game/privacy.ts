export type DmPrivacy = "everyone" | "played" | "nobody";

export const DM_PRIVACY_OPTIONS: { id: DmPrivacy; label: string; hint: string }[] = [
  { id: "everyone", label: "Anyone", hint: "Signed-in players who aren’t blocked can message you." },
  { id: "played", label: "People I’ve played", hint: "Only after a confirmed 1v1 together." },
  { id: "nobody", label: "Nobody", hint: "New messages are turned off." },
];

export function canMessagePlayer(input: {
  senderId: string;
  recipientId: string;
  recipientPrivacy: DmPrivacy;
  blocked: boolean;
  playedTogether: boolean;
}): { ok: true } | { ok: false; reason: string } {
  if (!input.senderId || !input.recipientId) {
    return { ok: false, reason: "Sign in to send a message." };
  }
  if (input.senderId === input.recipientId) {
    return { ok: false, reason: "You can’t message yourself." };
  }
  if (input.blocked) {
    return { ok: false, reason: "You can’t message that player." };
  }
  if (input.recipientPrivacy === "nobody") {
    return { ok: false, reason: "They aren’t accepting messages." };
  }
  if (input.recipientPrivacy === "played" && !input.playedTogether) {
    return { ok: false, reason: "They only accept messages from people they’ve played." };
  }
  return { ok: true };
}
