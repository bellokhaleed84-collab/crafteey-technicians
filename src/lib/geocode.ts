const TOKEN =
  process.env.MAPBOX_ACCESS_TOKEN ||
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN ||
  process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

// Rough Nigeria bounds, to catch obviously wrong coordinates.
export function isPlausibleNigeriaCoord(lat: number, lng: number) {
  return lat >= 4 && lat <= 14 && lng >= 2.5 && lng <= 15;
}

export async function geocodeAddress(
  query: string
): Promise<{ lat: number; lng: number; placeName: string } | null> {
  if (!TOKEN) throw new Error("Mapbox token isn't configured");
  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json` +
    `?access_token=${TOKEN}&country=ng&limit=1&proximity=3.3792,6.5244`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const f = data?.features?.[0];
  if (!f?.center) return null;
  return { lng: f.center[0], lat: f.center[1], placeName: f.place_name };
}