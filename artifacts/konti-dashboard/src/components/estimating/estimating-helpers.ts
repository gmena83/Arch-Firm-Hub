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
  const res = await fetch(`${apiBase()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeader() },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(err.message ?? `Request failed (${res.status})`);
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
  variance: number;
  variancePercent: number;
  status: "on_track" | "warning" | "over";
}

export interface VarianceReport {
  projectId: string;
  projectName: string;
  estimateSource: "contractor_estimate" | "calculator_entries";
  generatedAt: string;
  buckets: VarianceBucket[];
  materialCategories: Array<{ category: string; estimated: number; actual: number; variance: number; variancePercent: number }>;
  totals: { estimated: number; actual: number; variance: number; variancePercent: number };
}

export interface ContractorEstimate {
  projectId: string;
  source: string;
  squareMeters: number;
  projectType: string;
  scope: string[];
  lines: Array<{ id: string; category: string; description: string; descriptionEs: string; quantity: number; unit: string; unitPrice: number; lineTotal: number }>;
  subtotalMaterials: number;
  subtotalLabor: number;
  subtotalSubcontractor: number;
  contingencyPercent: number;
  contingency: number;
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
