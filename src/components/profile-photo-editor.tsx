import { useRef, useState } from "react";
import { compressWorkOrderPhoto } from "@/components/work-order-popup";
import { mutationError } from "@/lib/game/client-actions";
import { cn } from "@/lib/utils";

export function ProfilePhotoEditor({
  currentUrl,
  onSave,
  busy = false,
  compact = false,
}: {
  currentUrl?: string | null;
  onSave: (photo: string | null) => Promise<void>;
  busy?: boolean;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const shown = preview ?? currentUrl ?? null;
  const dirty = preview !== null;

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      setPreview(await compressWorkOrderPhoto(file));
    } catch (err) {
      setError(mutationError(err));
    }
  };

  const run = async (photo: string | null) => {
    setSaving(true);
    setError(null);
    try {
      await onSave(photo);
      setPreview(null);
      if (inputRef.current) inputRef.current.value = "";
    } catch (err) {
      setError(mutationError(err));
    } finally {
      setSaving(false);
    }
  };

  const locked = busy || saving;

  return (
    <div className={cn(compact ? "space-y-1.5" : "space-y-3")}>
      <div className="flex items-center gap-3">
        {shown ? (
          <img
            src={shown}
            alt="Profile preview"
            className={cn(
              "rounded-full object-cover",
              compact ? "size-11" : "size-16",
            )}
          />
        ) : (
          <div
            className={cn(
              "grid place-items-center rounded-full bg-court/20 text-sm font-bold text-court",
              compact ? "size-11" : "size-16",
            )}
          >
            ?
          </div>
        )}
        <div className="min-w-0 flex-1">
          {!compact ? (
            <p className="text-sm font-semibold text-fg">Profile photo</p>
          ) : null}
          <p className="text-[11px] text-fg-muted">
            {dirty ? "Preview — save to keep it." : shown ? "Saved photo." : "No photo yet."}
          </p>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          void pick(file);
        }}
      />
      <div className={cn("grid gap-1.5", compact ? "grid-cols-3" : "grid-cols-3")}>
        <button
          type="button"
          disabled={locked}
          onClick={() => inputRef.current?.click()}
          className="h-9 rounded-lg border border-border text-[11px] font-semibold text-fg disabled:opacity-50"
        >
          {shown ? "Replace" : "Upload"}
        </button>
        <button
          type="button"
          disabled={locked || !dirty}
          onClick={() => void run(preview)}
          className="h-9 rounded-lg bg-court text-[11px] font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          disabled={locked || (!shown && !dirty)}
          onClick={() => void run(null)}
          className="h-9 rounded-lg border border-danger/40 text-[11px] font-semibold text-danger disabled:opacity-50"
        >
          Remove
        </button>
      </div>
      {error ? (
        <p className="text-[11px] font-medium text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
