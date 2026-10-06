"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { friendlyAuthError } from "@/lib/authErrors";
import { fetchMyCompany, routeForCompany } from "@/lib/companyApi";
import { fetchMyStaffAccess } from "@/lib/staffApi";

const inputClass =
  "w-full min-h-12 rounded-xl border border-surface-border bg-surface px-4 py-3 text-ink outline-none focus:border-brand";

export default function LoginPage() {
  const { signIn, signOut, getToken, resetPassword } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      await signIn(email.trim(), password);

      const token = await getToken();
      if (!token) throw new Error("Couldn't verify your session. Try again.");

      // Company owner?
      const company = await fetchMyCompany(token);
      if (company) {
        router.replace(routeForCompany(company));
        return;
      }

      // Staff member? (The staff screen handles email verification and
      // inactive companies itself.)
      const staff = await fetchMyStaffAccess(token);
      if (staff.kind !== "none") {
        router.replace("/staff");
        return;
      }

      await signOut();
      setError(
        "No company is linked to this account. Register your company, or ask your company owner to add your email if you work for one."
      );
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    setError(null);
    setNotice(null);
    if (!email.trim()) {
      setError("Enter your email above first, then tap Forgot password.");
      return;
    }
    try {
      await resetPassword(email.trim());
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      if (code !== "auth/user-not-found") {
        setError(friendlyAuthError(err));
        return;
      }
    }
    setNotice("If an account exists for that email, a reset link is on its way.");
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-muted px-6 py-10">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-5">
        <div className="space-y-1 text-center">
          <h1 className="text-4xl font-black text-brand">Crafteey</h1>
          <p className="text-lg font-bold text-ink">Technicians</p>
          <p className="text-sm text-ink-muted">Sign in to manage your jobs, chats and payments.</p>
        </div>

        {error && (
          <p role="alert" className="rounded-lg bg-status-danger-bg p-3 text-sm text-status-danger">
            {error}
          </p>
        )}
        {notice && (
          <p className="rounded-lg bg-status-success-bg p-3 text-sm text-status-success">{notice}</p>
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
          <label className="mb-1 block text-sm font-medium text-ink">Password</label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${inputClass} pr-20`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2 top-1/2 min-h-10 -translate-y-1/2 rounded-lg px-3 text-xs font-semibold text-ink-muted"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="mt-2 min-h-10 text-xs font-semibold text-brand-dark"
          >
            Forgot password?
          </button>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="min-h-12 w-full rounded-xl bg-brand py-3 font-semibold text-brand-ink transition disabled:opacity-60"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>

        <div className="space-y-1 text-center text-sm text-ink-muted">
          <p>
            Don&apos;t have a company account?{" "}
            <Link href="/register" className="font-semibold text-brand-dark">
              Register your company
            </Link>
          </p>
          <p>
            New staff member?{" "}
            <Link href="/staff-signup" className="font-semibold text-brand-dark">
              Create your staff account
            </Link>
          </p>
        </div>
      </form>
    </main>
  );
}