import { Router, type IRouter } from "express";
import {
  PROJECTS,
  MATERIALS,
  CALCULATOR_ENTRIES,
  PROJECT_COST_PLUS,
  appendActivity,
} from "../data/seed";
import { requireRole } from "../middlewares/require-role";
import { enforceClientOwnership } from "../middlewares/client-ownership";
import {
  loadEstimatingFromDisk,
  saveEstimatingToDisk,
} from "../lib/estimating-persistence";
import { extractAndParseReceipt } from "../lib/receipt-ocr";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// In-memory stores (demo session) — survive until process restart.
// ---------------------------------------------------------------------------

export interface ImportedMaterial {
  id: string;
  item: string;
  itemEs: string;
  category: string;
  unit: string;
  basePrice: number;
}

export interface LaborRate {
  trade: string;
  tradeEs: string;
  unit: string; // hour | day | sqft | unit
  hourlyRate: number;
  source: "seed" | "import" | "receipts";
  updatedAt: string;
}

export interface Receipt {
  id: string;
  vendor: string;
  date: string;
  trade: string;
  amount: number;
  hours: number;
}

export interface ReportTemplate {
  name: string;
  columns: string[];
  headerLines: string[];
  footer: string;
  uploadedAt: string;
  uploadedBy: string;
}

export interface ContractorEstimateLine {
  id: string;
  category: string;
  description: string;
  descriptionEs: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  lineTotal: number;
}

export interface ContractorEstimate {
  projectId: string;
  source: string;
  squareMeters: number;
  projectType: string;
  scope: string[];
  bathrooms: number;
  kitchens: number;
  lines: ContractorEstimateLine[];
  subtotalMaterials: number;
  subtotalLabor: number;
  subtotalSubcontractor: number;
  contingencyPercent: number;
  contingency: number;
  marginPercent: number;
  marginAmount: number;
  managementFeePercent: number;
  managementFeeAmount: number;
  grandTotal: number;
  generatedAt: string;
  generatedBy: string;
}

export const EXTRA_MATERIALS: ImportedMaterial[] = [];

const DEFAULT_LABOR_RATES: LaborRate[] = [
  { trade: "General Labor", tradeEs: "Mano de Obra General", unit: "hour", hourlyRate: 22, source: "seed", updatedAt: "2026-01-01T00:00:00Z" },
  { trade: "Carpenter", tradeEs: "Carpintero", unit: "hour", hourlyRate: 38, source: "seed", updatedAt: "2026-01-01T00:00:00Z" },
  { trade: "Electrician", tradeEs: "Electricista", unit: "hour", hourlyRate: 55, source: "seed", updatedAt: "2026-01-01T00:00:00Z" },
  { trade: "Plumber", tradeEs: "Plomero", unit: "hour", hourlyRate: 52, source: "seed", updatedAt: "2026-01-01T00:00:00Z" },
  { trade: "Mason", tradeEs: "Albañil", unit: "hour", hourlyRate: 34, source: "seed", updatedAt: "2026-01-01T00:00:00Z" },
  { trade: "Welder", tradeEs: "Soldador", unit: "hour", hourlyRate: 48, source: "seed", updatedAt: "2026-01-01T00:00:00Z" },
];

export const LABOR_RATES: LaborRate[] = [];

export const PROJECT_RECEIPTS: Record<string, Receipt[]> = {};
export const PROJECT_REPORT_TEMPLATE: Record<string, ReportTemplate> = {};
export const PROJECT_CONTRACTOR_ESTIMATE: Record<string, ContractorEstimate> = {};

// ---------------------------------------------------------------------------
// Persistence — receipts, contractor estimates, report templates, imported
// materials, and labor-rate overrides survive an API server restart.
// ---------------------------------------------------------------------------

interface PersistedSnapshot {
  extraMaterials: ImportedMaterial[];
  laborRates: LaborRate[];
  receipts: Record<string, Receipt[]>;
  reportTemplates: Record<string, ReportTemplate>;
  contractorEstimates: Record<string, ContractorEstimate>;
}

function snapshotEstimatingState(): PersistedSnapshot {
  return {
    extraMaterials: EXTRA_MATERIALS,
    laborRates: LABOR_RATES,
    receipts: PROJECT_RECEIPTS,
    reportTemplates: PROJECT_REPORT_TEMPLATE,
    contractorEstimates: PROJECT_CONTRACTOR_ESTIMATE,
  };
}

export function applyEstimatingSnapshot(snap: PersistedSnapshot | null): void {
  EXTRA_MATERIALS.length = 0;
  LABOR_RATES.length = 0;
  for (const k of Object.keys(PROJECT_RECEIPTS)) delete PROJECT_RECEIPTS[k];
  for (const k of Object.keys(PROJECT_REPORT_TEMPLATE)) delete PROJECT_REPORT_TEMPLATE[k];
  for (const k of Object.keys(PROJECT_CONTRACTOR_ESTIMATE)) delete PROJECT_CONTRACTOR_ESTIMATE[k];

  if (snap && Array.isArray(snap.laborRates) && snap.laborRates.length > 0) {
    LABOR_RATES.push(...snap.laborRates);
  } else {
    LABOR_RATES.push(...DEFAULT_LABOR_RATES);
  }
  if (snap) {
    if (Array.isArray(snap.extraMaterials)) EXTRA_MATERIALS.push(...snap.extraMaterials);
    if (snap.receipts && typeof snap.receipts === "object") Object.assign(PROJECT_RECEIPTS, snap.receipts);
    if (snap.reportTemplates && typeof snap.reportTemplates === "object") Object.assign(PROJECT_REPORT_TEMPLATE, snap.reportTemplates);
    if (snap.contractorEstimates && typeof snap.contractorEstimates === "object") Object.assign(PROJECT_CONTRACTOR_ESTIMATE, snap.contractorEstimates);
  }
}

