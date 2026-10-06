type Init = Omit<RequestInit, "headers"> & { headers?: Record<string, string> };

// Adds the auth token and JSON header. Throws if signed out, so pages never
// send "Bearer null".
export async function apiFetch(
  getToken: () => Promise<string | null>,
  url: string,
  init: Init = {}
): Promise<Response> {
  const token = await getToken();
  if (!token) throw new Error("You're signed out. Please log in again.");
  return fetch(url, {
    ...init,
    cache: "no-store",
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function readError(res: Response, fallback: string): Promise<string> {
  const data = await res.json().catch(() => ({}));
  return data.error || fallback;
}