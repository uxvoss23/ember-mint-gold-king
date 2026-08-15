import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Camera, ImagePlus, Wrench, X } from "lucide-react";
import {
  useCourtSocial,
  WORK_ORDER_LABELS,
  type WorkOrderKind,
} from "@/lib/courts/social";
import { cn } from "@/lib/utils";

const KIND_ORDER: WorkOrderKind[] = [
  "new_net",
  "broken_rim",
  "broken_backboard",
  "construction",
  "event",
  "closed",
  "other",
];

const OPTIONS: { id: WorkOrderKind; label: string }[] = KIND_ORDER.map((id) => ({
  id,
  label: WORK_ORDER_LABELS[id],
}));

const CONFIRM_MSG =
  "Thank you for letting the city know. A ticket has been submitted. The mayor may be in touch with you to gather more details.";

/** Compress for localStorage-friendly court-issue photos */
export async function compressWorkOrderPhoto(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const max = 1280;
  let { width, height } = bitmap;
  if (width > max || height > max) {
    const scale = max / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.72);
}

/**
 * Court issue report sheet — pick a category (no free-text), optional photos.
 */
export function WorkOrderPopup({
  courtId,
  courtName,
  open,
  onClose,
}: {
  courtId: string;
  courtName: string;
  open: boolean;
  onClose: () => void;
}) {
  const social = useCourtSocial();
  const [kind, setKind] = useState<WorkOrderKind>("broken_rim");
  const [photos, setPhotos] = useState<string[]>([]);
  const [picking, setPicking] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);

  if (!open || typeof document === "undefined") return null;

  const onPick = async (files: FileList | File[] | null) => {
    const list = files
      ? Array.from(files).filter((f) => f.type.startsWith("image/"))
      : [];
    if (!list.length) return;
    setPicking(true);
    setMsg(null);
    try {
      const urls: string[] = [];
      for (const f of list) {
        urls.push(await compressWorkOrderPhoto(f));
      }
      setPhotos((prev) => [...prev, ...urls]);
    } catch {
      setMsg("Couldn’t read one of those photos — try again.");
    } finally {
      setPicking(false);
    }
  };

  const submit = () => {
    setSubmitting(true);
    social.addWorkOrder(courtId, kind, undefined, {
      courtName,
      reporter: "You",
      photos: photos.length ? photos : undefined,
      photoUrl: photos[0],
    });
    setMsg(CONFIRM_MSG);
    setKind("broken_rim");
    setPhotos([]);
    setSubmitting(false);
    window.setTimeout(() => {
      setMsg(null);
      onClose();
    }, 10_000);
  };

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-bg/70 backdrop-blur-sm"
        aria-label="Dismiss"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal
        aria-labelledby="wo-quick-title"
        className="slide-up relative z-10 max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-border bg-bg-elevated p-4 shadow-soft sm:rounded-2xl"
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-bold tracking-wide text-court uppercase">
              Court issue
            </p>
            <h3
              id="wo-quick-title"
              className="truncate font-display text-base font-semibold text-fg"
            >
              {courtName}
            </h3>
            <p className="mt-0.5 text-xs text-fg-muted">
              Report an issue with this court
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border text-fg-muted"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        {msg ? (
          <div
            className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-3 text-[13px] leading-relaxed text-fg"
            role="status"
          >
            {msg}
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setKind(opt.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left text-sm font-medium transition-colors",
                    kind === opt.id
                      ? "border-court bg-court-soft text-fg"
                      : "border-border bg-bg-subtle text-fg-muted",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-4 shrink-0 items-center justify-center rounded-full border-2",
                      kind === opt.id ? "border-court bg-court" : "border-border",
                    )}
                  >
                    {kind === opt.id ? (
                      <span className="size-1.5 rounded-full bg-white" />
                    ) : null}
                  </span>
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="mt-3 space-y-2">
              <p className="text-[11px] font-semibold text-fg-muted">
                Photos (optional)
              </p>
              {photos.length > 0 ? (
                <div className="grid grid-cols-3 gap-1.5">
                  {photos.map((src, i) => (
                    <div
                      key={`${i}-${src.slice(0, 20)}`}
                      className="relative aspect-square overflow-hidden rounded-lg border border-border"
                    >
                      <img src={src} alt="" className="size-full object-cover" />
                      <button
                        type="button"
                        onClick={() =>
                          setPhotos((prev) => prev.filter((_, j) => j !== i))
                        }
                        className="absolute top-1 right-1 rounded-full bg-black/55 p-1 text-white"
                        aria-label="Remove photo"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
              <div className="flex gap-2">
                <input
                  ref={cameraRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    void onPick(e.target.files);
                    e.target.value = "";
                  }}
                />
                <input
                  ref={libraryRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    void onPick(e.target.files);
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  disabled={picking}
                  onClick={() => cameraRef.current?.click()}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-bg-subtle py-2.5 text-xs font-semibold text-fg disabled:opacity-60"
                >
                  <Camera className="size-3.5" />
                  Camera
                </button>
                <button
                  type="button"
                  disabled={picking}
                  onClick={() => libraryRef.current?.click()}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-bg-subtle py-2.5 text-xs font-semibold text-fg disabled:opacity-60"
                >
                  <ImagePlus className="size-3.5" />
                  {photos.length ? "Add more" : "Upload"}
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={submit}
              disabled={submitting || picking}
              className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent text-sm font-semibold text-accent-fg disabled:opacity-60"
            >
              <Wrench className="size-4" strokeWidth={2} />
              Submit court issue
            </button>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