export function persistEstimatingState(): void {
  saveEstimatingToDisk(snapshotEstimatingState());
}

// Hydrate from disk on import; falls back to defaults when no file exists yet.
applyEstimatingSnapshot(loadEstimatingFromDisk<PersistedSnapshot>());

// ---------------------------------------------------------------------------
// CSV helper — strict, header-row required, comma-delimited, quoted strings OK.
// ---------------------------------------------------------------------------

function parseCsv(input: string): Array<Record<string, string>> {
  const rows: Array<Record<string, string>> = [];
  const lines = input
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 2) return rows;
  const headers = splitCsvRow(lines[0] as string).map((h) => h.toLowerCase());
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvRow(lines[i] as string);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j] as string] = (cells[j] ?? "").trim();
    }
    rows.push(row);
  }
  return rows;
}

function splitCsvRow(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { cur += c; }
    } else {
      if (c === ",") { out.push(cur); cur = ""; }
      else if (c === '"') { inQuotes = true; }
      else { cur += c; }
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

// GET combined materials list (seed + imported), used by frontend instead of /materials when imports are wanted.
router.get("/estimating/materials", requireRole(["team","admin","superadmin","architect","client"]), (_req, res) => {
  res.json([...MATERIALS, ...EXTRA_MATERIALS]);
});

// POST import materials from CSV body or JSON array. Role: team.
// When `projectId` is provided, also append imported materials as calculator
// lines for that project (default qty = 1) so the team doesn't have to add
// them again under Estimate → Add Material (CSV item #57).
router.post("/estimating/materials/import", requireRole(["team", "admin", "superadmin"]), (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;

  let rows: Array<Record<string, string>> = [];
  if (typeof body["csv"] === "string") {
    rows = parseCsv(body["csv"] as string);
  } else if (Array.isArray(body["materials"])) {
    rows = (body["materials"] as Array<Record<string, unknown>>).map((m) => {
      const o: Record<string, string> = {};
      for (const k of Object.keys(m)) o[k.toLowerCase()] = String(m[k] ?? "");
      return o;
    });
  } else {
    res.status(400).json({ error: "invalid_payload", message: "Provide csv (string) or materials (array)." });
    return;
  }

  if (rows.length === 0) {
    res.status(400).json({ error: "empty_import", message: "No rows parsed.", messageEs: "No se procesaron filas." });
    return;
  }

  const targetProjectId = typeof body["projectId"] === "string" ? (body["projectId"] as string) : undefined;
  const targetProject = targetProjectId ? PROJECTS.find((p) => p.id === targetProjectId) : undefined;
  if (targetProjectId && !targetProject) {
    res.status(400).json({ error: "invalid_project", message: `Project ${targetProjectId} not found.` });
    return;
  }

  const accepted: ImportedMaterial[] = [];
  const skipped: Array<{ row: number; reason: string }> = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] as Record<string, string>;
    const item = (r["item"] ?? r["material"] ?? r["name"] ?? r["description"] ?? r["descripcion"] ?? r["descripción"] ?? "").trim();
    const itemEs = (r["item_es"] ?? r["itemes"] ?? r["nombre"] ?? r["descripcion"] ?? r["descripción"] ?? item).trim();
    const category = (r["category"] ?? r["categoria"] ?? r["categoría"] ?? "").trim().toLowerCase();
    const unit = (r["unit"] ?? r["unidad"] ?? "").trim();
    const qtyRaw = (r["qty"] ?? r["quantity"] ?? r["cantidad"] ?? "1").replace(/[^0-9.]/g, "");
    const priceRaw = (r["base_price"] ?? r["baseprice"] ?? r["unit_price"] ?? r["unitprice"] ?? r["price"] ?? r["precio"] ?? r["preciounitario"] ?? r["precio_unitario"] ?? "").replace(/[^0-9.]/g, "");
    const basePrice = Number(priceRaw);
    const qty = Number(qtyRaw) > 0 ? Number(qtyRaw) : 1;
    if (!item || !category || !unit || !isFinite(basePrice) || basePrice <= 0) {
      skipped.push({ row: i + 2, reason: "missing item/category/unit/price" });
      continue;
    }
    const id = `mat-imp-${Date.now()}-${EXTRA_MATERIALS.length + accepted.length + 1}`;
    accepted.push({ id, item, itemEs, category, unit, basePrice });

    if (targetProject) {
      const calcMap = CALCULATOR_ENTRIES as Record<string, Array<Record<string, unknown>>>;
      const list = calcMap[targetProject.id] ?? (calcMap[targetProject.id] = []);
      list.push({
        id: `calc-imp-${Date.now()}-${list.length + 1}`,
        projectId: targetProject.id,
        materialId: id,
        materialName: item,
        materialNameEs: itemEs,
        category,
        unit,
        quantity: qty,
        basePrice,
        manualPriceOverride: null,
        effectivePrice: basePrice,
        lineTotal: basePrice * qty,
      });
    }
  }
  EXTRA_MATERIALS.push(...accepted);

  if (targetProject && accepted.length > 0) {
    appendActivity(targetProject.id, {
      type: "calculator_import",
      actor: (req as { user?: { name?: string } }).user?.name ?? "Team",
      description: `Auto-added ${accepted.length} imported material(s) to the project calculator.`,
      descriptionEs: `Se agregaron automáticamente ${accepted.length} material(es) importado(s) a la calculadora.`,
    });
  }

  persistEstimatingState();

  res.json({
    imported: accepted.length,
    skipped: skipped.length,
    skippedDetails: skipped,
    materials: accepted,
    totalCatalogSize: MATERIALS.length + EXTRA_MATERIALS.length,
    // Numeric count of lines auto-added to the target project's calculator
    // (0 when no projectId was supplied). Frontend uses this to render the
    // "N added to project calculator" toast detail.
    addedToProjectCalculator: targetProject ? accepted.length : 0,
    addedToProjectCalculatorId: targetProject ? targetProject.id : null,
  });
});

