import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { SyncNotice } from "./SyncNotice";

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-paper text-ink">
      <header className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 px-5 py-5">
        <Link to="/" className="font-display text-2xl font-medium tracking-tight text-ink">
          Letterbench
        </Link>
      </header>
      <main className="mx-auto w-full max-w-2xl px-5 pb-16">
        <SyncNotice />
        {children}
      </main>
    </div>
  );
}

export function Loading({ label }: { label: string }) {
  return (
    <div className="grid gap-3" aria-busy="true">
      <p className="text-sm text-muted">{label}</p>
      <div className="h-28 animate-pulse rounded-card bg-line" />
      <div className="h-28 animate-pulse rounded-card bg-line" />
    </div>
  );
}
