"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/lib/useCompany";
import { PageSkeleton } from "@/components/Skeleton";

// Where an approved company goes next. The new home screen replaces this
// in the next batch.
const HOME_PATH = "/dashboard";

export default function PendingPage() {
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();
  const { loading, company, error, refresh } = useCompany();

  useEffect(() => {
    if (authLoading || loading) return;
    if (!user) {
      router.replace("/login");
    } else if (!company && !error) {
      router.replace("/register");
    }
  }, [authLoading, loading, user, company, error, router]);

  const handleSignOut = async () => {
    await signOut();
    router.replace("/login");
  };

  if (authLoading || loading || !user || (!company && !error)) {
    return <PageSkeleton />;
  }

  if (error || !company) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-surface-muted px-6">
        <div className="w-full max-w-md space-y-4 text-center">
          <p className="rounded-lg bg-status-danger-bg p-3 text-sm text-status-danger">
            {error || "Couldn't load your application."}
          </p>
          <button
            onClick={refresh}
            className="min-h-12 w-full rounded-xl bg-brand py-3 font-semibold text-brand-ink"
          >
            Try again
          </button>
        </div>
      </main>
    );
  }

  const submitted = new Date(company.createdAt).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const signed = !!company.agreement?.signed;

  return (
    <main className="min-h-screen bg-surface-muted px-6 py-12">
      <div className="mx-auto w-full max-w-md space-y-5">
        {company.status === "approved" && (
          <>
            <div className="text-center">
              <h1 className="text-2xl font-bold text-ink">You&apos;re approved</h1>
              <p className="mt-1 text-sm text-ink-muted">
                {company.businessName} is now a Crafteey company.
              </p>
            </div>
            <Link
              href={HOME_PATH}
              className="block min-h-12 w-full rounded-xl bg-brand py-3 text-center font-semibold text-brand-ink"
            >
              Open dashboard
            </Link>
          </>
        )}

        {company.status === "pending" && (
          <>
            <div className="text-center">
              <h1 className="text-2xl font-bold text-ink">Your company is being reviewed</h1>
              <p className="mt-1 text-sm text-ink-muted">
                We are checking your company information and documents.
              </p>
            </div>

            <div className="space-y-3 rounded-2xl border border-surface-border bg-surface p-5 text-sm">
              <StatusLine label="Application submitted" value={submitted} />
              <StatusLine label="Status" value="Under review" />
              <StatusLine
                label="Agreement"
                value={signed ? "Signed" : "Waiting for your office visit"}
              />
            </div>

            {!signed && (
              <p className="rounded-xl bg-surface p-4 text-sm text-ink-muted">
                Please visit the Crafteey office to complete onboarding and sign your
                agreement. We approve your company once that is done.
              </p>
            )}

            <button
              onClick={refresh}
              className="min-h-12 w-full rounded-xl border border-surface-border py-3 font-semibold text-ink"
            >
              Check status
            </button>
          </>
        )}

        {(company.status === "rejected" || company.status === "suspended") && (
          <>
            <div className="text-center">
              <h1 className="text-2xl font-bold text-ink">
                {company.status === "rejected"
                  ? "Your application was not approved"
                  : "Your company is suspended"}
              </h1>
              {company.statusReason && (
                <p className="mt-2 rounded-lg bg-status-danger-bg p-3 text-sm text-status-danger">
                  {company.statusReason}
                </p>
              )}
              <p className="mt-2 text-sm text-ink-muted">
                Please contact the Crafteey office to find out what to do next.
              </p>
            </div>
          </>
        )}

        <button
          onClick={handleSignOut}
          className="min-h-12 w-full py-3 text-sm font-semibold text-ink-muted"
        >
          Log out
        </button>
      </div>
    </main>
  );
}

function StatusLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-ink-muted">{label}</span>
      <span className="text-right font-semibold text-ink">{value}</span>
    </div>
  );
}