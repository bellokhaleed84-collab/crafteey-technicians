"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useStaffAccess } from "@/lib/useStaffAccess";
import { PageSkeleton } from "@/components/Skeleton";
import VerifyEmailScreen from "@/components/VerifyEmailScreen";

function MessageScreen({
  title,
  text,
  onLogout,
}: {
  title: string;
  text: string;
  onLogout: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-muted px-6">
      <div className="w-full max-w-sm space-y-4 text-center">
        <h1 className="text-xl font-bold text-ink">{title}</h1>
        <p className="text-sm text-ink-muted">{text}</p>
        <button
          onClick={onLogout}
          className="min-h-12 w-full rounded-xl border border-surface-border bg-surface py-3 font-semibold text-ink"
        >
          Log out
        </button>
      </div>
    </main>
  );
}

export default function StaffHomePage() {
  const router = useRouter();
  const { signOut, getToken } = useAuth();
  const { loading, user, access, error, refresh } = useStaffAccess();
  const [toggling, setToggling] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  async function logout() {
    await signOut();
    router.replace("/login");
  }

  async function toggleOnline() {
    if (access?.kind !== "staff") return;
    setToggling(true);
    setToggleError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Your session expired. Sign in again.");
      const res = await fetch("/api/staff/availability", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ isOnline: !access.isOnline }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Couldn't change your status. Try again.");
      await refresh();
    } catch (err) {
      setToggleError(err instanceof Error ? err.message : "Couldn't change your status. Try again.");
    } finally {
      setToggling(false);
    }
  }

  if (loading || !user) return <PageSkeleton />;

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-surface-muted px-6">
        <div className="w-full max-w-sm space-y-4 text-center">
          <p role="alert" className="rounded-lg bg-status-danger-bg p-3 text-sm text-status-danger">
            {error}
          </p>
          <button
            onClick={refresh}
            className="min-h-12 w-full rounded-xl bg-brand py-3 font-semibold text-white"
          >
            Try again
          </button>
        </div>
      </main>
    );
  }

  if (access?.kind === "needs_verification") {
    return <VerifyEmailScreen onChecked={() => void refresh()} />;
  }

  if (access?.kind === "inactive") {
    return <MessageScreen title="Company not active" text={access.message} onLogout={logout} />;
  }

  if (!access || access.kind === "none") {
    return (
      <MessageScreen
        title="No company linked"
        text="This email hasn't been added by a company yet. Ask your company owner to add it, then sign in again."
        onLogout={logout}
      />
    );
  }

  const online = access.isOnline;
  const firstName = access.name.trim().split(" ")[0];

  return (
    <main className="min-h-screen bg-surface-muted">
      <div className="mx-auto w-full max-w-md">
        <header className="rounded-b-3xl bg-navy px-5 pb-8 pt-8">
          <p className="text-sm text-white/70">Hi {firstName}</p>
          <h1 className="mt-0.5 text-xl font-bold text-white">{access.companyName}</h1>
          <p className="text-xs text-white/60">Technician</p>

          <div className="mt-5 flex items-center justify-between gap-3">
            <span
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold ${
                online ? "bg-status-success/20 text-green-300" : "bg-white/10 text-white/70"
              }`}
            >
              <span
                aria-hidden="true"
                className={`h-2 w-2 rounded-full ${online ? "bg-green-400" : "bg-white/50"}`}
              />
              {online ? "Online" : "Offline"}
            </span>
            <button
              onClick={toggleOnline}
              disabled={toggling}
              className="min-h-12 rounded-xl bg-white/10 px-5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {toggling ? "Please wait..." : online ? "Go offline" : "Go online"}
            </button>
          </div>
          {toggleError && (
            <p role="alert" className="mt-3 rounded-lg bg-status-danger-bg p-2 text-sm text-status-danger">
              {toggleError}
            </p>
          )}
        </header>

        <div className="space-y-4 px-5 pt-4 pb-8">
          <section className="rounded-2xl bg-surface p-5 shadow-card">
            <h2 className="text-sm font-bold text-ink">Your jobs</h2>
            <p className="mt-2 text-sm text-ink-muted">
              No jobs assigned yet. Your company owner will assign jobs to you.
            </p>
          </section>

          <button
            onClick={logout}
            className="min-h-12 w-full rounded-xl border border-surface-border bg-surface py-3 font-semibold text-status-danger"
          >
            Log out
          </button>
        </div>
      </div>
    </main>
  );
}