// GET labor rates
router.get("/estimating/labor-rates", requireRole(["team","admin","superadmin","architect","client"]), (_req, res) => {
  res.json({ rates: LABOR_RATES });
});

// POST import labor rates (replaces overrides for matching trade names; appends new).
router.post("/estimating/labor-rates/import", requireRole(["team", "admin", "superadmin"]), (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  let rows: Array<Record<string, string>> = [];
  if (typeof body["csv"] === "string") {
    rows = parseCsv(body["csv"] as string);
  } else if (Array.isArray(body["rates"])) {
    rows = (body["rates"] as Array<Record<string, unknown>>).map((m) => {
      const o: Record<string, string> = {};
      for (const k of Object.keys(m)) o[k.toLowerCase()] = String(m[k] ?? "");
      return o;
    });
  } else {
    res.status(400).json({ error: "invalid_payload", message: "Provide csv or rates." });
    return;
  }

  const updated: LaborRate[] = [];
  const skipped: Array<{ row: number; reason: string }> = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] as Record<string, string>;
    const trade = (r["trade"] ?? r["oficio"] ?? "").trim();
    const tradeEs = (r["trade_es"] ?? r["tradees"] ?? r["oficio_es"] ?? trade).trim();
    const unit = (r["unit"] ?? r["unidad"] ?? "hour").trim() || "hour";
    const rateRaw = (r["hourly_rate"] ?? r["hourlyrate"] ?? r["rate"] ?? r["tarifa"] ?? "").replace(/[^0-9.]/g, "");
    const hourlyRate = Number(rateRaw);
    if (!trade || !isFinite(hourlyRate) || hourlyRate <= 0) {
      skipped.push({ row: i + 2, reason: "missing trade or rate" });
      continue;
    }
    const existingIdx = LABOR_RATES.findIndex((lr) => lr.trade.toLowerCase() === trade.toLowerCase());
    const next: LaborRate = { trade, tradeEs, unit, hourlyRate, source: "import", updatedAt: new Date().toISOString() };
    if (existingIdx >= 0) LABOR_RATES[existingIdx] = next;
    else LABOR_RATES.push(next);
    updated.push(next);
  }
  persistEstimatingState();
  res.json({ imported: updated.length, skipped: skipped.length, skippedDetails: skipped, rates: LABOR_RATES });
});

// Internal helper: persist receipts (last 3 by date), recompute labor baseline,
// log activity, and return the response payload. Used by both the CSV/JSON
// endpoint and the OCR file-upload endpoint.
function applyReceipts(projectId: string, parsed: Receipt[], actor: string, source: "csv" | "ocr") {
  // Keep most recent 3 (by date string desc).
  const sorted = [...parsed].sort((a, b) => (a.date < b.date ? 1 : -1));
  const lastThree = sorted.slice(0, 3);
  PROJECT_RECEIPTS[projectId] = lastThree;

  // Update labor rates: average effective hourly rate across receipts per trade.
  const byTrade: Record<string, { totalAmount: number; totalHours: number }> = {};
  for (const r of lastThree) {
    const key = r.trade;
    if (!byTrade[key]) byTrade[key] = { totalAmount: 0, totalHours: 0 };
    (byTrade[key] as { totalAmount: number; totalHours: number }).totalAmount += r.amount;
    (byTrade[key] as { totalAmount: number; totalHours: number }).totalHours += r.hours;
  }
  const updatedTrades: string[] = [];
  for (const trade of Object.keys(byTrade)) {
    const v = byTrade[trade] as { totalAmount: number; totalHours: number };
    if (v.totalHours <= 0) continue;
    const newRate = Math.round((v.totalAmount / v.totalHours) * 100) / 100;
    const idx = LABOR_RATES.findIndex((lr) => lr.trade.toLowerCase() === trade.toLowerCase());
    const next: LaborRate = {
      trade,
      tradeEs: idx >= 0 ? (LABOR_RATES[idx] as LaborRate).tradeEs : trade,
      unit: "hour",
      hourlyRate: newRate,
      source: "receipts",
      updatedAt: new Date().toISOString(),
    };
    if (idx >= 0) LABOR_RATES[idx] = next;
    else LABOR_RATES.push(next);
    updatedTrades.push(trade);
  }

  const sourceLabel = source === "ocr" ? "via OCR upload" : "from CSV import";
  const sourceLabelEs = source === "ocr" ? "vía subida con OCR" : "desde importación CSV";
  appendActivity(projectId, {
    type: "receipts_upload",
    actor,
    description: `Last ${lastThree.length} receipts uploaded ${sourceLabel}; labor baseline refreshed for ${updatedTrades.length} trade(s).`,
    descriptionEs: `Se subieron los últimos ${lastThree.length} recibos ${sourceLabelEs}; tarifas de mano de obra actualizadas para ${updatedTrades.length} oficio(s).`,
  });

  persistEstimatingState();

  return { projectId, receipts: lastThree, updatedTrades, rates: LABOR_RATES };
}

