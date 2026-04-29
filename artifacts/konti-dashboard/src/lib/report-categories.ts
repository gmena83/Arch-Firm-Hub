// Mirror of REPORT_CATEGORY_KEYS / REPORT_CATEGORY_LABELS in
// artifacts/api-server/src/data/seed.ts so the report.tsx category card uses
// the same canonical en/es labels as the server-side estimating bucketing.
// Update both files together when categories change.
export type ReportCategoryKey =
  | "foundation"
  | "steel"
  | "electrical"
  | "plumbing"
  | "finishes"
  | "labor"
  | "subcontractor";

export const REPORT_CATEGORY_KEYS: ReportCategoryKey[] = [
  "foundation",
  "steel",
  "electrical",
  "plumbing",
  "finishes",
  "labor",
  "subcontractor",
];

export const REPORT_CATEGORY_LABELS: Record<ReportCategoryKey, { en: string; es: string }> = {
  foundation:    { en: "Foundation",        es: "Cimientos" },
  steel:         { en: "Steel / Container", es: "Acero / Contenedor" },
  electrical:    { en: "Electrical",        es: "Eléctrico" },
  plumbing:      { en: "Plumbing",          es: "Plomería" },
  finishes:      { en: "Finishes",          es: "Acabados" },
  labor:         { en: "Labor",             es: "Mano de Obra" },
  subcontractor: { en: "Subcontractor",     es: "Subcontratistas" },
};

export function reportCategoryLabel(key: string, lang: string): string {
  const k = key.toLowerCase() as ReportCategoryKey;
  const entry = REPORT_CATEGORY_LABELS[k];
  if (entry) return lang === "es" ? entry.es : entry.en;
  // Fall through to the raw category name for unknown / spreadsheet-extra keys.
  return key.charAt(0).toUpperCase() + key.slice(1);
}
