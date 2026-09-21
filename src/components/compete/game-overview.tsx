import type { ReactNode } from "react";
import { Calendar, Clock, MapPin } from "lucide-react";
import { ImageCarousel } from "@/components/image-carousel";
import { PlayerAvatar } from "@/components/compete/player-avatar";
import { parseLocalDateTime } from "@/components/compete/create-when-picker";
import type { Court } from "@/lib/courts/types";
import { displayRating } from "@/lib/rating/engine";
import type { Player } from "@/lib/upset/types";

function formatMiles(mi: number) {
  if (mi < 0.1) return "<0.1 mi";
  if (mi < 10) return `${mi.toFixed(1)} mi`;
  return `${Math.round(mi)} mi`;
}

function splitWhen(value: string) {
  if (!value) return { date: "Not set", time: "Not set" };
  const d = parseLocalDateTime(value);
  return {
    date: d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    }),
    time: d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    }),
  };
}

function Row({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-3">
      {icon ? (
        <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-bg text-fg-subtle">
          {icon}
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium tracking-wide text-fg-subtle">{label}</p>
        <p className="mt-0.5 text-[15px] font-semibold leading-snug text-fg">{value}</p>
      </div>
    </div>
  );
}

function PlayerSlot({ player, caption }: { player: Player; caption?: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center text-center">
      <PlayerAvatar player={player} size="lg" className="!size-14" />
      <p className="mt-2 w-full truncate text-[13px] font-semibold text-fg">
        {player.name.split(" ")[0]}
      </p>
      <p className="text-[11px] text-fg-muted">
        {displayRating(player.rating)}
        {player.wins + player.losses > 0 ? ` · ${player.wins}–${player.losses}` : ""}
      </p>
      {caption ? (
        <p className="mt-0.5 text-[10px] font-medium text-fg-subtle">{caption}</p>
      ) : null}
    </div>
  );
}

export function GameOverview({
  court,
  images,
  distanceMi,
  format,
  whenValue,
  bringingBall,
  inviteOnly,
  notes,
  me,
  invited,
  onChangeCourt,
}: {
  court: Court;
  images: string[];
  distanceMi?: number;
  format: "1v1" | "horse";
  whenValue: string;
  bringingBall: boolean | null;
  inviteOnly: boolean;
  notes?: string;
  me: Player;
  invited: Player[];
  onChangeCourt: () => void;
}) {
  const { date, time } = splitWhen(whenValue);
  const opponent = invited[0];
  const extraInvites = invited.slice(1);
  const locationBits = [
    court.neighborhood ?? "Austin",
    typeof distanceMi === "number" ? formatMiles(distanceMi) : null,
  ].filter(Boolean);

  return (
    <div className="space-y-5 pb-2">
      <section>
        <div className="overflow-hidden rounded-[1.25rem]">
          {images.length > 0 ? (
            <ImageCarousel
              images={images}
              alt={court.name}
              className="aspect-[16/10] w-full"
              priority
              allowFullscreen
            />
          ) : (
            <div className="aspect-[16/10] w-full bg-bg-subtle" />
          )}
        </div>
        <div className="mt-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h4 className="font-display truncate text-[18px] font-semibold tracking-tight text-fg">
              {court.name}
            </h4>
            <p className="mt-0.5 truncate text-[13px] text-fg-muted">
              {locationBits.join(" · ")}
            </p>
          </div>
          <button
            type="button"
            onClick={onChangeCourt}
            className="shrink-0 pt-1 text-[12px] font-semibold text-court"
          >
            Change court
          </button>
        </div>
      </section>

      <section>
        <p className="text-[11px] font-semibold tracking-wide text-fg-subtle uppercase">
          You’re playing
        </p>
        <div className="mt-3 flex items-center justify-center gap-3">
          <PlayerSlot player={me} caption="You" />
          {opponent ? (
            <>
              <span className="shrink-0 text-[11px] font-black tracking-[0.14em] text-court">
                VS
              </span>
              <PlayerSlot player={opponent} caption="Invited" />
            </>
          ) : (
            <>
              <span className="shrink-0 text-[11px] font-black tracking-[0.14em] text-fg-subtle">
                VS
              </span>
              <div className="flex min-w-0 flex-1 flex-col items-center text-center">
                <div className="grid size-14 place-items-center rounded-full border border-dashed border-border text-[11px] font-semibold text-fg-subtle">
                  Open
                </div>
                <p className="mt-2 text-[13px] font-semibold text-fg-muted">Waiting</p>
                <p className="text-[11px] text-fg-subtle">
                  {inviteOnly ? "Invite only" : "Anyone can join"}
                </p>
              </div>
            </>
          )}
        </div>
        {extraInvites.length > 0 ? (
          <p className="mt-3 text-center text-[11px] text-fg-muted">
            Also invited: {extraInvites.map((p) => p.name.split(" ")[0]).join(", ")}
          </p>
        ) : null}
      </section>

      <section className="overflow-hidden rounded-[1.25rem] bg-bg-elevated px-4">
        <Row
          label="Game type"
          value={format === "horse" ? "HORSE" : "1v1"}
        />
        <div className="h-px bg-border" />
        <Row
          label="Date"
          value={date}
          icon={<Calendar className="size-3.5" strokeWidth={2} />}
        />
        <div className="h-px bg-border" />
        <Row
          label="Time"
          value={time}
          icon={<Clock className="size-3.5" strokeWidth={2} />}
        />
        <div className="h-px bg-border" />
        <Row
          label="Court"
          value={court.name}
          icon={<MapPin className="size-3.5" strokeWidth={2} />}
        />
        <div className="h-px bg-border" />
        <Row
          label="Basketball"
          value={
            bringingBall === true
              ? "You’re bringing a ball"
              : bringingBall === false
                ? "Not bringing a ball"
                : "Not set"
          }
        />
        {notes?.trim() ? (
          <>
            <div className="h-px bg-border" />
            <Row label="Notes" value={notes.trim()} />
          </>
        ) : null}
      </section>

      <p className="px-1 text-[12px] leading-relaxed text-fg-subtle">
        {format === "horse"
          ? "HORSE · classic letters"
          : "Ranked · Best of 3 · First to 11 · Win by 2"}
      </p>
    </div>
  );
}

export function gameOverviewActive(
  courtLocked: boolean,
  step: 1 | 2 | 3,
) {
  return courtLocked ? step === 2 : step === 3;
}
