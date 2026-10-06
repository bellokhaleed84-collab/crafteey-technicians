"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/Skeleton";

type Member = {
  _id: string;
  name: string;
  email?: string;
  status: "invited" | "active";
  isOnline: boolean;
};

const inputClass =
  "w-full min-h-12 rounded-xl border border-surface-border bg-surface px-4 py-3 text-ink outline-none focus:border-brand";

function statusInfo(m: Member): { label: string; className: string } {
  if (m.status === "invited") return { label: "Invited", className: "bg-status-warning-bg text-status-warning" };
  if (m.isOnline) return { label: "Online", className: "bg-status-success-bg text-status-success" };
  return { label: "Offline", className: "bg-surface-border text-ink-muted" };
}

export default function StaffPage() {
  const { getToken } = useAuth();
  const [staff, setStaff] = useState<Member[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch("/api/company/staff", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Couldn't load your staff.");
      setStaff(Array.isArray(data.staff) ? data.staff : []);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Couldn't load your staff.");
    }
  }, [getToken]);

  useEffect(() => {
    load();
  }, [load]);

  async function addStaff(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (name.trim().length < 2) return setFormError("Enter your staff member's name.");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setFormError("Enter a valid email address.");

    setSaving(true);
    try {
      const token = await getToken();
      if (!token) throw new Error("Your session expired. Sign in again.");
      const res = await fetch("/api/company/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: name.trim(), email: email.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Couldn't add this staff member. Try again.");
      setName("");
      setEmail("");
      setFormOpen(false);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Couldn't add this staff member. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function removeStaff(id: string) {
    setRemovingId(id);
    setRemoveError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Your session expired. Sign in again.");
      const res = await fetch(`/api/company/staff/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Couldn't remove this staff member. Try again.");
      setConfirmId(null);
      await load();
    } catch (err) {
      setRemoveError(err instanceof Error ? err.message : "Couldn't remove this staff member. Try again.");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="space-y-4 px-5 pt-8">
      <Link href="/dashboard/more" className="inline-flex min-h-10 items-center text-sm font-semibold text-ink-muted">
        ‹ Back
      </Link>

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Staff</h1>
          <p className="text-sm text-ink-muted">
            {staff ? `${staff.length} ${staff.length === 1 ? "member" : "members"}` : " "}
          </p>
        </div>
        {!formOpen && (
          <button
            onClick={() => setFormOpen(true)}
            className="min-h-12 rounded-xl bg-brand px-5 text-sm font-semibold text-brand-ink"
          >
            + Add staff
          </button>
        )}
      </div>

      {formOpen && (
        <form onSubmit={addStaff} className="space-y-4 rounded-2xl bg-surface p-5 shadow-card">
          <h2 className="text-sm font-bold text-ink">Add a staff member</h2>
          <p className="text-sm text-ink-muted">
            They sign in to the Crafteey technician app with this email. No code is needed.
          </p>
          {formError && (
            <p role="alert" className="rounded-lg bg-status-danger-bg p-3 text-sm text-status-danger">
              {formError}
            </p>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-ink">Name</label>
            <input
              className={inputClass}
              placeholder="e.g. Bello Ade"
              maxLength={60}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink">Email</label>
            <input
              type="email"
              autoCapitalize="none"
              className={inputClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                setFormOpen(false);
                setFormError(null);
              }}
              className="min-h-12 flex-1 rounded-xl border border-surface-border font-semibold text-ink disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="min-h-12 flex-1 rounded-xl bg-brand font-semibold text-brand-ink disabled:opacity-60"
            >
              {saving ? "Adding..." : "Add staff"}
            </button>
          </div>
        </form>
      )}

      {removeError && (
        <p role="alert" className="rounded-lg bg-status-danger-bg p-3 text-sm text-status-danger">
          {removeError}
        </p>
      )}

      {loadError && (
        <div className="space-y-3 rounded-2xl bg-surface p-5 shadow-card">
          <p role="alert" className="text-sm text-status-danger">
            {loadError}
          </p>
          <button
            onClick={load}
            className="min-h-12 w-full rounded-xl border border-surface-border font-semibold text-ink"
          >
            Try again
          </button>
        </div>
      )}

      {!staff && !loadError && (
        <div aria-busy="true" className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 rounded-2xl bg-surface p-4 shadow-card">
              <Skeleton className="h-11 w-11 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      )}

      {staff && staff.length === 0 && !loadError && (
        <div className="rounded-2xl border border-dashed border-surface-border bg-surface p-8 text-center">
          <p className="font-semibold text-ink">No staff yet</p>
          <p className="mt-1 text-sm text-ink-muted">Add your first technician by email.</p>
        </div>
      )}

      {staff && staff.length > 0 && (
        <ul className="space-y-3">
          {staff.map((m) => {
            const info = statusInfo(m);
            const confirming = confirmId === m._id;
            const removing = removingId === m._id;
            return (
              <li key={m._id} className="rounded-2xl bg-surface p-4 shadow-card">
                <div className="flex items-center gap-3">
                  <div
                    aria-hidden="true"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-light text-base font-bold text-brand-dark"
                  >
                    {m.name.trim().charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink">{m.name}</p>
                    <p className="truncate text-xs text-ink-muted">Technician · {m.email}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${info.className}`}>
                    {info.label}
                  </span>
                </div>

                {confirming ? (
                  <div className="mt-3 space-y-3 border-t border-surface-border pt-3">
                    <p className="text-sm text-ink">
                      Remove {m.name}? They lose access right away.
                    </p>
                    <div className="flex gap-3">
                      <button
                        disabled={removing}
                        onClick={() => setConfirmId(null)}
                        className="min-h-12 flex-1 rounded-xl border border-surface-border text-sm font-semibold text-ink disabled:opacity-60"
                      >
                        Cancel
                      </button>
                      <button
                        disabled={removing}
                        onClick={() => removeStaff(m._id)}
                        className="min-h-12 flex-1 rounded-xl bg-status-danger text-sm font-semibold text-white disabled:opacity-60"
                      >
                        {removing ? "Removing..." : "Yes, remove"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setRemoveError(null);
                      setConfirmId(m._id);
                    }}
                    className="mt-3 min-h-10 text-xs font-semibold text-status-danger"
                  >
                    Remove
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}