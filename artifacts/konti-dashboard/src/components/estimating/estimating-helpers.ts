// Shared helpers for the estimating UI: API base, auth header, fetch wrappers.

export function apiBase(): string {
  return (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
}

export function getAuthHeader(): Record<string, string> {
  try {
    const stored = localStorage.getItem("konti_auth");
    if (!stored) return {};
    const parsed = JSON.parse(stored) as { token?: string | null };
    return parsed.token ? { Authorization: `Bearer ${parsed.token}` } : {};
  } catch {
    return {};
  }
}

export async function postJson<T>(path: string, body: unknown): Promise<T> {
  return await sendJson<T>("POST", path, body);
}

export async function putJson<T>(path: string, body: unknown): Promise<T> {
  return await sendJson<T>("PUT", path, body);
}

// Carries the full server JSON payload so callers can surface structured
// fields (e.g. skippedDetails) when an import fails.
export class ApiError extends Error {
  status: number;
  payload: Record<string, unknown>;
  constructor(message: string, status: number, payload: Record<string, unknown>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

async function sendJson<T>(method: "POST" | "PUT", path: string, body: unknown): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...getAuthHeader() },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const msg = (typeof err["message"] === "string" ? (err["message"] as string) : undefined) ?? `Request failed (${res.status})`;
    throw new ApiError(msg, res.status, err);
  }
  return (await res.json()) as T;
}

export async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, { headers: { ...getAuthHeader() } });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return (await res.json()) as T;
}

export async function readFileAsText(file: File): Promise<string> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    const XLSX = await import("xlsx");
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const firstSheet = wb.SheetNames[0];
    if (!firstSheet) throw new Error("empty_workbook");
    const sheet = wb.Sheets[firstSheet];
    if (!sheet) throw new Error("empty_sheet");
    return XLSX.utils.sheet_to_csv(sheet);
  }
  return await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? ""));
    r.onerror = () => reject(new Error("file_read_error"));
    r.readAsText(file);
  });
}

export interface VarianceBucket {
  key: string;
  labelEn: string;
  labelEs: string;
  estimated: number;
  actual: number;
  // Total amount the team has billed the client against this bucket
  // (sourced from PROJECT_INVOICES on the API). The "unassigned" bucket
  // captures invoices that were billed but don't belong to M/L/S
  // (design-phase, closeout, overhead).
  invoiced: number;
  variance: number;
  // `null` whenever the comparison base is zero (e.g. invoiced=0 with
  // actual>0). The UI renders these as "—" instead of a misleading "0%".
  variancePercent: number | null;
  // Actual − Invoiced (positive = team spent more than it billed; negative
  // = invoiced more than spent so far). Surfaced alongside the existing
  // estimated-vs-actual variance pill so the team can see both deltas.
  varianceVsInvoiced: number;
  varianceVsInvoicedPercent: number | null;
  status: "on_track" | "warning" | "over";
}

export interface VarianceReport {
  projectId: string;
  projectName: string;
  estimateSource: "contractor_estimate" | "calculator_entries";
  generatedAt: string;
  buckets: VarianceBucket[];
  materialCategories: Array<{
    category: string;
    estimated: number;
    actual: number;
    invoiced: number;
    variance: number;
    variancePercent: number | null;
    varianceVsInvoiced: number;
    varianceVsInvoicedPercent: number | null;
  }>;
  totals: {
    estimated: number;
    actual: number;
    // Total of every invoice on the project, including ones that don't
    // fit the M/L/S cost plan (kept for cashflow displays).
    invoiced: number;
    // Apples-to-apples comparison base for `varianceVsInvoiced`: only the
    // M/L/S invoices, so the delta has matching scope on both sides.
    invoicedInPlan: number;
    // Invoices that fell outside M/L/S (design / closeout / overhead).
    // Surfaced separately so we can show "$X also billed outside plan".
    invoicedUnassigned: number;
    variance: number;
    variancePercent: number | null;
    // = totals.actual − totals.invoicedInPlan (NOT − totals.invoiced).
    varianceVsInvoiced: number;
    varianceVsInvoicedPercent: number | null;
  };
}

export interface ContractorEstimate {
  projectId: string;
  source: string;
  squareMeters: number;
  projectType: string;
  scope: string[];
  bathrooms?: number;
  kitchens?: number;
  lines: Array<{ id: string; category: string; description: string; descriptionEs: string; quantity: number; unit: string; unitPrice: number; lineTotal: number }>;
  subtotalMaterials: number;
  subtotalLabor: number;
  subtotalSubcontractor: number;
  contingencyPercent: number;
  contingency: number;
  marginPercent?: number;
  marginAmount?: number;
  managementFeePercent?: number;
  managementFeeAmount?: number;
  grandTotal: number;
  generatedAt: string;
  generatedBy: string;
}

export interface LaborRate {
  trade: string;
  tradeEs: string;
  unit: string;
  hourlyRate: number;
  source: "seed" | "import" | "receipts";
  updatedAt: string;
}
