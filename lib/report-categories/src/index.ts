// Single source of truth for the KONTi project-report category model.
//
// The team's PROJECT ESTIMATE spreadsheet
// (attached_assets/1b)_KONTI_DESIGN_CONSTRUCTION_ESTIMATE_-_BENITO_COLON…)
// rolls every project cost into five top-level buckets, in this order:
//
//   1. DESIGN AND DATA COLLECTION   (Plans, Soil Study, Survey, …)
//   2. PERMITS & SERVICE FEES       (Municipal Patent, Permit fees, Insurance)
//   3. PRODUCT (CONTAINERS)         (Container purchase, structural prep,
//                                    interior build, finishes, …)
//   4. EXTERIOR & ADD-ONS           (Foundation, Site Electric/Plumbing,
//                                    Steel Structure, Decking, Site Work, …)
//   5. CONSTRUCTION CONTINGENCY     (reserved budget for unforeseen costs)
//
// Both the api-server rollup endpoints and the project-report.tsx renderer
// import from this module so the platform report and the team's emailed PDF
// stay in lockstep. Raw line items keep their existing trade-level "category"
// field — the mapping happens at rollup-time only.

export type ReportBucketKey =
  | "design_data_collection"
  | "permits_service_fees"
  | "product_containers"
  | "exterior_add_ons"
  | "construction_contingency";

export const REPORT_BUCKET_KEYS: readonly ReportBucketKey[] = [
  "design_data_collection",
  "permits_service_fees",
  "product_containers",
  "exterior_add_ons",
  "construction_contingency",
] as const;

export const REPORT_BUCKET_LABELS: Record<ReportBucketKey, { en: string; es: string }> = {
  design_data_collection:   { en: "Design & Data Collection", es: "Diseño y Recolección de Datos" },
  permits_service_fees:     { en: "Permits & Service Fees",   es: "Permisos y Tasas de Servicio" },
  product_containers:       { en: "Product (Containers)",     es: "Producto (Contenedores)" },
  exterior_add_ons:         { en: "Exterior & Add-Ons",       es: "Exterior y Complementos" },
  construction_contingency: { en: "Construction Contingency", es: "Contingencia de Construcción" },
};

// Trade-level category → team bucket mapping. Built from the line items in
// the BENITO_COLON estimate XLSX:
//   - foundation, site electric, site plumbing, decking, steel structure
//     → EXTERIOR & ADD-ONS
//   - container purchase, structural prep, container infrastructure,
//     interior build, finishes, kitchen, bathroom, detailing, cleanup
//     → PRODUCT (CONTAINERS)  (this bucket also absorbs the trade-level
//     labor and most internal trade work, since the team's XLSX includes
//     labor inside each container line)
const TRADE_TO_BUCKET: Record<string, ReportBucketKey> = {
  // Trade keys used by CALCULATOR_ENTRIES and contractor-estimate lines.
  foundation:    "exterior_add_ons",
  steel:         "product_containers",
  electrical:    "product_containers",
  plumbing:      "product_containers",
  finishes:      "product_containers",
  insulation:    "product_containers",
  lumber:        "product_containers",
  labor:         "product_containers",
  subcontractor: "exterior_add_ons",

  // Spreadsheet-named exterior trades from the BENITO_COLON estimate. These
  // keys aren't in CALCULATOR_ENTRIES today, but if a future estimate tags
  // a line with the human-readable spreadsheet term we still want it routed
  // to EXTERIOR & ADD-ONS instead of falling through to the default bucket.
  "site electric":   "exterior_add_ons",
  "site_electric":   "exterior_add_ons",
  "site-electric":   "exterior_add_ons",
  "site plumbing":   "exterior_add_ons",
  "site_plumbing":   "exterior_add_ons",
  "site-plumbing":   "exterior_add_ons",
  "site work":       "exterior_add_ons",
  "site_work":       "exterior_add_ons",
  "site-work":       "exterior_add_ons",
  "decking":         "exterior_add_ons",
  "steel structure": "exterior_add_ons",
  "steel_structure": "exterior_add_ons",
  "steel-structure": "exterior_add_ons",
  "exterior":        "exterior_add_ons",

  // Direct bucket keys (in case future estimate lines tag at the bucket
  // level — keeps the mapper idempotent).
  design_data_collection:   "design_data_collection",
  permits_service_fees:     "permits_service_fees",
  product_containers:       "product_containers",
  exterior_add_ons:         "exterior_add_ons",
  construction_contingency: "construction_contingency",

  // Document/seed-side category names that overlap with this column.
  design:       "design_data_collection",
  permits:      "permits_service_fees",
  contingency:  "construction_contingency",
  construction: "product_containers",
};

