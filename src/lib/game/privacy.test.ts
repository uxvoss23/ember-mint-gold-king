import { canMessagePlayer } from "./privacy.ts";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const base = {
  senderId: "a",
  recipientId: "b",
  recipientPrivacy: "everyone" as const,
  blocked: false,
  playedTogether: false,
};

assert(canMessagePlayer(base).ok, "everyone allows a stranger");
assert(!canMessagePlayer({ ...base, senderId: "b" }).ok, "self rejected");
assert(!canMessagePlayer({ ...base, blocked: true }).ok, "block overrides everyone");
assert(
  !canMessagePlayer({ ...base, recipientPrivacy: "nobody", playedTogether: true }).ok,
  "nobody rejects even after a game",
);
assert(
  !canMessagePlayer({ ...base, recipientPrivacy: "played", playedTogether: false }).ok,
  "played rejects unconfirmed strangers",
);
assert(
  canMessagePlayer({ ...base, recipientPrivacy: "played", playedTogether: true }).ok,
  "played allows confirmed opponents",
);
assert(
  !canMessagePlayer({
    ...base,
    recipientPrivacy: "played",
    playedTogether: true,
    blocked: true,
  }).ok,
  "block overrides played",
);

console.log("ALL PRIVACY TESTS PASSED");
