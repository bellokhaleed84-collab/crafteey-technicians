"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { friendlyAuthError } from "@/lib/authErrors";

export default function VerifyEmailScreen({ onChecked }: { onChecked: () => void }) {
  const { user, emailVerified, resendVerification, refreshUser, signOut } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const check = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await refreshUser();
      setChecked(true);
      onChecked();
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await resendVerification();
      setNotice("Verification email sent. Check your inbox and spam folder.");
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const leave = async () => {
    await signOut();
    router.replace("/login");
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-muted px-6">
      <div className="w-full max-w-sm space-y-4 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-2xl">✉️</div>
        <h1 className="text-xl font-bold text-ink">Verify your email</h1>
        <p className="text-sm text-ink-muted">
          We sent a link to <span className="font-semibold text-ink">{user?.email}</span>. Tap it, then come back
          here. This confirms the email really is yours, so only you can open your company&apos;s jobs.
        </p>

        {error && <p className="rounded-lg bg-status-danger-bg p-2 text-sm text-status-danger">{error}</p>}
        {notice && <p className="rounded-lg bg-status-success-bg p-2 text-sm text-status-success">{notice}</p>}
        {checked && !emailVerified && !busy && (
          <p className="rounded-lg bg-status-warning-bg p-2 text-sm text-status-warning">
            We can&apos;t see your verification yet. Tap the link in the email, then try again.
          </p>
        )}

        <button
          type="button"
          onClick={check}
          disabled={busy}
          className="min-h-12 w-full rounded-xl bg-brand py-3 font-semibold text-brand-ink disabled:opacity-60"
        >
          {busy ? "Checking..." : "I've verified my email"}
        </button>
        <button
          type="button"
          onClick={resend}
          disabled={busy}
          className="min-h-12 w-full rounded-xl border border-surface-border py-3 text-sm font-semibold text-ink disabled:opacity-60"
        >
          Send the email again
        </button>
        <button type="button" onClick={leave} className="min-h-10 text-xs font-medium text-ink-muted underline">
          Log out
        </button>
      </div>
    </main>
  );
}