// POST receipts for a project — recomputes labor baseline from last 3 receipts.
router.post("/projects/:id/receipts", requireRole(["team", "admin", "superadmin"]), (req, res) => {
  const project = PROJECTS.find((p) => p.id === req.params["id"]);
  if (!project) { res.status(404).json({ error: "not_found" }); return; }

  const body = (req.body ?? {}) as Record<string, unknown>;
  let rows: Array<Record<string, string>> = [];
  if (typeof body["csv"] === "string") {
    rows = parseCsv(body["csv"] as string);
  } else if (Array.isArray(body["receipts"])) {
    rows = (body["receipts"] as Array<Record<string, unknown>>).map((m) => {
      const o: Record<string, string> = {};
      for (const k of Object.keys(m)) o[k.toLowerCase()] = String(m[k] ?? "");
      return o;
    });
  } else {
    res.status(400).json({ error: "invalid_payload", message: "Provide csv or receipts." });
    return;
  }

  const parsed: Receipt[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] as Record<string, string>;
    const vendor = (r["vendor"] ?? r["proveedor"] ?? "").trim();
    const date = (r["date"] ?? r["fecha"] ?? "").trim();
    const trade = (r["trade"] ?? r["oficio"] ?? "").trim();
    const amount = Number((r["amount"] ?? r["monto"] ?? "").replace(/[^0-9.]/g, ""));
    const hours = Number((r["hours"] ?? r["horas"] ?? "0").replace(/[^0-9.]/g, ""));
    if (!vendor || !trade || !isFinite(amount) || amount <= 0 || !isFinite(hours) || hours <= 0) continue;
    parsed.push({ id: `rec-${Date.now()}-${i}`, vendor, date: date || new Date().toISOString().slice(0, 10), trade, amount, hours });
  }
  if (parsed.length === 0) {
    res.status(400).json({ error: "no_valid_receipts", message: "No valid receipts parsed (need vendor, trade, amount > 0, hours > 0).", messageEs: "No se procesaron recibos válidos." });
    return;
  }

  const actor = (req as { user?: { name?: string } }).user?.name ?? "Team";
  res.json(applyReceipts(project.id, parsed, actor, "csv"));
});

// POST a single receipt PDF or image to OCR. Extracts vendor/date/amount/hours
// via PDF.co, merges with any user-supplied overrides, then persists the same
// way the CSV path does.
router.post(
  "/projects/:id/receipts/upload-file",
  requireRole(["team", "admin", "superadmin"]),
  async (req, res) => {
    const project = PROJECTS.find((p) => p.id === req.params["id"]);
    if (!project) { res.status(404).json({ error: "not_found" }); return; }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const fileBase64Raw = typeof body["fileBase64"] === "string" ? (body["fileBase64"] as string) : "";
    const filename = typeof body["filename"] === "string" && body["filename"]
      ? (body["filename"] as string)
      : "receipt.pdf";
    // Strip any data: URL prefix the client may have included.
    const fileBase64 = fileBase64Raw.replace(/^data:[^;]+;base64,/, "");
    if (!fileBase64) {
      res.status(400).json({ error: "missing_file", message: "Provide fileBase64 (base64 of a PDF or image)." });
      return;
    }
    const tradeOverride = typeof body["trade"] === "string" ? (body["trade"] as string).trim() : "";
    if (!tradeOverride) {
      res.status(400).json({ error: "missing_trade", message: "Pick the trade this receipt belongs to.", messageEs: "Selecciona el oficio al que corresponde el recibo." });
      return;
    }
    const vendorOverride = typeof body["vendor"] === "string" ? (body["vendor"] as string).trim() : "";
    const dateOverride = typeof body["date"] === "string" ? (body["date"] as string).trim() : "";
    const amountOverride = body["amount"] !== undefined && body["amount"] !== null && body["amount"] !== ""
      ? Number(body["amount"])
      : undefined;
    const hoursOverride = body["hours"] !== undefined && body["hours"] !== null && body["hours"] !== ""
      ? Number(body["hours"])
      : undefined;

    const apiKey = process.env["PDF_CO_API_KEY"];
    if (!apiKey) {
      res.status(500).json({
        error: "ocr_not_configured",
        message: "PDF_CO_API_KEY is not set on the server. Ask an admin to configure it before uploading receipt images.",
        messageEs: "PDF_CO_API_KEY no está configurado. Pide al administrador configurarlo antes de subir recibos.",
      });
      return;
    }

    let extracted;
    try {
      extracted = await extractAndParseReceipt({ fileBase64, filename }, apiKey);
    } catch (err) {
      const message = err instanceof Error ? err.message : "OCR extraction failed.";
      res.status(502).json({ error: "ocr_failed", message, messageEs: "Falló la extracción con OCR." });
      return;
    }

    const vendor = vendorOverride || extracted.vendor || "";
    const date = (dateOverride || extracted.date || new Date().toISOString().slice(0, 10)).trim();
    const amount = amountOverride !== undefined && isFinite(amountOverride) && amountOverride > 0
      ? amountOverride
      : (extracted.amount ?? NaN);
    const hours = hoursOverride !== undefined && isFinite(hoursOverride) && hoursOverride > 0
      ? hoursOverride
      : (extracted.hours ?? NaN);

    const missing: string[] = [];
    if (!vendor) missing.push("vendor");
    if (!isFinite(amount) || amount <= 0) missing.push("amount");
    if (!isFinite(hours) || hours <= 0) missing.push("hours");
    if (missing.length > 0) {
      res.status(422).json({
        error: "incomplete_extraction",
        message: `Could not extract ${missing.join(", ")} from the receipt. Re-upload a clearer image or fill the field manually.`,
        messageEs: `No se pudo extraer ${missing.join(", ")} del recibo. Sube una imagen más nítida o ingresa el campo manualmente.`,
        extracted: {
          vendor: extracted.vendor,
          date: extracted.date,
          amount: extracted.amount,
          hours: extracted.hours,
        },
      });
      return;
    }

    // Append to the existing receipts list (keep up to 3 most recent overall),
    // matching the CSV path behavior so a single OCR upload doesn't wipe out
    // previously entered receipts.
    const previous = PROJECT_RECEIPTS[project.id] ?? [];
    const newReceipt: Receipt = {
      id: `rec-${Date.now()}-ocr`,
      vendor,
      date,
      trade: tradeOverride,
      amount: Math.round(amount * 100) / 100,
      hours: Math.round(hours * 100) / 100,
    };
    const combined = [...previous, newReceipt];

    const actor = (req as { user?: { name?: string } }).user?.name ?? "Team";
    const result = applyReceipts(project.id, combined, actor, "ocr");
    res.json({
      ...result,
      ocrExtracted: {
        vendor: extracted.vendor,
        date: extracted.date,
        amount: extracted.amount,
        hours: extracted.hours,
      },
      newReceipt,
    });
  },
);

