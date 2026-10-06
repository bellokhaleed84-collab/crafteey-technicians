
export const TRADE_CATEGORIES = [
  "plumbing",
  "painting",
  "electrical",
  "carpentry",
  "tiling",
  "ac_repair",
  "masonry",
  "welding",
  "generator",
] as const;

export type TradeCategory = (typeof TRADE_CATEGORIES)[number];

export const TRADE_LABELS: Record<TradeCategory, string> = {
  plumbing: "Plumbing",
  painting: "Painting",
  electrical: "Electrical",
  carpentry: "Carpentry",
  tiling: "Tiling",
  ac_repair: "AC & Refrigeration",
  masonry: "Masonry",
  welding: "Welding",
  generator: "Generator",
};

export function isTradeCategory(value: unknown): value is TradeCategory {
  return typeof value === "string" && (TRADE_CATEGORIES as readonly string[]).includes(value);
}