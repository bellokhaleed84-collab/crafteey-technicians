"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { User } from "firebase/auth";
import { useAuth } from "@/contexts/AuthContext";
import { friendlyAuthError } from "@/lib/authErrors";
import { TRADE_CATEGORIES, TRADE_LABELS, type TradeCategory } from "@/lib/trades";
import {
  COMPANY_AREAS,
  COMPANY_PRICE_RANGES,
  PRICE_RANGE_LABELS,
  type CompanyPriceRangeValue,
} from "@/lib/companyOptions";

type FormState = {
  businessName: string;
  email: string;
  password: string;
  phone: string;
  trades: TradeCategory[];
  areas: string[];
  description: string;
  yearsOperating: string;
  technicianCount: string;
  priceRange: CompanyPriceRangeValue | "";
  address: string;
};

type Files = {
  photos: File[];
  registration: File | null;
  idCard: File | null;
  certifications: File[];
  others: File[];
};

const TOTAL_STEPS = 5;
const STEP_LABELS = ["Business", "Areas", "Details", "Documents", "Review"];
const MAX_PHOTOS = 8;
const MAX_EXTRA_DOCS = 5;
const MAX_IMAGE_MB = 5;
const MAX_DOC_MB = 10;
const REQUEST_TIMEOUT_MS = 20000;
const UPLOAD_TIMEOUT_MS = 60000;

const inputClass =
  "w-full min-h-12 rounded-xl border border-surface-border bg-surface px-4 py-3 text-ink outline-none focus:border-brand";

function checkFile(file: File, kind: "image" | "doc"): string | null {
  const isImage = file.type.startsWith("image/");
  const isPdf = file.type === "application/pdf";
  if (kind === "image" && !isImage) return "Please choose a photo (JPG or PNG).";
  if (kind === "doc" && !isImage && !isPdf) return "Please choose a photo or a PDF file.";
  const maxMb = kind === "image" ? MAX_IMAGE_MB : MAX_DOC_MB;
  if (file.size > maxMb * 1024 * 1024) return `Each file must be under ${maxMb}MB.`;
  return null;
}

function validateStep(step: number, form: FormState, files: Files): string | null {
  if (step === 1) {
    if (form.businessName.trim().length < 2) return "Enter your business name.";
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) return "Enter a valid email address.";
    if (form.password.length < 6) return "Password must be at least 6 characters.";
    if (!/^\+?\d{10,15}$/.test(form.phone.replace(/[\s-]/g, ""))) {
      return "Enter a valid phone number.";
    }
    if (form.trades.length === 0) return "Choose at least one service.";
  }
  if (step === 2) {
    if (form.areas.length === 0) return "Choose at least one area.";
  }
  if (step === 3) {
    const years = Number(form.yearsOperating);
    if (form.yearsOperating === "" || !Number.isInteger(years) || years < 0 || years > 80) {
      return "Enter how many years you have operated (0 if new).";
    }
    const techs = Number(form.technicianCount);
    if (!Number.isInteger(techs) || techs < 1 || techs > 500) {
      return "Enter how many technicians you have.";
    }
    if (!form.priceRange) return "Choose a price range.";
    if (form.address.trim().length < 5) return "Enter your business address.";
  }
  if (step === 4) {
    if (!files.registration) return "Upload your business registration.";
    if (!files.idCard) return "Upload your ID card.";
  }
  return null;
}

// Uploads one file to Cloudinary with a signed request. Must run AFTER the
// Firebase account exists, because /api/upload/sign needs a token.
async function uploadFile(
  token: string,
  file: File,
  kind: "company_photo" | "company_doc"
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);
  try {
    const signRes = await fetch("/api/upload/sign", {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ kind }),
    });
    if (!signRes.ok) throw new Error("sign failed");
    const { cloudName, apiKey, timestamp, signature, folder } = await signRes.json();

    const data = new FormData();
    data.append("file", file);
    data.append("api_key", apiKey);
    data.append("timestamp", String(timestamp));
    data.append("signature", signature);
    data.append("folder", folder);

    const up = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
      method: "POST",
      signal: controller.signal,
      body: data,
    });
    const json = await up.json();
    if (!up.ok || !json.secure_url) throw new Error("upload failed");
    return json.secure_url as string;
  } catch {
    throw new Error(`We couldn't upload "${file.name}". Check your connection and try again.`);
  } finally {
    clearTimeout(timer);
  }
}