// GET receipts
router.get("/projects/:id/receipts", requireRole(["team","admin","superadmin","architect","client"]), (req, res) => {
  const id = req.params["id"] as string;
  if (!enforceClientOwnership(req, res, id)) return;
  res.json({ projectId: id, receipts: PROJECT_RECEIPTS[id] ?? [] });
});

// POST report template
router.post("/projects/:id/report-template", requireRole(["team", "admin", "superadmin"]), (req, res) => {
  const project = PROJECTS.find((p) => p.id === req.params["id"]);
  if (!project) { res.status(404).json({ error: "not_found" }); return; }
  const body = (req.body ?? {}) as Record<string, unknown>;
  const name = typeof body["name"] === "string" && body["name"] ? body["name"] : "Custom Template";
  const columns = Array.isArray(body["columns"]) ? (body["columns"] as unknown[]).map(String) : ["Category", "Item", "Qty", "Unit", "Unit Price", "Total"];
  const headerLines = Array.isArray(body["headerLines"]) ? (body["headerLines"] as unknown[]).map(String) : [`KONTi Design | Build Studio`, project.name, project.location];
  const footer = typeof body["footer"] === "string" ? body["footer"] : "Generated by KONTi Dashboard";
  const tpl: ReportTemplate = {
    name,
    columns,
    headerLines,
    footer,
    uploadedAt: new Date().toISOString(),
    uploadedBy: (req as { user?: { name?: string } }).user?.name ?? "Team",
  };
  PROJECT_REPORT_TEMPLATE[project.id] = tpl;
  appendActivity(project.id, {
    type: "report_template_upload",
    actor: tpl.uploadedBy,
    description: `Report template "${name}" uploaded for export reuse.`,
    descriptionEs: `Plantilla de reporte "${name}" subida para reutilización en exportaciones.`,
  });
  persistEstimatingState();
  res.json({ projectId: project.id, template: tpl });
});

router.get("/projects/:id/report-template", requireRole(["team","admin","superadmin","architect","client"]), (req, res) => {
  const id = req.params["id"] as string;
  if (!enforceClientOwnership(req, res, id)) return;
  const tpl = PROJECT_REPORT_TEMPLATE[id];
  if (!tpl) { res.status(404).json({ error: "not_found", message: "No template saved" }); return; }
  res.json(tpl);
});

