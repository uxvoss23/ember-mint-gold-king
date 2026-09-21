import { useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { isModeratorMe } from "@/lib/auth/admin";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { beginImpersonation } from "@/lib/auth/client";
import { authClient } from "@/lib/auth/client";
import {
  createTestUserFn,
  deleteTestUserFn,
  impersonateTestUserFn,
  listTestUsersFn,
  resetTestUserFn,
  updateTestUserPhotoFn,
  type TestUserRow,
} from "@/lib/admin/test-user-fns";
import { TEST_PRESET_LABEL, TEST_USER_PRESETS, type TestUserPreset } from "@/lib/admin/test-users";
import { mutationError } from "@/lib/game/client-actions";
import { compressWorkOrderPhoto } from "@/components/work-order-popup";
import { ProfilePhotoEditor } from "@/components/profile-photo-editor";
import { cn } from "@/lib/utils";

export function AdminTestUsersPage() {
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();
  const admin = isModeratorMe(undefined, user?.primaryEmail);
  const [rows, setRows] = useState<TestUserRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [photo, setPhoto] = useState<string | undefined>();
  const listRef = useRef<HTMLDivElement>(null);

  const reload = async () => {
    setErr(null);
    try {
      setRows(await listTestUsersFn());
    } catch (e) {
      setErr(mutationError(e));
    }
  };

  useEffect(() => {
    if (!isPending && user && admin) void reload();
  }, [isPending, user?.id, admin]);

  if (isPending) return <p className="p-6 text-sm text-fg-muted">Loading…</p>;
  if (!user || !admin) {
    return (
      <main className="mx-auto max-w-md px-5 py-10">
        <p className="text-sm text-fg-muted">Admin only.</p>
        <Link to="/" className="mt-4 inline-block text-sm font-semibold text-court">
          Back
        </Link>
      </main>
    );
  }

  const run = async (fn: () => Promise<TestUserRow[]>) => {
    setBusy(true);
    setErr(null);
    try {
      setRows(await fn());
      listRef.current?.scrollTo({ top: 0 });
    } catch (e) {
      setErr(mutationError(e));
    } finally {
      setBusy(false);
    }
  };

  const viewAs = async (row: TestUserRow) => {
    setBusy(true);
    setErr(null);
    try {
      const res = await impersonateTestUserFn({ data: { userId: row.userId } });
      beginImpersonation(res.adminToken, res.token);
      await authClient.getSession();
      await navigate({ to: "/" });
      window.location.reload();
    } catch (e) {
      setErr(mutationError(e));
      setBusy(false);
    }
  };

  return (
    <main className="app-shell mx-auto flex w-full max-w-lg flex-col overflow-hidden">
      <header className="shrink-0 px-4 pt-3 pb-2">
        <Link
          to="/"
          className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-bg-elevated"
          aria-label="Back"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="font-display text-2xl font-semibold text-fg">Test Users</h1>
        <p className="mt-1 text-[13px] text-fg-muted">
          Real accounts for switching perspectives. Admin only.
        </p>

        <div className="mt-3 grid grid-cols-2 gap-1.5">
          {TEST_USER_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              disabled={busy}
              onClick={() =>
                void run(() =>
                  createTestUserFn({
                    data: { preset: preset as TestUserPreset, photoUrl: photo },
                  }),
                )
              }
              className="rounded-xl border border-border bg-bg-elevated px-2 py-2.5 text-left text-[12px] font-semibold text-fg disabled:opacity-50"
            >
              {TEST_PRESET_LABEL[preset]}
            </button>
          ))}
        </div>

        <details className="mt-3 rounded-xl border border-border bg-bg-elevated p-3">
          <summary className="cursor-pointer text-[11px] font-bold text-fg">
            Custom test user
          </summary>
          <form
            className="mt-2 space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              void run(() =>
                createTestUserFn({
                  data: {
                    preset: "average",
                    name: name.trim() || undefined,
                    handle: handle.trim() || undefined,
                    photoUrl: photo,
                  },
                }),
              );
            }}
          >
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              className="h-10 w-full rounded-lg border border-border bg-bg px-3 text-sm"
            />
            <input
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="username"
              className="h-10 w-full rounded-lg border border-border bg-bg px-3 text-sm"
            />
            <label className="block text-[11px] text-fg-muted">
              Photo (optional)
              <input
                type="file"
                accept="image/*"
                className="mt-1 block w-full text-[11px]"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  void compressWorkOrderPhoto(file).then(setPhoto);
                }}
              />
            </label>
            <button
              type="submit"
              disabled={busy}
              className="h-10 w-full rounded-xl bg-court text-sm font-semibold text-white disabled:opacity-50"
            >
              Create
            </button>
          </form>
        </details>

        {err ? (
          <p className="mt-2 text-xs font-medium text-danger" role="alert">
            {err}
          </p>
        ) : null}

        <p className="mt-3 text-[11px] font-semibold text-fg-muted">
          {rows.length} test {rows.length === 1 ? "user" : "users"}
        </p>
      </header>

      <div
        ref={listRef}
        className="uc-screen-scroll min-h-0 flex-1 px-4"
        style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom))" }}
      >
        <ul className="space-y-2 pb-8">
          {rows.map((row) => (
            <li
              key={row.id}
              className="rounded-2xl border border-border bg-bg-elevated p-3"
            >
              <div className="flex items-center gap-3">
                {row.photoUrl ? (
                  <img
                    src={row.photoUrl}
                    alt=""
                    className="size-11 rounded-full object-cover"
                  />
                ) : (
                  <div className="grid size-11 place-items-center rounded-full bg-court/20 text-sm font-bold text-court">
                    {row.name.slice(0, 1)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-fg">{row.name}</p>
                  <p className="truncate text-[12px] text-fg-muted">
                    @{row.handle} · {Math.round(row.rating)} · {row.state}
                  </p>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void viewAs(row)}
                  className="h-9 rounded-lg bg-court text-[11px] font-semibold text-white disabled:opacity-50"
                >
                  View as User
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void run(() => resetTestUserFn({ data: { userId: row.userId } }))}
                  className="h-9 rounded-lg border border-border text-[11px] font-semibold text-fg disabled:opacity-50"
                >
                  Reset
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (!window.confirm(`Delete ${row.name}?`)) return;
                    void run(() => deleteTestUserFn({ data: { userId: row.userId } }));
                  }}
                  className="h-9 rounded-lg border border-danger/40 text-[11px] font-semibold text-danger disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
              <div className="mt-2 border-t border-border pt-2">
                <ProfilePhotoEditor
                  compact
                  currentUrl={row.photoUrl}
                  busy={busy}
                  onSave={async (photo) => {
                    setBusy(true);
                    setErr(null);
                    try {
                      setRows(
                        await updateTestUserPhotoFn({
                          data: { userId: row.userId, photo },
                        }),
                      );
                    } finally {
                      setBusy(false);
                    }
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
        {rows.length === 0 ? (
          <p className="mt-6 pb-8 text-center text-[13px] text-fg-muted">
            No test users yet. Create a preset above.
          </p>
        ) : null}
      </div>
    </main>
  );
}

export function AdminTestUsersLink({
  role,
  email,
}: {
  role?: string | null;
  email?: string | null;
}) {
  if (!isModeratorMe(role, email)) return null;
  return (
    <Link
      to="/admin/test-users"
      className={cn(
        "mt-2 inline-flex h-10 items-center justify-center rounded-full border border-border px-4 text-xs font-semibold text-fg",
      )}
    >
      Test Users
    </Link>
  );
}
