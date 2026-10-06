"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/lib/useCompany";
import { CompanyProvider } from "@/contexts/CompanyContext";
import BottomNav from "@/components/BottomNav";
import { Skeleton, CardSkeleton } from "@/components/Skeleton";

function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-surface-muted" aria-busy="true">
      <div className="mx-auto w-full max-w-md space-y-4 px-5 pt-8">
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-4 w-2/3" />
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { loading, company, error, refresh } = useCompany();

  // Only the first load shows the skeleton. Later refreshes keep the screen.
  const firstLoad = authLoading || (loading && !company);

  useEffect(() => {
    if (firstLoad) return;
    if (!user) {
      router.replace("/login");
    } else if (!error) {
      if (!company) router.replace("/register");
      else if (company.status !== "approved") router.replace("/pending");
    }
  }, [firstLoad, user, company, error, router]);

  if (firstLoad) return <DashboardSkeleton />;

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-surface-muted px-6">
        <div className="w-full max-w-md space-y-4 text-center">
          <p role="alert" className="rounded-lg bg-status-danger-bg p-3 text-sm text-status-danger">
            {error}
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

  // Signed out, no company, or not approved: the effect above is redirecting.
  if (!user || !company || company.status !== "approved") return <DashboardSkeleton />;

  return (
    <CompanyProvider value={{ company, refresh }}>
      <div className="min-h-screen bg-surface-muted">
        <main className="mx-auto w-full max-w-md pb-28">{children}</main>
        <BottomNav />
      </div>
    </CompanyProvider>
  );
}