// POST contractor estimate (from preliminary doc).
router.post("/projects/:id/contractor-estimate", requireRole(["team", "admin", "superadmin"]), (req, res) => {
  const project = PROJECTS.find((p) => p.id === req.params["id"]);
  if (!project) { res.status(404).json({ error: "not_found" }); return; }
  const body = (req.body ?? {}) as Record<string, unknown>;
  const squareMeters = Number(body["squareMeters"] ?? 0);
  const projectType = typeof body["projectType"] === "string" ? body["projectType"] : "residencial";
  const scope = Array.isArray(body["scope"]) ? (body["scope"] as unknown[]).map(String) : [];
  const source = typeof body["source"] === "string" ? body["source"] : "Preliminary project doc (manual entry)";
  const contingencyPercent = Number(body["contingencyPercent"] ?? 8);
  const bathrooms = Math.max(0, Math.floor(Number(body["bathrooms"] ?? 0)) || 0);
  const kitchens = Math.max(0, Math.floor(Number(body["kitchens"] ?? 0)) || 0);
  const marginPercent = Math.max(0, Number(body["marginPercent"] ?? 0) || 0);
  const managementFeePercent = Math.max(0, Number(body["managementFeePercent"] ?? 0) || 0);

  if (!isFinite(squareMeters) || squareMeters <= 0) {
    res.status(400).json({ error: "invalid_square_meters", message: "squareMeters must be > 0" });
    return;
  }

  const allMaterials = [...MATERIALS, ...EXTRA_MATERIALS];
  const lines: ContractorEstimateLine[] = [];

  // Heuristic line item synthesis driven by scope keywords + sq meters.
  function pickByCategory(cat: string): { id: string; item: string; itemEs?: string; unit: string; basePrice: number } | undefined {
    return allMaterials.find((m) => m.category === cat);
  }

  const concrete = pickByCategory("foundation");
  if (concrete) {
    const qty = Math.max(1, Math.ceil(squareMeters * 0.12));
    lines.push({
      id: `est-line-${lines.length + 1}`,
      category: "foundation",
      description: concrete.item,
      descriptionEs: ("itemEs" in concrete ? (concrete as { itemEs?: string }).itemEs : undefined) ?? concrete.item,
      quantity: qty, unit: concrete.unit, unitPrice: concrete.basePrice,
      lineTotal: qty * concrete.basePrice,
    });
  }
  const steel = pickByCategory("steel");
  if (steel) {
    const qty = Math.max(1, Math.ceil(squareMeters / 60));
    lines.push({
      id: `est-line-${lines.length + 1}`, category: "steel", description: steel.item, descriptionEs: ("itemEs" in steel ? (steel as { itemEs?: string }).itemEs : undefined) ?? steel.item,
      quantity: qty, unit: steel.unit, unitPrice: steel.basePrice, lineTotal: qty * steel.basePrice,
    });
  }
  const elec = pickByCategory("electrical");
  if (elec) {
    const qty = Math.max(2, Math.ceil(squareMeters / 25));
    lines.push({
      id: `est-line-${lines.length + 1}`, category: "electrical", description: elec.item, descriptionEs: ("itemEs" in elec ? (elec as { itemEs?: string }).itemEs : undefined) ?? elec.item,
      quantity: qty, unit: elec.unit, unitPrice: elec.basePrice, lineTotal: qty * elec.basePrice,
    });
  }
  const plumb = pickByCategory("plumbing");
  if (plumb) {
    const qty = Math.max(1, Math.ceil(squareMeters / 40));
    lines.push({
      id: `est-line-${lines.length + 1}`, category: "plumbing", description: plumb.item, descriptionEs: ("itemEs" in plumb ? (plumb as { itemEs?: string }).itemEs : undefined) ?? plumb.item,
      quantity: qty, unit: plumb.unit, unitPrice: plumb.basePrice, lineTotal: qty * plumb.basePrice,
    });
  }
  const finish = pickByCategory("finishes");
  if (finish) {
    const qty = Math.max(2, Math.ceil(squareMeters / 18));
    lines.push({
      id: `est-line-${lines.length + 1}`, category: "finishes", description: finish.item, descriptionEs: ("itemEs" in finish ? (finish as { itemEs?: string }).itemEs : undefined) ?? finish.item,
      quantity: qty, unit: finish.unit, unitPrice: finish.basePrice, lineTotal: qty * finish.basePrice,
    });
  }

  // Scope-driven extras
  for (const s of scope) {
    const lower = s.toLowerCase();
    if (/(pool|piscina)/.test(lower)) {
      lines.push({
        id: `est-line-${lines.length + 1}`, category: "subcontractor",
        description: "Subcontractor — Pool excavation & shell",
        descriptionEs: "Subcontratista — Excavación y carcasa de piscina",
        quantity: 1, unit: "lump", unitPrice: 28000, lineTotal: 28000,
      });
    }
    if (/(solar|photovoltaic|fotovolt)/.test(lower)) {
      lines.push({
        id: `est-line-${lines.length + 1}`, category: "subcontractor",
        description: "Subcontractor — Solar PV system (8 kW)",
        descriptionEs: "Subcontratista — Sistema solar fotovoltaico (8 kW)",
        quantity: 1, unit: "lump", unitPrice: 22000, lineTotal: 22000,
      });
    }
    if (/(roof|techo)/.test(lower)) {
      lines.push({
        id: `est-line-${lines.length + 1}`, category: "subcontractor",
        description: "Subcontractor — Roof membrane & flashing",
        descriptionEs: "Subcontratista — Membrana de techo e impermeabilización",
        quantity: Math.max(1, Math.ceil(squareMeters / 100)), unit: "lot", unitPrice: 4500,
        lineTotal: Math.max(1, Math.ceil(squareMeters / 100)) * 4500,
      });
    }
  }

  // Bathroom + kitchen rough-in extras (subcontractor allowances).
  if (bathrooms > 0) {
    lines.push({
      id: `est-line-${lines.length + 1}`, category: "subcontractor",
      description: `Bathroom rough-in & fixtures (${bathrooms})`,
      descriptionEs: `Baños — instalación y accesorios (${bathrooms})`,
      quantity: bathrooms, unit: "each", unitPrice: 4200, lineTotal: bathrooms * 4200,
    });
  }
  if (kitchens > 0) {
    lines.push({
      id: `est-line-${lines.length + 1}`, category: "subcontractor",
      description: `Kitchen rough-in & cabinetry (${kitchens})`,
      descriptionEs: `Cocinas — instalación y gabinetes (${kitchens})`,
      quantity: kitchens, unit: "each", unitPrice: 9800, lineTotal: kitchens * 9800,
    });
  }

  // Labor lines — drive from current LABOR_RATES.
  const laborHoursBase = squareMeters * (projectType === "comercial" ? 6 : 4.5);
  const splits: Record<string, number> = { "General Labor": 0.45, "Carpenter": 0.20, "Electrician": 0.12, "Plumber": 0.10, "Mason": 0.13 };
  for (const [trade, share] of Object.entries(splits)) {
    const rate = LABOR_RATES.find((r) => r.trade === trade);
    if (!rate) continue;
    const hours = Math.round(laborHoursBase * share);
    lines.push({
      id: `est-line-${lines.length + 1}`,
      category: "labor",
      description: `Labor — ${rate.trade}`,
      descriptionEs: `Mano de obra — ${rate.tradeEs}`,
      quantity: hours, unit: rate.unit, unitPrice: rate.hourlyRate, lineTotal: hours * rate.hourlyRate,
    });
  }

  let subtotalMaterials = 0;
  let subtotalLabor = 0;
  let subtotalSubcontractor = 0;
  for (const l of lines) {
    if (l.category === "labor") subtotalLabor += l.lineTotal;
    else if (l.category === "subcontractor") subtotalSubcontractor += l.lineTotal;
    else subtotalMaterials += l.lineTotal;
  }
  const subtotal = subtotalMaterials + subtotalLabor + subtotalSubcontractor;
  const contingency = Math.round(subtotal * (contingencyPercent / 100));
  const marginAmount = Math.round((subtotal + contingency) * (marginPercent / 100));
  const managementFeeAmount = Math.round((subtotal + contingency + marginAmount) * (managementFeePercent / 100));
  const grandTotal = subtotal + contingency + marginAmount + managementFeeAmount;

  const estimate: ContractorEstimate = {
    projectId: project.id,
    source,
    squareMeters,
    projectType,
    scope,
    bathrooms,
    kitchens,
    lines,
    subtotalMaterials,
    subtotalLabor,
    subtotalSubcontractor,
    contingencyPercent,
    contingency,
    marginPercent,
    marginAmount,
    managementFeePercent,
    managementFeeAmount,
    grandTotal,
    generatedAt: new Date().toISOString(),
    generatedBy: (req as { user?: { name?: string } }).user?.name ?? "Team",
  };
  PROJECT_CONTRACTOR_ESTIMATE[project.id] = estimate;

  appendActivity(project.id, {
    type: "contractor_estimate",
    actor: estimate.generatedBy,
    description: `Contractor estimate generated: $${grandTotal.toLocaleString()} (${lines.length} line items).`,
    descriptionEs: `Estimado de contratista generado: $${grandTotal.toLocaleString()} (${lines.length} líneas).`,
  });

  persistEstimatingState();

  res.json(estimate);
});

