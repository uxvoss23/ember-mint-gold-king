import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Camera,
  ImagePlus,
  Pencil,
  Star,
  Trash2,
  X,
} from "lucide-react";
import type { Court, CourtAmenity, CourtSurface } from "@/lib/courts/types";
import {
  mergeCourtWithOverride,
  useCourtAdmin,
  type CourtFieldOverride,
} from "@/lib/courts/admin-overrides";
import { compressWorkOrderPhoto } from "@/components/work-order-popup";
import { courtImagesFor } from "@/lib/courts/images";
import { cn } from "@/lib/utils";

const SURFACES: CourtSurface[] = ["concrete", "asphalt", "rubber", "unknown"];
const AMENITIES: { id: CourtAmenity; label: string }[] = [
  { id: "lights", label: "Lights" },
  { id: "full_court", label: "Full court" },
  { id: "half_court", label: "Half court" },
  { id: "multiple", label: "Multi-court" },
  { id: "water", label: "Water" },
  { id: "parking", label: "Parking" },
  { id: "fence", label: "Fenced" },
  { id: "shade", label: "Shaded" },
];

/**
 * Admin-only court editor: details + dedicated preview photo + gallery.
 */
export function AdminCourtEditor({
  court,
  open,
  onClose,
}: {
  court: Court;
  open: boolean;
  onClose: () => void;
}) {
  const ov = useCourtAdmin((s) => s.overrides[court.id]);
  const setFields = useCourtAdmin((s) => s.setFields);
  const setPreview = useCourtAdmin((s) => s.setPreview);
  const addGalleryPhotos = useCourtAdmin((s) => s.addGalleryPhotos);
  const replaceGalleryPhoto = useCourtAdmin((s) => s.replaceGalleryPhoto);
  const removeGalleryPhoto = useCourtAdmin((s) => s.removeGalleryPhoto);

  const merged = mergeCourtWithOverride(court, ov);
  const [name, setName] = useState(merged.name);
  const [address, setAddress] = useState(merged.address ?? "");
  const [neighborhood, setNeighborhood] = useState(merged.neighborhood ?? "");
  const [notes, setNotes] = useState(merged.notes ?? "");
  const [surface, setSurface] = useState<CourtSurface>(merged.surface);
  const [hoops, setHoops] = useState(String(merged.hoops ?? ""));
  const [amenities, setAmenities] = useState<CourtAmenity[]>([
    ...(merged.amenities ?? []),
  ]);
  const [lightsHours, setLightsHours] = useState(merged.lightsHours ?? "");
  const [hours, setHours] = useState(merged.hours ?? "");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const previewCam = useRef<HTMLInputElement>(null);
  const previewLib = useRef<HTMLInputElement>(null);
  const galleryCam = useRef<HTMLInputElement>(null);
  const galleryLib = useRef<HTMLInputElement>(null);
  const replaceIdx = useRef<number | null>(null);
  const replaceCam = useRef<HTMLInputElement>(null);
  const replaceLib = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const m = mergeCourtWithOverride(court, ov);
    setName(m.name);
    setAddress(m.address ?? "");
    setNeighborhood(m.neighborhood ?? "");
    setNotes(m.notes ?? "");
    setSurface(m.surface);
    setHoops(String(m.hoops ?? ""));
    setAmenities([...(m.amenities ?? [])]);
    setLightsHours(m.lightsHours ?? "");
    setHours(m.hours ?? "");
    setSaved(false);
  }, [open, court.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open || typeof document === "undefined") return null;

  const photos = ov?.photos;
  const preview = photos?.preview;
  const gallery = photos?.gallery ?? [];
  // What users currently see
  const livePreview =
    preview ?? courtImagesFor(court.id, 1, photos)[0];

  const saveDetails = () => {
    const fields: CourtFieldOverride = {
      name: name.trim() || court.name,
      address: address.trim() || undefined,
      neighborhood: neighborhood.trim() || undefined,
      notes: notes.trim() || undefined,
      surface,
      hoops: hoops.trim() ? Number(hoops) : undefined,
      amenities,
      lightsHours: lightsHours.trim() || undefined,
      hours: hours.trim() || undefined,
    };
    setFields(court.id, fields);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  };

  const pickFiles = async (
    files: FileList | File[] | null,
    mode: "preview" | "gallery" | "replace",
  ) => {
    const list = files
      ? Array.from(files).filter((f) => f.type.startsWith("image/"))
      : [];
    if (!list.length) return;
    setBusy(true);
    try {
      if (mode === "preview") {
        // preview is a single dedicated slot — use first selected
        const url = await compressWorkOrderPhoto(list[0]!);
        setPreview(court.id, url);
      } else if (mode === "gallery") {
        const urls: string[] = [];
        for (const f of list) {
          urls.push(await compressWorkOrderPhoto(f));
        }
        addGalleryPhotos(court.id, urls);
      } else if (mode === "replace" && replaceIdx.current != null) {
        const url = await compressWorkOrderPhoto(list[0]!);
        replaceGalleryPhoto(court.id, replaceIdx.current, url);
        replaceIdx.current = null;
      }
    } finally {
      setBusy(false);
    }
  };

  const toggleAmenity = (id: CourtAmenity) => {
    setAmenities((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id],
    );
  };

  return createPortal(
    <div className="fixed inset-0 z-[130] flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-bg/75 backdrop-blur-sm"
        aria-label="Dismiss"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal
        className="slide-up relative z-10 flex max-h-[94dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-border bg-bg-elevated shadow-soft sm:rounded-2xl"
      >
        <div className="flex shrink-0 items-start justify-between gap-2 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold tracking-wide text-court uppercase">
              Admin · edit court
            </p>
            <h3 className="truncate font-display text-base font-semibold text-fg">
              {merged.name}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-full border border-border text-fg-muted"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-3 pb-6">
          {/* Preview slot */}
          <section>
            <div className="mb-1.5 flex items-center gap-1.5">
              <Star className="size-3.5 text-gold" strokeWidth={2} />
              <p className="text-xs font-bold text-fg">Preview photo</p>
              <span className="text-[10px] text-fg-subtle">
                · first image on cards & carousel
              </span>
            </div>
            <div className="relative overflow-hidden rounded-xl border-2 border-gold/40 bg-bg-subtle">
              {livePreview ? (
                <img
                  src={livePreview}
                  alt="Preview"
                  className="aspect-[16/10] w-full object-cover"
                />
              ) : (
                <div className="flex aspect-[16/10] items-center justify-center text-xs text-fg-muted">
                  No preview yet
                </div>
              )}
              {preview ? (
                <button
                  type="button"
                  onClick={() => setPreview(court.id, undefined)}
                  className="absolute top-2 right-2 rounded-full bg-black/55 p-1.5 text-white"
                  aria-label="Remove custom preview"
                >
                  <Trash2 className="size-3.5" />
                </button>
              ) : null}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                ref={previewCam}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  void pickFiles(e.target.files, "preview");
                  e.target.value = "";
                }}
              />
              <input
                ref={previewLib}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  void pickFiles(e.target.files, "preview");
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => previewCam.current?.click()}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-bg py-2 text-xs font-semibold"
              >
                <Camera className="size-3.5" />
                Take
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => previewLib.current?.click()}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-bg py-2 text-xs font-semibold"
              >
                <ImagePlus className="size-3.5" />
                {preview ? "Replace" : "Upload"}
              </button>
            </div>
          </section>

          {/* Gallery */}
          <section>
            <p className="mb-1.5 text-xs font-bold text-fg">
              Gallery photos{" "}
              <span className="font-normal text-fg-subtle">
                · select multiple at once
              </span>
            </p>
            <div className="grid grid-cols-3 gap-2">
              {gallery.map((src, i) => (
                <div
                  key={`${i}-${src.slice(0, 24)}`}
                  className="relative aspect-square overflow-hidden rounded-lg border border-border bg-bg-subtle"
                >
                  <img src={src} alt="" className="size-full object-cover" />
                  <div className="absolute inset-x-0 bottom-0 flex gap-0.5 bg-black/50 p-0.5">
                    <button
                      type="button"
                      className="flex-1 rounded py-0.5 text-[9px] font-bold text-white"
                      onClick={() => {
                        replaceIdx.current = i;
                        replaceLib.current?.click();
                      }}
                    >
                      Replace
                    </button>
                    <button
                      type="button"
                      className="rounded px-1.5 py-0.5 text-[9px] font-bold text-white"
                      onClick={() => removeGalleryPhoto(court.id, i)}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
              <button
                type="button"
                disabled={busy}
                onClick={() => galleryLib.current?.click()}
                className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border bg-bg-subtle text-[10px] font-semibold text-fg-muted"
              >
                <ImagePlus className="size-4" />
                Add
              </button>
            </div>
            <div className="mt-2 flex gap-2">
              <input
                ref={galleryCam}
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                className="hidden"
                onChange={(e) => {
                  void pickFiles(e.target.files, "gallery");
                  e.target.value = "";
                }}
              />
              <input
                ref={galleryLib}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  void pickFiles(e.target.files, "gallery");
                  e.target.value = "";
                }}
              />
              <input
                ref={replaceCam}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  void pickFiles(e.target.files, "replace");
                  e.target.value = "";
                }}
              />
              <input
                ref={replaceLib}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  void pickFiles(e.target.files, "replace");
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => galleryCam.current?.click()}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border py-2 text-xs font-semibold"
              >
                <Camera className="size-3.5" />
                Take for gallery
              </button>
            </div>
          </section>

          {/* Details */}
          <section className="space-y-2.5">
            <p className="text-xs font-bold text-fg">Court details</p>
            <label className="block text-[11px] font-medium text-fg-muted">
              Name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 h-10 w-full rounded-xl border border-border bg-bg px-3 text-sm text-fg outline-none focus:border-court"
              />
            </label>
            <label className="block text-[11px] font-medium text-fg-muted">
              Address
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="mt-1 h-10 w-full rounded-xl border border-border bg-bg px-3 text-sm text-fg outline-none focus:border-court"
              />
            </label>
            <label className="block text-[11px] font-medium text-fg-muted">
              Neighborhood
              <input
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                className="mt-1 h-10 w-full rounded-xl border border-border bg-bg px-3 text-sm text-fg outline-none focus:border-court"
              />
            </label>
            <label className="block text-[11px] font-medium text-fg-muted">
              Upset City description
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="mt-1 w-full resize-none rounded-xl border border-border bg-bg px-3 py-2 text-sm text-fg outline-none focus:border-court"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-[11px] font-medium text-fg-muted">
                Surface
                <select
                  value={surface}
                  onChange={(e) => setSurface(e.target.value as CourtSurface)}
                  className="mt-1 h-10 w-full rounded-xl border border-border bg-bg px-2 text-sm text-fg outline-none"
                >
                  {SURFACES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-[11px] font-medium text-fg-muted">
                Hoops
                <input
                  inputMode="numeric"
                  value={hoops}
                  onChange={(e) => setHoops(e.target.value.replace(/\D/g, ""))}
                  className="mt-1 h-10 w-full rounded-xl border border-border bg-bg px-3 text-sm text-fg outline-none focus:border-court"
                />
              </label>
            </div>
            <label className="block text-[11px] font-medium text-fg-muted">
              Lights hours
              <input
                value={lightsHours}
                onChange={(e) => setLightsHours(e.target.value)}
                placeholder="e.g. dusk–10pm"
                className="mt-1 h-10 w-full rounded-xl border border-border bg-bg px-3 text-sm text-fg outline-none focus:border-court"
              />
            </label>
            <label className="block text-[11px] font-medium text-fg-muted">
              Park hours
              <input
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                placeholder="e.g. 6am–10pm"
                className="mt-1 h-10 w-full rounded-xl border border-border bg-bg px-3 text-sm text-fg outline-none focus:border-court"
              />
            </label>
            <div>
              <p className="mb-1.5 text-[11px] font-medium text-fg-muted">
                Amenities
              </p>
              <div className="flex flex-wrap gap-1.5">
                {AMENITIES.map((a) => {
                  const on = amenities.includes(a.id);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => toggleAmenity(a.id)}
                      className={cn(
                        "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                        on
                          ? "bg-court text-white"
                          : "border border-border bg-bg-subtle text-fg-muted",
                      )}
                    >
                      {a.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        </div>

        <div className="shrink-0 border-t border-border p-3">
          <button
            type="button"
            onClick={saveDetails}
            className="flex h-11 w-full items-center justify-center rounded-xl bg-fg text-sm font-semibold text-bg"
          >
            {saved ? "Saved" : "Save court details"}
          </button>
          <p className="mt-1.5 text-center text-[10px] text-fg-subtle">
            Photos save as soon as you add or replace them.
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Small pencil control — only render for admin */
export function AdminEditCourtButton({
  court,
  className,
}: {
  court: Court;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className={cn(
          "flex size-8 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-sm hover:bg-black/50",
          className,
        )}
        aria-label={`Edit ${court.name}`}
        title="Edit court (admin)"
      >
        <Pencil className="size-3.5" strokeWidth={1.75} />
      </button>
      <AdminCourtEditor
        court={court}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