export default function RegisterPage() {
  const { signUp, getToken } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [areaQuery, setAreaQuery] = useState("");
  const [form, setForm] = useState<FormState>({
    businessName: "",
    email: "",
    password: "",
    phone: "",
    trades: [],
    areas: [],
    description: "",
    yearsOperating: "",
    technicianCount: "",
    priceRange: "",
    address: "",
  });
  const [files, setFiles] = useState<Files>({
    photos: [],
    registration: null,
    idCard: null,
    certifications: [],
    others: [],
  });

  // Small previews for the photo grid. Freed when the list changes.
  const photoPreviews = useMemo(
    () => files.photos.map((f) => URL.createObjectURL(f)),
    [files.photos]
  );
  useEffect(() => {
    return () => photoPreviews.forEach((u) => URL.revokeObjectURL(u));
  }, [photoPreviews]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const toggleTrade = (t: TradeCategory) =>
    update("trades", form.trades.includes(t) ? form.trades.filter((x) => x !== t) : [...form.trades, t]);

  const toggleArea = (a: string) =>
    update("areas", form.areas.includes(a) ? form.areas.filter((x) => x !== a) : [...form.areas, a]);

  const visibleAreas = COMPANY_AREAS.filter((a) =>
    a.toLowerCase().includes(areaQuery.trim().toLowerCase())
  );

  const addPhotos = (list: FileList | null) => {
    if (!list) return;
    const picked = Array.from(list);
    for (const f of picked) {
      const problem = checkFile(f, "image");
      if (problem) return setError(problem);
    }
    if (files.photos.length + picked.length > MAX_PHOTOS) {
      return setError(`You can add up to ${MAX_PHOTOS} photos.`);
    }
    setError(null);
    setFiles((p) => ({ ...p, photos: [...p.photos, ...picked] }));
  };

  const removePhoto = (i: number) =>
    setFiles((p) => ({ ...p, photos: p.photos.filter((_, idx) => idx !== i) }));

  const setSingleDoc = (key: "registration" | "idCard", list: FileList | null) => {
    const f = list?.[0];
    if (!f) return;
    const problem = checkFile(f, "doc");
    if (problem) return setError(problem);
    setError(null);
    setFiles((p) => ({ ...p, [key]: f }));
  };

  const addExtraDocs = (key: "certifications" | "others", list: FileList | null) => {
    if (!list) return;
    const picked = Array.from(list);
    for (const f of picked) {
      const problem = checkFile(f, "doc");
      if (problem) return setError(problem);
    }
    if (files[key].length + picked.length > MAX_EXTRA_DOCS) {
      return setError(`You can add up to ${MAX_EXTRA_DOCS} files here.`);
    }
    setError(null);
    setFiles((p) => ({ ...p, [key]: [...p[key], ...picked] }));
  };

  const removeExtraDoc = (key: "certifications" | "others", i: number) =>
    setFiles((p) => ({ ...p, [key]: p[key].filter((_, idx) => idx !== i) }));

  const next = () => {
    const message = validateStep(step, form, files);
    if (message) return setError(message);
    setError(null);
    setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  };

  const back = () => {
    setError(null);
    setStep((s) => Math.max(s - 1, 1));
  };

  const handleFinalSubmit = async () => {
    setError(null);
    for (const s of [1, 2, 3, 4]) {
      const message = validateStep(s, form, files);
      if (message) {
        setStep(s);
        return setError(message);
      }
    }

    setSubmitting(true);
    let createdUser: User | null = null;
    try {
      // 1. Create the Firebase account.
      createdUser = await signUp(form.email.trim(), form.password);
      const token = await getToken();
      if (!token) throw new Error("Your session expired. Please try again.");

      // 2. Upload every file, one at a time (kinder to slow connections).
      const total =
        files.photos.length + 2 + files.certifications.length + files.others.length;
      let done = 0;
      const up = async (file: File, kind: "company_photo" | "company_doc") => {
        setProgress(`Uploading file ${done + 1} of ${total}...`);
        const url = await uploadFile(token, file, kind);
        done += 1;
        return url;
      };

      const photos: string[] = [];
      for (const f of files.photos) photos.push(await up(f, "company_photo"));
      const businessRegistrationUrl = await up(files.registration as File, "company_doc");
      const idCardUrl = await up(files.idCard as File, "company_doc");
      const certificationUrls: string[] = [];
      for (const f of files.certifications) certificationUrls.push(await up(f, "company_doc"));
      const otherUrls: string[] = [];
      for (const f of files.others) otherUrls.push(await up(f, "company_doc"));

      // 3. Save the company (gives up after 20s instead of hanging).
      setProgress("Saving your application...");
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      let res: Response;
      try {
        res = await fetch("/api/company/register", {
          method: "POST",
          signal: controller.signal,
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            businessName: form.businessName.trim(),
            phone: form.phone,
            trades: form.trades,
            areas: form.areas,
            description: form.description.trim(),
            yearsOperating: Number(form.yearsOperating),
            technicianCount: Number(form.technicianCount),
            priceRange: form.priceRange,
            address: form.address.trim(),
            photos,
            documents: { businessRegistrationUrl, idCardUrl, certificationUrls, otherUrls },
          }),
        });
      } finally {
        clearTimeout(timer);
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Registration failed");
      }

      router.replace("/pending");
    } catch (err) {
      // If it couldn't be saved, remove the Firebase account so the owner can
      // retry with the same email instead of getting stuck.
      if (createdUser) {
        await createdUser.delete().catch(() => {});
      }
      const errInfo = err as { code?: unknown; name?: string } | null;
      const code = typeof errInfo?.code === "string" ? errInfo.code : "";
      if (code.startsWith("auth/")) setStep(1);

      setError(
        errInfo?.name === "AbortError"
          ? "The server took too long to respond. Check your connection and try again."
          : friendlyAuthError(err)
      );
    } finally {
      setProgress(null);
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-surface-muted px-6 py-10">
      <div className="mx-auto w-full max-w-md">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-ink">Create your company</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Let&apos;s get your business on Crafteey. Step {step} of {TOTAL_STEPS}.
          </p>
        </div>

        <StepIndicator step={step} />

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-lg bg-status-danger-bg p-3 text-sm text-status-danger"
          >
            {error}
          </p>
        )}

        {step === 1 && (
          <div className="mt-6 space-y-4">
            <h2 className="text-lg font-bold text-ink">Business information</h2>
            <Field label="Business name">
              <input
                className={inputClass}
                placeholder="e.g. Crafteey Plumbing Ltd."
                value={form.businessName}
                onChange={(e) => update("businessName", e.target.value)}
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                autoCapitalize="none"
                className={inputClass}
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
              />
            </Field>
            <Field label="Password">
              <input
                type="password"
                className={inputClass}
                value={form.password}
                onChange={(e) => update("password", e.target.value)}
              />
            </Field>
            <Field label="Phone number">
              <input
                type="tel"
                inputMode="tel"
                className={inputClass}
                placeholder="e.g. 0803 123 4567"
                value={form.phone}
                onChange={(e) => update("phone", e.target.value)}
              />
            </Field>
            <div>
              <p className="mb-2 text-sm font-medium text-ink">What services do you provide?</p>
              <div className="space-y-2">
                {TRADE_CATEGORIES.map((t) => (
                  <CheckRow
                    key={t}
                    label={TRADE_LABELS[t]}
                    checked={form.trades.includes(t)}
                    onChange={() => toggleTrade(t)}
                  />
                ))}
              </div>
            </div>
            <button
              onClick={next}
              className="min-h-12 w-full rounded-xl bg-brand py-3 font-semibold text-brand-ink"
            >
              Continue
            </button>
            <p className="text-center text-sm text-ink-muted">
              Already registered?{" "}
              <Link href="/login" className="font-semibold text-brand-dark">
                Log in
              </Link>
            </p>
          </div>
        )}

        {step === 2 && (
          <div className="mt-6 space-y-4">
            <h2 className="text-lg font-bold text-ink">Where do you work?</h2>
            <p className="text-sm text-ink-muted">Choose every area you cover.</p>
            <input
              className={inputClass}
              placeholder="Search area"
              value={areaQuery}
              onChange={(e) => setAreaQuery(e.target.value)}
            />
            <div className="space-y-2">
              {visibleAreas.length === 0 && (
                <p className="text-sm text-ink-muted">No area matches that search.</p>
              )}
              {visibleAreas.map((a) => (
                <CheckRow
                  key={a}
                  label={a}
                  checked={form.areas.includes(a)}
                  onChange={() => toggleArea(a)}
                />
              ))}
            </div>
            <p className="text-xs text-ink-muted">{form.areas.length} selected</p>
            <NavButtons onBack={back} onNext={next} />
          </div>
        )}

        {step === 3 && (
          <div className="mt-6 space-y-4">
            <h2 className="text-lg font-bold text-ink">Company details</h2>
            <Field label="About your company (optional)">
              <textarea
                className={inputClass}
                rows={3}
                maxLength={600}
                placeholder="Tell customers about your business"
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
              />
            </Field>
            <Field label="Years operating">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={80}
                className={inputClass}
                placeholder="0 if new"
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
            <Field label="Business address">
              <textarea
                className={inputClass}
                rows={2}
                maxLength={200}
                placeholder="e.g. 12 Osolo Way, Yaba"
                value={form.address}
                onChange={(e) => update("address", e.target.value)}
              />
            </Field>

            <div>
              <p className="mb-2 text-sm font-medium text-ink">
                Photos of your work (optional, up to {MAX_PHOTOS})
              </p>
              <div className="flex flex-wrap gap-2">
                {photoPreviews.map((src, i) => (
                  <div key={src} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={src}
                      alt={`Photo ${i + 1}`}
                      className="h-20 w-20 rounded-xl border border-surface-border object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto(i)}
                      aria-label={`Remove photo ${i + 1}`}
                      className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-status-danger text-sm font-bold text-white"
                    >
                      ×
                    </button>
                  </div>
                ))}
                {files.photos.length < MAX_PHOTOS && (
                  <label className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-surface-border bg-surface text-2xl text-ink-muted">
                    +
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        addPhotos(e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </label>
                )}
              </div>
            </div>

            <NavButtons onBack={back} onNext={next} />
          </div>
        )}

        {step === 4 && (
          <div className="mt-6 space-y-4">
            <h2 className="text-lg font-bold text-ink">Upload documents</h2>
            <p className="text-sm text-ink-muted">
              A clear photo or a PDF is fine. Files must be under {MAX_DOC_MB}MB.
            </p>

            <DocPicker
              label="Business registration"
              required
              file={files.registration}
              onPick={(l) => setSingleDoc("registration", l)}
              onClear={() => setFiles((p) => ({ ...p, registration: null }))}
            />
            <DocPicker
              label="ID card"
              required
              file={files.idCard}
              onPick={(l) => setSingleDoc("idCard", l)}
              onClear={() => setFiles((p) => ({ ...p, idCard: null }))}
            />
            <MultiDocPicker
              label="Certifications (optional)"
              list={files.certifications}
              max={MAX_EXTRA_DOCS}
              onAdd={(l) => addExtraDocs("certifications", l)}
              onRemove={(i) => removeExtraDoc("certifications", i)}
            />
            <MultiDocPicker
              label="Other documents (optional)"
              list={files.others}
              max={MAX_EXTRA_DOCS}
              onAdd={(l) => addExtraDocs("others", l)}
              onRemove={(i) => removeExtraDoc("others", i)}
            />

            <NavButtons onBack={back} onNext={next} />
          </div>
        )}

        {step === 5 && (
          <div className="mt-6 space-y-4">
            <h2 className="text-lg font-bold text-ink">Review your application</h2>

            <ul className="space-y-3 rounded-2xl border border-surface-border bg-surface p-4 text-sm text-ink">
              <ReviewRow label="Business" value={form.businessName.trim()} />
              <ReviewRow
                label="Services"
                value={form.trades.map((t) => TRADE_LABELS[t]).join(", ")}
              />
              <ReviewRow label="Areas" value={`${form.areas.length} selected`} />
              <ReviewRow
                label="Details"
                value={`${form.yearsOperating} years, ${form.technicianCount} technicians, ${
                  form.priceRange ? PRICE_RANGE_LABELS[form.priceRange] : ""
                }`}
              />
              <ReviewRow
                label="Documents"
                value={`${2 + files.certifications.length + files.others.length} files, ${
                  files.photos.length
                } photos`}
              />
            </ul>

            <p className="rounded-xl bg-surface p-3 text-sm text-ink-muted">
              After you submit, visit the Crafteey office to complete onboarding and sign
              your agreement. We approve your company once that is done.
            </p>

            {progress && (
              <p className="text-center text-sm font-medium text-ink" aria-live="polite">
                {progress}
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={back}
                disabled={submitting}
                className="min-h-12 flex-1 rounded-xl border border-surface-border py-3 font-semibold text-ink disabled:opacity-60"
              >
                Back
              </button>
              <button
                onClick={handleFinalSubmit}
                disabled={submitting}
                className="min-h-12 flex-1 rounded-xl bg-brand py-3 font-semibold text-brand-ink disabled:opacity-60"
              >
                {submitting ? "Submitting..." : "Submit application"}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function StepIndicator({ step }: { step: number }) {
  return (
    <div className="mt-6 flex items-start justify-between">
      {STEP_LABELS.map((label, i) => {
        const num = i + 1;
        const reached = num <= step;
        return (
          <div key={label} className="flex flex-1 flex-col items-center">
            <div className="flex w-full items-center">
              {i > 0 && (
                <div className={`h-0.5 flex-1 ${reached ? "bg-brand" : "bg-surface-border"}`} />
              )}
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  reached ? "bg-brand text-brand-ink" : "bg-surface-border text-ink-faint"
                }`}
              >
                {num}
              </div>
              {i < STEP_LABELS.length - 1 && (
                <div className={`h-0.5 flex-1 ${num < step ? "bg-brand" : "bg-surface-border"}`} />
              )}
            </div>
            <span
              className={`mt-1.5 text-[11px] font-medium ${
                num === step ? "text-ink" : "text-ink-faint"
              }`}
            >
              {label}
            </span>
          </div>
        );
      })}
    </div>
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

function CheckRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label
      className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 ${
        checked ? "border-brand bg-surface" : "border-surface-border bg-surface"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-5 w-5 shrink-0 accent-[currentColor]"
      />
      <span className="text-ink">{label}</span>
    </label>
  );
}

function NavButtons({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  return (
    <div className="flex gap-3">
      <button
        onClick={onBack}
        className="min-h-12 flex-1 rounded-xl border border-surface-border py-3 font-semibold text-ink"
      >
        Back
      </button>
      <button
        onClick={onNext}
        className="min-h-12 flex-1 rounded-xl bg-brand py-3 font-semibold text-brand-ink"
      >
        Continue
      </button>
    </div>
  );
}

function DocPicker({
  label,
  required,
  file,
  onPick,
  onClear,
}: {
  label: string;
  required?: boolean;
  file: File | null;
  onPick: (list: FileList | null) => void;
  onClear: () => void;
}) {
  return (
    <div className="rounded-xl border border-surface-border bg-surface p-4">
      <p className="text-sm font-medium text-ink">
        {label} {required && <span className="text-xs text-ink-muted">(required)</span>}
      </p>
      {file ? (
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="truncate text-sm text-ink-muted">{file.name}</p>
          <button
            type="button"
            onClick={onClear}
            className="min-h-10 shrink-0 rounded-full border border-surface-border px-4 text-xs font-medium text-status-danger"
          >
            Remove
          </button>
        </div>
      ) : (
        <label className="mt-2 flex min-h-12 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-surface-border text-sm text-ink-muted">
          Tap to upload
          <input
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => {
              onPick(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
      )}
    </div>
  );
}

function MultiDocPicker({
  label,
  list,
  max,
  onAdd,
  onRemove,
}: {
  label: string;
  list: File[];
  max: number;
  onAdd: (list: FileList | null) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="rounded-xl border border-surface-border bg-surface p-4">
      <p className="text-sm font-medium text-ink">{label}</p>
      <ul className="mt-2 space-y-2">
        {list.map((f, i) => (
          <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-3">
            <span className="truncate text-sm text-ink-muted">{f.name}</span>
            <button
              type="button"
              onClick={() => onRemove(i)}
              className="min-h-10 shrink-0 rounded-full border border-surface-border px-4 text-xs font-medium text-status-danger"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      {list.length < max && (
        <label className="mt-2 flex min-h-12 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-surface-border text-sm text-ink-muted">
          Tap to add
          <input
            type="file"
            accept="image/*,application/pdf"
            multiple
            className="hidden"
            onChange={(e) => {
              onAdd(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
      )}
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 text-brand-dark" aria-hidden="true">
        ✓
      </span>
      <span>
        <span className="font-semibold">{label}: </span>
        <span className="text-ink-muted">{value}</span>
      </span>
    </li>
  );
}