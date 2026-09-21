import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export const SUPPORT_EMAIL = "seanvoss23@gmail.com";

export function LegalPage({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <main className="app-shell mx-auto min-h-0 w-full max-w-md overflow-y-auto px-5 pb-16 pt-4">
      <Link
        to="/"
        className="mb-6 inline-flex min-h-11 items-center text-[13px] font-medium text-fg-muted"
      >
        ← Upset City
      </Link>
      <p className="mb-1 text-sm font-medium tracking-wide text-fg-subtle uppercase">
        Upset City
      </p>
      <h1 className="font-display text-3xl font-semibold tracking-tight text-fg">
        {title}
      </h1>
      <div className="mt-5 space-y-4 text-[14px] leading-relaxed text-fg-muted">
        {children}
      </div>
      <p className="mt-8 text-[12px] text-fg-subtle">
        Questions:{" "}
        <a className="font-semibold text-court" href={`mailto:${SUPPORT_EMAIL}`}>
          {SUPPORT_EMAIL}
        </a>
      </p>
    </main>
  );
}
