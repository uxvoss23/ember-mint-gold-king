import { useMemo, useState } from "react";
import { Archive, ClipboardList, Wrench } from "lucide-react";
import {
  useCourtSocial,
  WORK_ORDER_LABELS,
  WORK_ORDER_STATUS_LABELS,
  type WorkOrder,
  type WorkOrderStatus,
} from "@/lib/courts/social";
import { isAdminEmail } from "@/lib/auth/admin";
import { cn } from "@/lib/utils";

const ACTIVE_STATUSES: WorkOrderStatus[] = [
  "submitted",
  "received",
  "in_progress",
];

const ALL_STATUSES: WorkOrderStatus[] = [
  "submitted",
  "received",
  "in_progress",
  "resolved",
];

function OrderCard({
  w,
  setStatus,
  archived,
}: {
  w: WorkOrder;
  setStatus: (id: string, status: WorkOrderStatus) => void;
  archived?: boolean;
}) {
  return (
    <li className="rounded-xl border border-border bg-bg px-3 py-2.5">
      <div className="flex items-start gap-2">
        {(() => {
          const thumbs = w.photos?.length
            ? w.photos
            : w.photoUrl
              ? [w.photoUrl]
              : [];
          if (!thumbs.length) {
            return <Wrench className="mt-0.5 size-3.5 shrink-0 text-fg-muted" />;
          }
          return (
            <div className="flex shrink-0 gap-1">
              {thumbs.slice(0, 3).map((src, i) => (
                <a
                  key={i}
                  href={src}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0"
                >
                  <img
                    src={src}
                    alt=""
                    className="size-12 rounded-lg object-cover ring-1 ring-border"
                  />
                </a>
              ))}
            </div>
          );
        })()}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-fg">
            {WORK_ORDER_LABELS[w.kind]}
          </p>
          <p className="truncate text-xs text-fg-muted">
            {w.courtName ?? w.courtId}
            {w.reporter ? ` · ${w.reporter}` : ""}
          </p>
          {w.detail ? (
            <p className="mt-1 text-xs leading-snug text-fg-muted">{w.detail}</p>
          ) : null}
          <p className="mt-1 text-[10px] text-fg-subtle">
            {new Date(w.at).toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
            {(w.photos?.length ?? (w.photoUrl ? 1 : 0)) > 0 ? ` · ${w.photos?.length ?? 1} photo${(w.photos?.length ?? 1) === 1 ? "" : "s"}` : ""}
            {archived ? " · archived" : ""}
          </p>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {(archived ? ALL_STATUSES : ACTIVE_STATUSES.concat("resolved")).map(
          (st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatus(w.id, st)}
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                w.status === st
                  ? st === "resolved"
                    ? "bg-success/20 text-success"
                    : "bg-court text-white"
                  : "bg-bg-subtle text-fg-muted",
              )}
            >
              {st === "resolved" && !archived
                ? "Resolve · archive"
                : WORK_ORDER_STATUS_LABELS[st]}
            </button>
          ),
        )}
      </div>
    </li>
  );
}

/**
 * Admin-only inbox. Resolved tickets leave the active list and live under Archive.
 */
export function AdminWorkOrders({ email }: { email: string | null | undefined }) {
  const workOrders = useCourtSocial((s) => s.workOrders);
  const setStatus = useCourtSocial((s) => s.setWorkOrderStatus);
  const [view, setView] = useState<"active" | "archive">("active");

  const { active, archived } = useMemo(() => {
    const active: WorkOrder[] = [];
    const archived: WorkOrder[] = [];
    for (const w of workOrders) {
      if (w.status === "resolved") archived.push(w);
      else active.push(w);
    }
    const byDate = (a: WorkOrder, b: WorkOrder) =>
      new Date(b.at).getTime() - new Date(a.at).getTime();
    active.sort(byDate);
    archived.sort(byDate);
    return { active, archived };
  }, [workOrders]);

  if (!isAdminEmail(email)) return null;

  const list = view === "active" ? active : archived;

  return (
    <section className="rounded-2xl border border-border bg-bg-elevated p-3.5">
      <div className="mb-2.5 flex items-center gap-2">
        <div className="flex size-9 items-center justify-center rounded-full bg-court-soft text-court">
          <ClipboardList className="size-4" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold tracking-wide text-court uppercase">
            Admin only
          </p>
          <h3 className="font-display text-sm font-semibold text-fg">
            Court issues
          </h3>
        </div>
        {active.length > 0 ? (
          <span className="rounded-full bg-court px-2 py-0.5 text-[10px] font-bold text-white tabular-nums">
            {active.length} open
          </span>
        ) : null}
      </div>

      <div className="mb-3 flex gap-1 rounded-full border border-border bg-bg p-0.5">
        <button
          type="button"
          onClick={() => setView("active")}
          className={cn(
            "flex-1 rounded-full py-1.5 text-[11px] font-semibold",
            view === "active" ? "bg-fg text-bg" : "text-fg-muted",
          )}
        >
          Open ({active.length})
        </button>
        <button
          type="button"
          onClick={() => setView("archive")}
          className={cn(
            "inline-flex flex-1 items-center justify-center gap-1 rounded-full py-1.5 text-[11px] font-semibold",
            view === "archive" ? "bg-fg text-bg" : "text-fg-muted",
          )}
        >
          <Archive className="size-3" strokeWidth={2} />
          Archive ({archived.length})
        </button>
      </div>

      {list.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-xs text-fg-muted">
          {view === "active"
            ? "No open work orders. Resolved ones move to Archive."
            : "No archived work orders yet. Mark a ticket Resolved to file it here."}
        </p>
      ) : (
        <ul className="space-y-2">
          {list.map((w) => (
            <OrderCard
              key={w.id}
              w={w}
              setStatus={setStatus}
              archived={view === "archive"}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
