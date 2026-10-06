"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { friendlyAuthError } from "@/lib/authErrors";

const inputClass =
  "w-full min-h-12 rounded-xl border border-surface-border bg-surface px-4 py-3 text-ink outline-none focus:border-brand";

export default function StaffSignupPage() {
  const { signUp } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    try {
      // Creates the account and emails a verification link.
      await signUp(email.trim(), password);
      // The staff screen checks for your invite and asks you to verify your email.
      router.replace("/staff");
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-muted px-6 py-10">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-5">
        <div className="space-y-1 text-center">
          <h1 className="text-4xl font-black text-brand">Crafteey</h1>
          <p className="text-lg font-bold text-ink">Staff account</p>
          <p className="text-sm text-ink-muted">
            Use the email your company owner added. You&apos;ll verify it in the next step.
          </p>
        </div>

        {error && (
          <p role="alert" className="rounded-lg bg-status-danger-bg p-3 text-sm text-status-danger">
            {error}
          </p>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium text-ink">Email</label>
          <input
            type="email"
            required
            autoCapitalize="none"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-ink">Create a password</label>
          <input
            type="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="min-h-12 w-full rounded-xl bg-brand py-3 font-semibold text-brand-ink transition disabled:opacity-60"
        >
          {loading ? "Creating account..." : "Create staff account"}
        </button>

        <p className="text-center text-sm text-ink-muted">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-brand-dark">
            Log in
          </Link>
        </p>
      </form>
    </main>
  );
}