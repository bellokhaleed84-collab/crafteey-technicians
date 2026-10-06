"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCompanyContext } from "@/contexts/CompanyContext";
import { Skeleton } from "@/components/Skeleton";
import PageHeader from "@/components/PageHeader";
import { TRADE_CATEGORIES, TRADE_LABELS } from "@/lib/trades";
import {
  COMPANY_AREAS,
  COMPANY_PRICE_RANGES,
  PRICE_RANGE_LABELS,
  type CompanyPriceRangeValue,
} from "@/lib/companyOptions";
import { checkImage, uploadFile } from "@/lib/cloudinaryUpload";
import { containsContactInfo, CONTACT_INFO_MESSAGE } from "@/lib/contactCheck";

const MAX_PHOTOS = 8;

const inputClass =
  "w-full min-h-12 rounded-xl border border-surface-border bg-surface px-4 py-3 text-ink outline-none focus:border-brand";

type Form = {
  phone: string;
  trades: string[];
  areas: string[];
  description: string;
  yearsOperating: string;
  technicianCount: string;
  priceRange: CompanyPriceRangeValue | "";
  address: string;
  logoUrl: string | null;
  photos: string[];
};

export default function CompanyProfilePage() {
  const { getToken } = useAuth();
  const { company, refresh } = useCompanyContext();

  const [email, setEmail] = useState("");
  const [form, setForm] = useState<Form | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [areaQuery, setAreaQuery] = useState("");
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const logoInput = useRef<HTMLInputElement>(null);

  async function load() {
    setLoadError(null);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch("/api/company/me", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.company) throw new Error(data?.error || "Couldn't load your profile.");
      const c = data.company;
      setEmail(c.email ?? "");
      setForm({
        phone: c.phone ?? "",
        trades: c.trades ?? [],
        areas: c.areas ?? [],
        description: c.description ?? "",
        yearsOperating: String(c.yearsOperating ?? ""),
        technicianCount: String(c.technicianCount ?? ""),
        priceRange: c.priceRange ?? "",
        address: c.address ?? "",
        logoUrl: c.logoUrl ?? null,
        photos: c.photos ?? [],
      });
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Couldn't load your profile.");
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = <K extends keyof Form>(key: K, value: Form[K]) => {
    setSaved(false);
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  function toggle(key: "trades" | "areas", value: string) {
    if (!form) return;
    const list = form[key];
    update(key, list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  }

  async function pickLogo(list: FileList | null) {
    const file = list?.[0];
    if (!file) return;
    const problem = checkImage(file);
    if (problem) return setError(problem);
    setError(null);
    setUploadStatus("Uploading logo...");
    try {
      const token = await getToken();
      if (!token) throw new Error("Your session expired. Sign in again.");
      update("logoUrl", await uploadFile(token, file, "logo"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't upload the logo.");
    } finally {
      setUploadStatus(null);
    }
  }

  async function addPhotos(list: FileList | null) {
    if (!list || !form) return;
    const picked = Array.from(list);
    for (const f of picked) {
      const problem = checkImage(f);
      if (problem) return setError(problem);
    }
    if (form.photos.length + picked.length > MAX_PHOTOS) {
      return setError(`You can add up to ${MAX_PHOTOS} photos.`);
    }
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Your session expired. Sign in again.");
      const urls: string[] = [];
      for (let i = 0; i < picked.length; i++) {
        setUploadStatus(`Uploading photo ${i + 1} of ${picked.length}...`);
        urls.push(await uploadFile(token, picked[i], "company_photo"));
      }
      setForm((prev) => (prev ? { ...prev, photos: [...prev.photos, ...urls] } : prev));
      setSaved(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't upload the photos.");
    } finally {
      setUploadStatus(null);
    }
  }

  function validate(f: Form): string | null {
    if (!/^\+?\d{10,15}$/.test(f.phone.replace(/[\s-]/g, ""))) return "Enter a valid phone number.";
    if (f.trades.length === 0) return "Choose at least one service.";
    if (f.areas.length === 0) return "Choose at least one area.";
    if (containsContactInfo(f.description)) return `Your description ${CONTACT_INFO_MESSAGE.toLowerCase()}`;
    const years = Number(f.yearsOperating);
    if (f.yearsOperating === "" || !Number.isInteger(years) || years < 0 || years > 80) {
      return "Enter how many years you have operated (0 if new).";
    }
    const techs = Number(f.technicianCount);
    if (!Number.isInteger(techs) || techs < 1 || techs > 500) return "Enter how many technicians you have.";
    if (!f.priceRange) return "Choose a price range.";
    if (f.address.trim().length < 5) return "Enter your business address.";
    return null;
  }

  async function save() {
    if (!form) return;
    setError(null);
    setSaved(false);
    const problem = validate(form);
    if (problem) return setError(problem);

    setSaving(true);
    try {
      const token = await getToken();
      if (!token) throw new Error("Your session expired. Sign in again.");
      const res = await fetch("/api/company/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          phone: form.phone,
          trades: form.trades,
          areas: form.areas,
          description: form.description.trim(),
          yearsOperating: Number(form.yearsOperating),
          technicianCount: Number(form.technicianCount),
          priceRange: form.priceRange,
          address: form.address.trim(),
          logoUrl: form.logoUrl,
          photos: form.photos,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Couldn't save your profile. Try again.");
      setSaved(true);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save your profile. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const busy = saving || !!uploadStatus;
  const visibleAreas = COMPANY_AREAS.filter((a) => a.toLowerCase().includes(areaQuery.trim().toLowerCase()));

  return (
    <div>
      <PageHeader
        title="Company profile"
        subtitle="This is what customers see when they find your company."
        backHref="/dashboard/more"
      />

      <div className="space-y-4 px-5 pt-4">
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

        {!form && !loadError && (
          <div aria-busy="true" className="space-y-4">
            <div className="flex items-center gap-4 rounded-2xl bg-surface p-5 shadow-card">
              <Skeleton className="h-20 w-20 rounded-2xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </div>
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-2xl bg-surface p-5 shadow-card">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="mt-3 h-12 w-full" />
              </div>
            ))}
          </div>
        )}

        {form && (
          <>
            {error && (
              <p role="alert" className="rounded-lg bg-status-danger-bg p-3 text-sm text-status-danger">
                {error}
              </p>
            )}
            {saved && (
              <p className="rounded-lg bg-status-success-bg p-3 text-sm text-status-success">
                Saved. Your profile is updated.
              </p>
            )}
            {uploadStatus && (
              <p className="text-center text-sm font-medium text-ink" aria-live="polite">
                {uploadStatus}
              </p>
            )}

            <Section title="Logo">
              <div className="flex items-center gap-4">
                {form.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={form.logoUrl}
                    alt="Company logo"
                    className="h-20 w-20 rounded-2xl border border-surface-border object-contain"
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-brand-light text-2xl font-bold text-brand-dark">
                    {company.businessName.trim().charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <input
                    ref={logoInput}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      void pickLogo(e.target.files);
                      e.target.value = "";
                    }}
                  />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => logoInput.current?.click()}
                    className="min-h-10 rounded-full border border-surface-border px-4 text-xs font-semibold text-ink disabled:opacity-60"
                  >
                    {form.logoUrl ? "Change logo" : "Add logo"}
                  </button>
                  {form.logoUrl && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => update("logoUrl", null)}
                      className="min-h-10 rounded-full border border-surface-border px-4 text-xs font-semibold text-status-danger disabled:opacity-60"
                    >
                      Remove logo
                    </button>
                  )}
                </div>
              </div>
            </Section>

            <Section title={`Photos of your work (${form.photos.length}/${MAX_PHOTOS})`}>
              <div className="flex flex-wrap gap-2">
                {form.photos.map((src, i) => (
                  <div key={src} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={src}
                      alt={`Work photo ${i + 1}`}
                      className="h-20 w-20 rounded-xl border border-surface-border object-cover"
                    />
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        update(
                          "photos",
                          form.photos.filter((_, idx) => idx !== i)
                        )
                      }
                      aria-label={`Remove photo ${i + 1}`}
                      className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-status-danger text-sm font-bold text-white"
                    >
                      {"\u00D7"}
                    </button>
                  </div>
                ))}
                {form.photos.length < MAX_PHOTOS && (
                  <label className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-surface-border bg-surface text-2xl text-ink-muted">
                    +
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      disabled={busy}
                      className="hidden"
                      onChange={(e) => {
                        void addPhotos(e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </label>
                )}
              </div>
            </Section>

            <Section title="About your company">
              <textarea
                className={inputClass}
                rows={4}
                maxLength={600}
                placeholder="Tell customers about your business"
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
              />
              <p className="mt-1 text-right text-xs text-ink-faint">{form.description.length}/600</p>
            </Section>

            <Section title="Services you provide">
              <div className="space-y-2">
                {TRADE_CATEGORIES.map((t) => (
                  <CheckRow
                    key={t}
                    label={TRADE_LABELS[t]}
                    checked={form.trades.includes(t)}
                    onChange={() => toggle("trades", t)}
                  />
                ))}
              </div>
            </Section>

            <Section title={`Areas you cover (${form.areas.length} selected)`}>
              <input
                className={`${inputClass} mb-3`}
                placeholder="Search area"
                value={areaQuery}
                onChange={(e) => setAreaQuery(e.target.value)}
              />
              <div className="space-y-2">
                {visibleAreas.length === 0 && <p className="text-sm text-ink-muted">No area matches that search.</p>}
                {visibleAreas.map((a) => (
                  <CheckRow key={a} label={a} checked={form.areas.includes(a)} onChange={() => toggle("areas", a)} />
                ))}
              </div>
            </Section>

            <Section title="Details">
              <div className="space-y-4">
                <Field label="Price range">
                  <select
                    className={inputClass}
                    value={form.priceRange}
                    onChange={(e) => update("priceRange", e.target.value as CompanyPriceRangeValue)}
                  >
                    <option value="">Select range</option>
                    {COMPANY_PRICE_RANGES.map((p) => (
                      <option key={p} value={p}>
                        {PRICE_RANGE_LABELS[p]}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Years operating">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={80}
                    className={inputClass}
                    value={form.yearsOperating}
                    onChange={(e) => update("yearsOperating", e.target.value)}
                  />
                </Field>
                <Field label="Number of technicians">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={500}
                    className={inputClass}
                    value={form.technicianCount}
                    onChange={(e) => update("technicianCount", e.target.value)}
                  />
                </Field>
                <Field label="Business address">
                  <textarea
                    className={inputClass}
                    rows={2}
                    maxLength={200}
                    value={form.address}
                    onChange={(e) => update("address", e.target.value)}
                  />
                </Field>
              </div>
            </Section>

            <Section title="Contact for Crafteey">
              <p className="mb-3 text-xs text-ink-muted">
                Only the Crafteey team sees this. Customers never see your phone number or email.
              </p>
              <Field label="Phone number">
                <input
                  type="tel"
                  inputMode="tel"
                  className={inputClass}
                  value={form.phone}
                  onChange={(e) => update("phone", e.target.value)}
                />
              </Field>
            </Section>

            <Section title="Locked details">
              <div className="space-y-2 text-sm">
                <p>
                  <span className="font-semibold text-ink">Business name: </span>
                  <span className="text-ink-muted">{company.businessName}</span>
                </p>
                <p>
                  <span className="font-semibold text-ink">Email: </span>
                  <span className="text-ink-muted">{email}</span>
                </p>
                <p className="text-xs text-ink-faint">To change these, contact the Crafteey office.</p>
              </div>
            </Section>

            <button
              onClick={save}
              disabled={busy}
              className="min-h-12 w-full rounded-xl bg-brand py-3 font-semibold text-white disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save profile"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl bg-surface p-5 shadow-card">
      <h2 className="mb-3 text-sm font-bold text-ink">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-ink">{label}</label>
      {children}
    </div>
  );
}

function CheckRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label
      className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 ${
        checked ? "border-brand bg-brand-light" : "border-surface-border bg-surface"
      }`}
    >
      <input type="checkbox" checked={checked} onChange={onChange} className="h-5 w-5 shrink-0 accent-brand" />
      <span className="text-ink">{label}</span>
    </label>
  );
}