router.get("/projects/:id/contractor-estimate", requireRole(["team","admin","superadmin","architect","client"]), (req, res) => {
  const id = req.params["id"] as string;
  if (!enforceClientOwnership(req, res, id)) return;
  const est = PROJECT_CONTRACTOR_ESTIMATE[id];
  if (!est) { res.status(404).json({ error: "no_estimate", message: "No contractor estimate yet." }); return; }
  res.json(est);
});

// PUT — update editable contractor estimate lines (description, quantity, unit, unitPrice).
router.put("/projects/:id/contractor-estimate/lines", requireRole(["team", "admin", "superadmin"]), (req, res) => {
  const id = req.params["id"] as string;
  const project = PROJECTS.find((p) => p.id === id);
  if (!project) { res.status(404).json({ error: "not_found" }); return; }
  const est = PROJECT_CONTRACTOR_ESTIMATE[id];
  if (!est) { res.status(404).json({ error: "no_estimate", message: "Generate an estimate first." }); return; }
  const body = (req.body ?? {}) as {
    lines?: Array<Record<string, unknown>>;
    contingencyPercent?: number;
    marginPercent?: number;
    managementFeePercent?: number;
    bathrooms?: number;
    kitchens?: number;
  };
  if (!Array.isArray(body.lines) || body.lines.length === 0) {
    res.status(400).json({ error: "invalid_lines" }); return;
  }
  const updatedLines = body.lines.map((raw, i) => {
    const existing = est.lines[i];
    const id = typeof raw["id"] === "string" ? (raw["id"] as string) : existing?.id ?? `line-${i + 1}`;
    const category = typeof raw["category"] === "string" ? (raw["category"] as string) : existing?.category ?? "materials";
    const description = typeof raw["description"] === "string" ? (raw["description"] as string) : existing?.description ?? "Line";
    const descriptionEs = typeof raw["descriptionEs"] === "string" ? (raw["descriptionEs"] as string) : existing?.descriptionEs ?? description;
    const quantity = Number(raw["quantity"] ?? existing?.quantity ?? 0);
    const unit = typeof raw["unit"] === "string" ? (raw["unit"] as string) : existing?.unit ?? "unit";
    const unitPrice = Number(raw["unitPrice"] ?? existing?.unitPrice ?? 0);
    const lineTotal = Math.round(quantity * unitPrice * 100) / 100;
    return { id, category, description, descriptionEs, quantity, unit, unitPrice, lineTotal };
  });
  const subtotalLabor = updatedLines.filter((l) => l.category === "labor").reduce((a, b) => a + b.lineTotal, 0);
  const subtotalSubcontractor = updatedLines.filter((l) => l.category === "subcontractor").reduce((a, b) => a + b.lineTotal, 0);
  const subtotalMaterials = updatedLines.filter((l) => l.category !== "labor" && l.category !== "subcontractor").reduce((a, b) => a + b.lineTotal, 0);
  const baseSubtotal = subtotalMaterials + subtotalLabor + subtotalSubcontractor;
  const contingencyPercent = body.contingencyPercent !== undefined ? Math.max(0, Number(body.contingencyPercent) || 0) : est.contingencyPercent;
  const marginPercent = body.marginPercent !== undefined ? Math.max(0, Number(body.marginPercent) || 0) : (est.marginPercent ?? 0);
  const managementFeePercent = body.managementFeePercent !== undefined ? Math.max(0, Number(body.managementFeePercent) || 0) : (est.managementFeePercent ?? 0);
  const bathrooms = body.bathrooms !== undefined ? Math.max(0, Math.floor(Number(body.bathrooms) || 0)) : (est.bathrooms ?? 0);
  const kitchens = body.kitchens !== undefined ? Math.max(0, Math.floor(Number(body.kitchens) || 0)) : (est.kitchens ?? 0);
  const contingency = Math.round(baseSubtotal * (contingencyPercent / 100) * 100) / 100;
  const marginAmount = Math.round((baseSubtotal + contingency) * (marginPercent / 100) * 100) / 100;
  const managementFeeAmount = Math.round((baseSubtotal + contingency + marginAmount) * (managementFeePercent / 100) * 100) / 100;
  const grandTotal = Math.round((baseSubtotal + contingency + marginAmount + managementFeeAmount) * 100) / 100;
  const updated: ContractorEstimate = {
    ...est,
    lines: updatedLines,
    subtotalMaterials, subtotalLabor, subtotalSubcontractor,
    contingencyPercent, contingency,
    marginPercent, marginAmount,
    managementFeePercent, managementFeeAmount,
    bathrooms, kitchens,
    grandTotal,
    generatedAt: new Date().toISOString(),
  };
  PROJECT_CONTRACTOR_ESTIMATE[id] = updated;
  appendActivity(id, {
    type: "contractor_estimate",
    actor: (req as { user?: { name?: string } }).user?.name ?? "Team",
    description: `Contractor estimate edited: ${updatedLines.length} lines · $${grandTotal.toLocaleString()}`,
    descriptionEs: `Estimado de contratista editado: ${updatedLines.length} líneas · $${grandTotal.toLocaleString()}`,
  });
  persistEstimatingState();
  res.json(updated);
});

