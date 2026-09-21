import { useEffect, useState } from "react";
import { impersonationStatusFn, stopImpersonationFn } from "@/lib/admin/test-user-fns";
import { authClient, endImpersonation } from "@/lib/auth/client";

export function ImpersonationBanner() {
  const [name, setName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void impersonationStatusFn()
      .then((s) => {
        if (!cancelled) setName(s.viewingAs?.name ?? null);
      })
      .catch(() => {
        if (!cancelled) setName(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!name) return null;

  return (
    <div className="sticky top-0 z-[200] flex items-center justify-between gap-2 bg-court px-3 py-2 text-[12px] font-semibold text-white">
      <span className="min-w-0 truncate">Viewing as {name}</span>
      <button
        type="button"
        disabled={busy}
        className="shrink-0 rounded-full bg-white/20 px-3 py-1 text-[11px] font-bold uppercase tracking-wide"
        onClick={() => {
          setBusy(true);
          void (async () => {
            try {
              const res = await stopImpersonationFn();
              endImpersonation(res.token);
              await authClient.getSession();
              window.location.assign("/admin/test-users");
            } catch {
              setBusy(false);
            }
          })();
        }}
      >
        Return to Admin
      </button>
    </div>
  );
}
