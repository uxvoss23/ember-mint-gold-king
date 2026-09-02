import { Link } from "@tanstack/react-router";

export function NotFoundPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-bg px-6 text-center text-fg">
      <p className="text-[11px] font-bold tracking-[0.18em] text-court uppercase">
        Upset City
      </p>
      <h1 className="mt-3 font-display text-2xl font-semibold tracking-tight">
        That page isn’t here
      </h1>
      <p className="mt-2 max-w-xs text-sm text-fg-muted">
        The run moved. Head back to courts and the 1v1 lobby.
      </p>
      <Link
        to="/"
        className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-court px-5 text-sm font-semibold text-white"
      >
        Back to Upset City
      </Link>
    </div>
  );
}