// GET variance report — estimated vs actual for a project.
router.get("/projects/:id/variance-report", requireRole(["team","admin","superadmin","architect","client"]), (req, res) => {
  const id = req.params["id"] as string;
  if (!enforceClientOwnership(req, res, id)) return;
  const project = PROJECTS.find((p) => p.id === id);
  if (!project) { res.status(404).json({ error: "not_found" }); return; }

  const calcEntries = (CALCULATOR_ENTRIES as Record<string, Array<{ category: string; lineTotal: number }>>)[project.id] ?? [];
  const contractorEst = PROJECT_CONTRACTOR_ESTIMATE[project.id];
  const cp = (PROJECT_COST_PLUS as Record<string, { materialsCost: number; laborCost: number; subcontractorCost: number }>)[project.id];

  const estByCategory: Record<string, number> = {};
  let estimatedMaterials = 0;
  let estimatedLabor = 0;
  let estimatedSubcontractor = 0;

  if (contractorEst) {
    for (const l of contractorEst.lines) {
      estByCategory[l.category] = (estByCategory[l.category] ?? 0) + l.lineTotal;
      if (l.category === "labor") estimatedLabor += l.lineTotal;
      else if (l.category === "subcontractor") estimatedSubcontractor += l.lineTotal;
      else estimatedMaterials += l.lineTotal;
    }
  } else {
    for (const e of calcEntries) {
      estByCategory[e.category] = (estByCategory[e.category] ?? 0) + e.lineTotal;
      estimatedMaterials += e.lineTotal;
    }
    // Default labor / subcontractor estimates: 92% of cost-plus actuals (mock baseline).
    if (cp) {
      estimatedLabor = Math.round(cp.laborCost * 0.92);
      estimatedSubcontractor = Math.round(cp.subcontractorCost * 0.92);
    }
  }

  const actualMaterials = cp?.materialsCost ?? 0;
  const actualLabor = cp?.laborCost ?? 0;
  const actualSubcontractor = cp?.subcontractorCost ?? 0;

  function pct(estimated: number, actual: number): number {
    if (estimated === 0) return 0;
    return Math.round(((actual - estimated) / estimated) * 1000) / 10;
  }

  const buckets = [
    { key: "materials", labelEn: "Materials", labelEs: "Materiales", estimated: estimatedMaterials, actual: actualMaterials },
    { key: "labor", labelEn: "Labor", labelEs: "Mano de Obra", estimated: estimatedLabor, actual: actualLabor },
    { key: "subcontractor", labelEn: "Subcontractor", labelEs: "Subcontratistas", estimated: estimatedSubcontractor, actual: actualSubcontractor },
  ].map((b) => ({
    ...b,
    variance: b.actual - b.estimated,
    variancePercent: pct(b.estimated, b.actual),
    status: (b.actual <= b.estimated * 1.05 ? "on_track" : b.actual <= b.estimated * 1.15 ? "warning" : "over") as "on_track" | "warning" | "over",
  }));

  // Material category breakdown (only when estimate by category exists).
  const materialCategories = Object.entries(estByCategory)
    .filter(([cat]) => cat !== "labor" && cat !== "subcontractor")
    .map(([category, estimated]) => {
      const actualShare = actualMaterials === 0 || estimatedMaterials === 0 ? 0 : Math.round((estimated / estimatedMaterials) * actualMaterials);
      return {
        category,
        estimated,
        actual: actualShare,
        variance: actualShare - estimated,
        variancePercent: pct(estimated, actualShare),
      };
    })
    .sort((a, b) => b.estimated - a.estimated);

  const totalEstimated = estimatedMaterials + estimatedLabor + estimatedSubcontractor;
  const totalActual = actualMaterials + actualLabor + actualSubcontractor;

  res.json({
    projectId: project.id,
    projectName: project.name,
    estimateSource: contractorEst ? "contractor_estimate" : "calculator_entries",
    generatedAt: new Date().toISOString(),
    buckets,
    materialCategories,
    totals: {
      estimated: totalEstimated,
      actual: totalActual,
      variance: totalActual - totalEstimated,
      variancePercent: pct(totalEstimated, totalActual),
    },
  });
});

export default router;
