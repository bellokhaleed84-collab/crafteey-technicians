export const COMPANY_AREAS = [
  "Agege",
  "Ajah",
  "Alimosho",
  "Apapa",
  "Badagry",
  "Epe",
  "Festac",
  "Gbagada",
  "Ikeja",
  "Ikorodu",
  "Ikotun",
  "Ikoyi",
  "Isolo",
  "Ketu",
  "Lekki",
  "Magodo",
  "Maryland",
  "Mushin",
  "Ogba",
  "Ojota",
  "Oshodi",
  "Surulere",
  "Victoria Island",
  "Yaba",
] as const;

export type CompanyArea = (typeof COMPANY_AREAS)[number];

export function isCompanyArea(value: unknown): value is CompanyArea {
  return typeof value === "string" && (COMPANY_AREAS as readonly string[]).includes(value);
}

export const COMPANY_PRICE_RANGES = ["low", "mid", "high"] as const;
export type CompanyPriceRangeValue = (typeof COMPANY_PRICE_RANGES)[number];

export const PRICE_RANGE_LABELS: Record<CompanyPriceRangeValue, string> = {
  low: "Affordable",
  mid: "Mid-range",
  high: "High-end",
};

export function isPriceRange(value: unknown): value is CompanyPriceRangeValue {
  return typeof value === "string" && (COMPANY_PRICE_RANGES as readonly string[]).includes(value);
}