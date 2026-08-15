import { useState } from "react";
import { Heart, Wrench } from "lucide-react";
import type { Court } from "@/lib/courts/types";
import { courtImagesFor } from "@/lib/courts/images";
import { useFavorites } from "@/lib/courts/favorites";
import {
  mergeCourtWithOverride,
  useCourtAdmin,
} from "@/lib/courts/admin-overrides";
import { isAdminEmail } from "@/lib/auth/admin";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { ImageCarousel } from "@/components/image-carousel";
import { WorkOrderPopup } from "@/components/work-order-popup";
import { AdminEditCourtButton } from "@/components/admin-court-editor";
import { cn, formatDistance } from "@/lib/utils";

const AMENITY_SHORT: Record<string, string> = {
  lights: "Lights",
  shade: "Shaded",
  parking: "Parking",
  multiple: "Multi",
  water: "Water",
  fence: "Fenced",
  full_court: "Full",
  half_court: "Half",
};

interface CourtCardProps {
  court: Court;
  index: number;
  selected?: boolean;
  onSelect: (court: Court) => void;
}

/**
 * Photo-first court card: full-bleed carousel, thin footer with
 * distance · area · amenities. Actions live in the footer, not on the photo.
 */
export function CourtCard({ court, index, selected, onSelect }: CourtCardProps) {
  const favorites = useFavorites();
  const authUser = useCurrentUser();
  const admin = isAdminEmail(authUser?.primaryEmail);
  const ov = useCourtAdmin((s) => s.overrides[court.id]);
  const display = mergeCourtWithOverride(court, ov);
  const [woOpen, setWoOpen] = useState(false);
  const isFav = favorites.ids.includes(court.id);
  const images = courtImagesFor(court.id, 4, ov?.photos);

  const amenityBits = (display.amenities ?? [])
    .filter((a) => AMENITY_SHORT[a])
    .slice(0, 2)
    .map((a) => AMENITY_SHORT[a]);
  if (display.hoops != null && display.hoops > 0) {
    amenityBits.push(
      `${display.hoops} hoop${display.hoops === 1 ? "" : "s"}`,
    );
  }

  return (
    <article
      className={cn(
        "group overflow-hidden rounded-2xl border bg-bg-elevated shadow-card transition-[border-color,transform] duration-200",
        selected
          ? "border-court/55 ring-1 ring-court/25"
          : "border-white/[0.06] hover:border-white/[0.12]",
      )}
    >
      <button
        type="button"
        onClick={() => onSelect(display)}
        className="relative block w-full text-left"
        aria-label={`Open ${display.name}`}
      >
        <ImageCarousel
          images={images}
          alt={display.name}
          className="aspect-[16/10]"
          priority={index < 2}
        />
        {/* Distance pill on photo — only location cue */}
        <div className="pointer-events-none absolute bottom-2 left-2 z-10">
          <span className="rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-white backdrop-blur-sm">
            {formatDistance(display.distanceMeters)}
          </span>
        </div>
      </button>

      <div className="flex items-start gap-2 px-3 py-2.5">
        <button
          type="button"
          onClick={() => onSelect(display)}
          className="min-w-0 flex-1 text-left"
        >
          <h2 className="truncate font-display text-[15px] font-semibold tracking-tight text-fg">
            {display.name}
          </h2>
          <p className="mt-0.5 truncate text-[12px] text-fg-muted">
            {display.neighborhood ? (
              <span className="font-medium text-fg">{display.neighborhood}</span>
            ) : (
              "Austin"
            )}
            {amenityBits.length > 0 ? (
              <span className="text-fg-subtle">
                {" · "}
                {amenityBits.join(" · ")}
              </span>
            ) : null}
          </p>
        </button>

        <div className="flex shrink-0 items-center gap-0.5 pt-0.5">
          {admin ? <AdminEditCourtButton court={display} /> : null}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setWoOpen(true);
            }}
            className="flex size-8 items-center justify-center rounded-full text-fg-subtle transition hover:bg-bg-soft hover:text-fg"
            aria-label={`Report issue at ${display.name}`}
            title="Court issue"
          >
            <Wrench className="size-3.5" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              favorites.toggle(court.id);
            }}
            className={cn(
              "flex size-8 items-center justify-center rounded-full transition",
              isFav
                ? "text-court"
                : "text-fg-subtle hover:bg-bg-soft hover:text-fg",
            )}
            aria-label={isFav ? "Remove favorite" : "Save favorite"}
          >
            <Heart
              className={cn("size-3.5", isFav && "fill-current")}
              strokeWidth={1.75}
            />
          </button>
        </div>
      </div>

      <WorkOrderPopup
        courtId={court.id}
        courtName={display.name}
        open={woOpen}
        onClose={() => setWoOpen(false)}
      />
    </article>
  );
}
