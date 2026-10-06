import Link from "next/link";
import type { ReactNode } from "react";

export default function PageHeader({
  title,
  subtitle,
  backHref,
  right,
}: {
  title: string;
  subtitle?: string;
  backHref?: string;
  right?: ReactNode;
}) {
  return (
    <header className="rounded-b-3xl bg-navy px-5 pb-6 pt-6">
      {backHref && (
        <Link
          href={backHref}
          className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-white/80"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Back
        </Link>
      )}
      <div className="mt-1 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-white">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-white/70">{subtitle}</p>}
        </div>
        {right}
      </div>
    </header>
  );
}