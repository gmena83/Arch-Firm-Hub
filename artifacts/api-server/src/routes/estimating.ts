import { Router, type IRouter } from "express";
import {
  PROJECTS,
  MATERIALS,
  CALCULATOR_ENTRIES,
  PROJECT_COST_PLUS,
  appendActivity,
} from "../data/seed";
import { requireRole } from "../middlewares/require-role";

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
  lines: ContractorEstimateLine[];
  subtotalMaterials: number;
  subtotalLabor: number;
  subtotalSubcontractor: number;
  contingencyPercent: number;
  contingency: number;
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

export const LABOR_RATES: LaborRate[] = [...DEFAULT_LABOR_RATES];

export const PROJECT_RECEIPTS: Record<string, Receipt[]> = {};
export const PROJECT_REPORT_TEMPLATE: Record<string, ReportTemplate> = {};
export const PROJECT_CONTRACTOR_ESTIMATE: Record<string, ContractorEstimate> = {};

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

  const accepted: ImportedMaterial[] = [];
  const skipped: Array<{ row: number; reason: string }> = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] as Record<string, string>;
    const item = (r["item"] ?? r["material"] ?? r["name"] ?? "").trim();
    const itemEs = (r["item_es"] ?? r["itemes"] ?? r["nombre"] ?? item).trim();
    const category = (r["category"] ?? r["categoria"] ?? "").trim().toLowerCase();
    const unit = (r["unit"] ?? r["unidad"] ?? "").trim();
    const priceRaw = (r["base_price"] ?? r["baseprice"] ?? r["price"] ?? r["precio"] ?? "").replace(/[^0-9.]/g, "");
    const basePrice = Number(priceRaw);
    if (!item || !category || !unit || !isFinite(basePrice) || basePrice <= 0) {
      skipped.push({ row: i + 2, reason: "missing item/category/unit/price" });
      continue;
    }
    const id = `mat-imp-${Date.now()}-${EXTRA_MATERIALS.length + accepted.length + 1}`;
    accepted.push({ id, item, itemEs, category, unit, basePrice });
  }
  EXTRA_MATERIALS.push(...accepted);
  res.json({
    imported: accepted.length,
    skipped: skipped.length,
    skippedDetails: skipped,
    materials: accepted,
    totalCatalogSize: MATERIALS.length + EXTRA_MATERIALS.length,
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
  res.json({ imported: updated.length, skipped: skipped.length, skippedDetails: skipped, rates: LABOR_RATES });
});

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

  // Keep most recent 3 (by date string desc).
  const sorted = [...parsed].sort((a, b) => (a.date < b.date ? 1 : -1));
  const lastThree = sorted.slice(0, 3);
  PROJECT_RECEIPTS[project.id] = lastThree;

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

  appendActivity(project.id, {
    type: "receipts_upload",
    actor: (req as { user?: { name?: string } }).user?.name ?? "Team",
    description: `Last ${lastThree.length} receipts uploaded; labor baseline refreshed for ${updatedTrades.length} trade(s).`,
    descriptionEs: `Se subieron los últimos ${lastThree.length} recibos; tarifas de mano de obra actualizadas para ${updatedTrades.length} oficio(s).`,
  });

  res.json({ projectId: project.id, receipts: lastThree, updatedTrades, rates: LABOR_RATES });
});

// GET receipts
router.get("/projects/:id/receipts", requireRole(["team","admin","superadmin","architect","client"]), (req, res) => {
  res.json({ projectId: req.params["id"], receipts: PROJECT_RECEIPTS[req.params["id"] as string] ?? [] });
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
  res.json({ projectId: project.id, template: tpl });
});

router.get("/projects/:id/report-template", requireRole(["team","admin","superadmin","architect","client"]), (req, res) => {
  const tpl = PROJECT_REPORT_TEMPLATE[req.params["id"] as string];
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
  const grandTotal = subtotal + contingency;

  const estimate: ContractorEstimate = {
    projectId: project.id,
    source,
    squareMeters,
    projectType,
    scope,
    lines,
    subtotalMaterials,
    subtotalLabor,
    subtotalSubcontractor,
    contingencyPercent,
    contingency,
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

  res.json(estimate);
});

router.get("/projects/:id/contractor-estimate", requireRole(["team","admin","superadmin","architect","client"]), (req, res) => {
  const id = req.params["id"] as string;
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
  const body = (req.body ?? {}) as { lines?: Array<Record<string, unknown>> };
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
  const subtotalMaterials = updatedLines.filter((l) => l.category === "materials").reduce((a, b) => a + b.lineTotal, 0);
  const subtotalLabor = updatedLines.filter((l) => l.category === "labor").reduce((a, b) => a + b.lineTotal, 0);
  const subtotalSubcontractor = updatedLines.filter((l) => l.category === "subcontractor").reduce((a, b) => a + b.lineTotal, 0);
  const baseSubtotal = subtotalMaterials + subtotalLabor + subtotalSubcontractor;
  const contingency = Math.round(baseSubtotal * (est.contingencyPercent / 100) * 100) / 100;
  const grandTotal = Math.round((baseSubtotal + contingency) * 100) / 100;
  const updated = {
    ...est,
    lines: updatedLines,
    subtotalMaterials, subtotalLabor, subtotalSubcontractor,
    contingency, grandTotal,
    generatedAt: new Date().toISOString(),
  };
  PROJECT_CONTRACTOR_ESTIMATE[id] = updated;
  appendActivity(id, {
    type: "contractor_estimate",
    actor: (req as { user?: { name?: string } }).user?.name ?? "Team",
    description: `Contractor estimate edited: ${updatedLines.length} lines · $${grandTotal.toLocaleString()}`,
    descriptionEs: `Estimado de contratista editado: ${updatedLines.length} líneas · $${grandTotal.toLocaleString()}`,
  });
  res.json(updated);
});

// GET variance report — estimated vs actual for a project.
router.get("/projects/:id/variance-report", requireRole(["team","admin","superadmin","architect","client"]), (req, res) => {
  const project = PROJECTS.find((p) => p.id === req.params["id"]);
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
