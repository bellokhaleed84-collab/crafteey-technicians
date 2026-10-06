"use client";

import { useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch, readError } from "@/lib/apiClient";

const MAX_MB = 5;

export default function ImageUpload({
  value,
  onChange,
  onUploadingChange,
  kind = "product",
}: {
  value: string;
  onChange: (url: string) => void;
  onUploadingChange?: (uploading: boolean) => void;
  kind?: "product" | "logo";
}) {
  const { getToken } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const isLogo = kind === "logo";

  const setBusy = (v: boolean) => {
    setUploading(v);
    onUploadingChange?.(v);
  };

  async function handleFile(file: File) {
    setError("");
    if (!file.type.startsWith("image/")) return setError("Please choose an image file.");
    if (file.size > MAX_MB * 1024 * 1024) return setError(`Image must be under ${MAX_MB}MB.`);

    setBusy(true);
    try {
      const signRes = await apiFetch(getToken, "/api/upload/sign", {
        method: "POST",
        body: JSON.stringify({ kind }),
      });
      if (!signRes.ok) throw new Error(await readError(signRes, "Couldn't start the upload."));
      const { cloudName, apiKey, timestamp, signature, folder } = await signRes.json();

      const form = new FormData();
      form.append("file", file);
      form.append("api_key", apiKey);
      form.append("timestamp", String(timestamp));
      form.append("signature", signature);
      form.append("folder", folder);

      const up = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: "POST",
        body: form,
      });
      const data = await up.json();
      if (!up.ok || !data.secure_url) throw new Error(data?.error?.message || "Upload failed.");
      onChange(data.secure_url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed. Try again.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />

      {value ? (
        isLogo ? (
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt="Store logo"
              className="h-28 w-28 rounded-2xl border border-surface-border bg-surface object-contain"
            />
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
                className="rounded-full border border-surface-border px-4 py-1.5 text-xs font-medium text-ink"
              >
                {uploading ? "Uploading…" : "Change"}
              </button>
              <button
                type="button"
                onClick={() => onChange("")}
                disabled={uploading}
                className="rounded-full border border-surface-border px-4 py-1.5 text-xs font-medium text-status-danger"
              >
                Remove
              </button>
            </div>
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-2xl border border-surface-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt="Product" className="h-48 w-full object-cover" />
            <div className="absolute bottom-2 right-2 flex gap-2">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
                className="rounded-full bg-surface/90 px-3 py-1 text-xs font-medium text-ink shadow"
              >
                {uploading ? "Uploading…" : "Change"}
              </button>
              <button
                type="button"
                onClick={() => onChange("")}
                disabled={uploading}
                className="rounded-full bg-surface/90 px-3 py-1 text-xs font-medium text-status-danger shadow"
              >
                Remove
              </button>
            </div>
          </div>
        )
      ) : isLogo ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex h-28 w-28 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-surface-border bg-surface text-sm text-ink-muted"
        >
          {uploading ? "Uploading…" : "Tap to add logo"}
          <span className="mt-1 text-xs text-ink-faint">Up to {MAX_MB}MB</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex h-40 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-surface-border bg-surface text-sm text-ink-muted"
        >
          {uploading ? "Uploading…" : "Tap to add a photo"}
          <span className="mt-1 text-xs text-ink-faint">JPG or PNG, up to {MAX_MB}MB</span>
        </button>
      )}

      {error && <p className="mt-2 text-sm text-status-danger">{error}</p>}
    </div>
  );
}