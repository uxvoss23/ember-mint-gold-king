import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Camera, X } from "lucide-react";
import { compressWorkOrderPhoto } from "@/components/work-order-popup";

/**
 * Modal to start a Hooping Now session:
 * photo (required) → auto Social post + court LIVE pin.
 * No invite step.
 */
export function ConfirmPickupPopup({
  courtName,
  onSubmit,
  onClose,
}: {
  courtName: string;
  onSubmit: (input: { photoUrl: string }) => void;
  onClose: () => void;
}) {
  const [portalEl, setPortalEl] = useState<HTMLElement | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPortalEl(document.body);
  }, []);

  const pickPhoto = async (files: FileList | null) => {
    const f = files?.[0];
    if (!f || !f.type.startsWith("image/")) return;
    try {
      const url = await compressWorkOrderPhoto(f);
      setPhoto(url);
      setMsg(null);
    } catch {
      setMsg("Couldn\u2019t read that photo — try again.");
    }
  };

  const submit = () => {
    if (!photo) {
      setMsg("Photo is required.");
      return;
    }
    setBusy(true);
    try {
      onSubmit({ photoUrl: photo });
    } finally {
      setBusy(false);
    }
  };

  if (!portalEl) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Confirm pick game"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/65"
        aria-label="Close"
        onClick={onClose}
      />

      <div className="relative z-10 flex max-h-[min(88dvh,560px)] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-border-strong bg-bg shadow-soft sm:rounded-3xl">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-wide text-emerald-500 uppercase">
              Hooping now
            </p>
            <h2 className="truncate font-display text-[17px] font-semibold text-fg">
              Confirm Pick Game
            </h2>
            <p className="text-[12px] text-fg-muted">
              Confirm if you see a pick up game happening
            </p>
            <p className="truncate text-[12px] text-fg-subtle">{courtName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-bg-elevated text-fg"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-3">
          <p className="text-[12px] text-fg-muted">
            Add a photo of the run. We'll post it on Social automatically.
          </p>

          <input
            ref={photoRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              void pickPhoto(e.target.files);
              e.target.value = "";
            }}
          />

          {photo ? (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo}
                alt=""
                className="h-44 w-full rounded-2xl object-cover"
              />
              <button
                type="button"
                onClick={() => setPhoto(null)}
                className="absolute top-2 right-2 rounded-full bg-black/65 p-1.5 text-white"
                aria-label="Remove photo"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => photoRef.current?.click()}
              className="flex h-36 w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-emerald-500/40 bg-bg-elevated text-fg-muted"
            >
              <Camera className="size-6 text-emerald-500" strokeWidth={1.75} />
              <span className="text-[13px] font-semibold text-fg">
                Add photo of the run
              </span>
              <span className="text-[11px]">Required</span>
            </button>
          )}

          {msg ? <p className="text-[12px] text-danger">{msg}</p> : null}
        </div>

        <div className="flex shrink-0 gap-2 border-t border-border px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-border py-3 text-[14px] font-semibold text-fg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || !photo}
            onClick={submit}
            className="flex-[1.4] rounded-xl bg-emerald-500 py-3 text-[14px] font-semibold text-white disabled:opacity-45"
          >
            Submit
          </button>
        </div>
      </div>
    </div>,
    portalEl,
  );
}
