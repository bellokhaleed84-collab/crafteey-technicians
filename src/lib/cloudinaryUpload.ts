export type UploadKind = "logo" | "company_photo" | "company_doc";

export const MAX_IMAGE_MB = 5;
const UPLOAD_TIMEOUT_MS = 60000;

/** Returns an error message, or null if the file is a usable photo. */
export function checkImage(file: File): string | null {
  if (!file.type.startsWith("image/")) return "Please choose a photo (JPG or PNG).";
  if (file.size > MAX_IMAGE_MB * 1024 * 1024) return `Each photo must be under ${MAX_IMAGE_MB}MB.`;
  return null;
}

/** Uploads one file to Cloudinary with a signed request and returns its https link. */
export async function uploadFile(token: string, file: File, kind: UploadKind): Promise<string> {
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