export function bucketForTradeCategory(rawCategory: string | null | undefined): ReportBucketKey {
  if (!rawCategory) return "product_containers";
  // Normalize whitespace so "  Foundation  " or "Steel Structure" still
  // match a canonical key. Unknown trades fall back to PRODUCT (CONTAINERS)
  // since the team's PROJECT ESTIMATE spreadsheet absorbs internal trade
  // work into that bucket.
  const normalized = rawCategory.trim().toLowerCase();
  return TRADE_TO_BUCKET[normalized] ?? "product_containers";
}

export function reportBucketLabel(key: string, lang: string): string {
  const k = key as ReportBucketKey;
  const entry = REPORT_BUCKET_LABELS[k];
  if (!entry) {
    // Fall through to the raw key for unknown buckets (defensive — every
    // production code-path should pass a canonical bucket key).
    return key;
  }
  return lang === "es" ? entry.es : entry.en;
}

export interface BucketRollupRow {
  key: ReportBucketKey;
  labelEn: string;
  labelEs: string;
  total: number;
}

// Group {category, total} pairs into the team's five canonical buckets and
// always return all five entries in canonical order, even when a bucket has
// zero spend so far. The report UI renders empty buckets as "—" so clients
// can see the structure mirrors the team's emailed PDF.
export function rollupByBucket(
  pairs: Array<{ category: string; total: number }>,
): BucketRollupRow[] {
  const totals = new Map<ReportBucketKey, number>();
  for (const key of REPORT_BUCKET_KEYS) totals.set(key, 0);
  for (const pair of pairs) {
    if (!Number.isFinite(pair.total)) continue;
    const bucket = bucketForTradeCategory(pair.category);
    totals.set(bucket, (totals.get(bucket) ?? 0) + pair.total);
  }
  return REPORT_BUCKET_KEYS.map((key) => ({
    key,
    labelEn: REPORT_BUCKET_LABELS[key].en,
    labelEs: REPORT_BUCKET_LABELS[key].es,
    total: totals.get(key) ?? 0,
  }));
}

// Convenience: collapse a Record<rawCategoryKey, number> directly into the
// five-bucket rollup. Used by the calculations endpoint where the raw rollup
// is already keyed by trade-level category.
export function rollupRecordByBucket(
  byCategory: Record<string, number>,
): BucketRollupRow[] {
  return rollupByBucket(
    Object.entries(byCategory).map(([category, total]) => ({ category, total })),
  );
}

// Legacy trade-level labels — kept so the team-side Material Cost Summary on
// project-detail.tsx (which still renders raw trade categories per line) can
// share a single label dictionary with the bucket rollup.
const TRADE_LABELS: Record<string, { en: string; es: string }> = {
  foundation:    { en: "Foundation",        es: "Cimientos" },
  steel:         { en: "Steel / Container", es: "Acero / Contenedor" },
  electrical:    { en: "Electrical",        es: "Eléctrico" },
  plumbing:      { en: "Plumbing",          es: "Plomería" },
  finishes:      { en: "Finishes",          es: "Acabados" },
  insulation:    { en: "Insulation",        es: "Aislamiento" },
  lumber:        { en: "Lumber",            es: "Madera" },
  labor:         { en: "Labor",             es: "Mano de Obra" },
  subcontractor: { en: "Subcontractor",     es: "Subcontratistas" },
};

export function tradeCategoryLabel(key: string, lang: string): string {
  const entry = TRADE_LABELS[key.toLowerCase()];
  if (entry) return lang === "es" ? entry.es : entry.en;
  return key.charAt(0).toUpperCase() + key.slice(1);
}
