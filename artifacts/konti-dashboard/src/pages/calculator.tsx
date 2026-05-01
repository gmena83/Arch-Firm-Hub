import { useEffect, useState } from "react";
import {
  useListProjects,
  useGetProjectCalculations,
  useListMaterials,
  getGetProjectCalculationsQueryKey,
  useUpdateProjectCalculationLine,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useSearch } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { RequireAuth } from "@/hooks/auth-provider";
import { useLang } from "@/hooks/use-lang";
import { Calculator, Plus, X, FileText, HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ContractorCalculator } from "@/components/estimating/contractor-calculator";
import { ImportsPanel } from "@/components/estimating/imports-panel";
import { VarianceReportPanel } from "@/components/estimating/variance-report";

const CAT_COLORS: Record<string, string> = {
  steel: "bg-slate-100 text-slate-700",
  foundation: "bg-stone-100 text-stone-700",
  lumber: "bg-amber-100 text-amber-700",
  electrical: "bg-yellow-100 text-yellow-700",
  plumbing: "bg-sky-100 text-sky-700",
  finishes: "bg-pink-100 text-pink-700",
  insulation: "bg-purple-100 text-purple-700",
};

function AddMaterialModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (entry: { item: string; category: string; unit: string; basePrice: number; quantity: number }) => void;
}) {
  const { t } = useLang();
  const { data: materials = [] } = useListMaterials();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<(typeof materials)[0] | null>(null);
  const [qty, setQty] = useState(1);

  const filtered = materials.filter((m) =>
    !search || m.item.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" data-testid="add-material-modal">
      <div className="bg-card rounded-xl border border-card-border shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">{t("Add Material", "Agregar Material")}</h2>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("Search materials...", "Buscar materiales...")}
            className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />

          <div className="max-h-52 overflow-y-auto border border-border rounded-md divide-y divide-border">
            {filtered.slice(0, 15).map((mat) => (
              <button
                key={mat.id}
                onClick={() => setSelected(mat)}
                className={`w-full flex items-center justify-between px-3 py-2.5 text-sm text-left hover:bg-muted/40 transition-colors ${selected?.id === mat.id ? "bg-konti-olive/10 border-l-2 border-konti-olive" : ""}`}
              >
                <div>
                  <p className="font-medium text-foreground">{mat.item}</p>
                  <p className="text-xs text-muted-foreground">{mat.category} · {mat.unit}</p>
                </div>
                <span className="font-semibold text-foreground">${mat.basePrice.toLocaleString()}</span>
              </button>
            ))}
          </div>

          {selected && (
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-md">
              <div className="flex-1">
                <p className="text-sm font-medium">{selected.item}</p>
                <p className="text-xs text-muted-foreground">${selected.basePrice}/{selected.unit}</p>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium">{t("Qty", "Cant.")}</label>
                <input
                  type="number"
                  min={1}
                  value={qty}
                  onChange={(e) => setQty(Number(e.target.value))}
                  className="w-16 px-2 py-1.5 rounded border border-input text-sm text-right"
                />
              </div>
            </div>
          )}

          <button
            onClick={() => {
              if (!selected) return;
              onAdd({ item: selected.item, category: selected.category, unit: selected.unit, basePrice: selected.basePrice, quantity: qty });
              onClose();
            }}
            disabled={!selected}
            className="w-full py-2.5 bg-konti-olive hover:bg-konti-olive/90 text-white text-sm font-semibold rounded-md transition-colors disabled:opacity-40"
          >
            {t("Add to Calculator", "Agregar a la Calculadora")}
          </button>
        </div>
      </div>
    </div>
  );
}

interface LocalEntry {
  id: string;
  materialName: string;
  category: string;
  unit: string;
  quantity: number;
  basePrice: number;
  manualPriceOverride: number | null;
  effectivePrice: number;
  lineTotal: number;
}

interface ReportTemplate {
  name: string;
  columns: string[];
  headerLines: string[];
  footer: string;
}

const DEFAULT_TEMPLATE_COLUMNS = ["Category", "Item", "Qty", "Unit", "Unit Price", "Total"];

function templateCellForColumn(col: string, entry: LocalEntry): string {
  const c = col.trim().toLowerCase();
  if (c === "category" || c === "categoría" || c === "categoria") return entry.category;
  if (c === "item" || c === "material" || c === "description" || c === "descripción" || c === "descripcion") return entry.materialName;
  if (c === "qty" || c === "quantity" || c === "cant." || c === "cantidad") return String(entry.quantity);
  if (c === "unit" || c === "unidad") return entry.unit;
  if (c === "unit price" || c === "precio unit." || c === "precio unitario" || c === "base price" || c === "precio base") return `$${entry.effectivePrice.toLocaleString()}`;
  if (c === "total") return `$${entry.lineTotal.toLocaleString()}`;
  return "";
}

function TemplatePreviewPanel({ projectId, entries, grandTotal }: { projectId: string; entries: LocalEntry[]; grandTotal: number }) {
  const { t } = useLang();
  const [template, setTemplate] = useState<ReportTemplate | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!projectId) { setTemplate(null); setLoaded(true); return; }
    let cancel = false;
    setLoaded(false);
    const raw = typeof window !== "undefined" ? window.localStorage.getItem("konti_auth") : null;
    let token: string | undefined;
    try { token = raw ? (JSON.parse(raw).token as string) : undefined; } catch { /* ignore */ }
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
    const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
    fetch(`${base}/api/projects/${projectId}/report-template`, { headers })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancel) { setTemplate(d as ReportTemplate | null); setLoaded(true); } })
      .catch(() => { if (!cancel) { setTemplate(null); setLoaded(true); } });
    return () => { cancel = true; };
  }, [projectId]);

  if (!loaded) return null;
  if (!template) {
    return (
      <div data-testid="template-preview-empty" className="bg-card border border-dashed border-card-border rounded-xl p-4 text-xs text-muted-foreground flex items-center gap-2">
        <FileText className="w-4 h-4 shrink-0 text-muted-foreground" />
        <span>
          {t(
            "No report template uploaded yet — set one up under Imports → Report Template to preview the calculator in your team's report layout.",
            "Aún no hay plantilla de reporte — súbela en Importaciones → Plantilla de Reporte para previsualizar la calculadora en el formato del equipo."
          )}
        </span>
      </div>
    );
  }

  const columns = template.columns.length > 0 ? template.columns : DEFAULT_TEMPLATE_COLUMNS;

  return (
    <div data-testid="template-preview" className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-border bg-muted/30 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-konti-olive" />
          <h3 className="text-sm font-bold text-foreground" data-testid="template-preview-title">
            {t("Report Template Preview", "Vista previa de plantilla")} — {template.name}
          </h3>
        </div>
        <span className="text-[11px] text-muted-foreground uppercase tracking-wider">
          {t("Live calculator data", "Datos de la calculadora")}
        </span>
      </div>
      {template.headerLines.length > 0 && (
        <div className="px-5 py-3 border-b border-border text-center" data-testid="template-preview-header">
          {template.headerLines.map((line, i) => (
            <p key={i} className={`text-xs ${i === 0 ? "font-bold text-foreground" : "text-muted-foreground"}`}>
              {line}
            </p>
          ))}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-[640px]">
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              {columns.map((col) => (
                <th key={col} className="text-left px-4 py-2 font-semibold text-muted-foreground">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {entries.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-6 text-center text-muted-foreground">
                  {t("Add materials to see the preview populate.", "Agrega materiales para ver la vista previa.")}
                </td>
              </tr>
            ) : (
              entries.map((entry, i) => (
                <tr key={i} data-testid={`template-row-${i}`} className="hover:bg-muted/20">
                  {columns.map((col) => (
                    <td key={col} className="px-4 py-2 text-foreground">{templateCellForColumn(col, entry)}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
          {entries.length > 0 && (
            <tfoot>
              <tr className="border-t border-border bg-muted/30">
                <td colSpan={columns.length - 1} className="px-4 py-2 text-right font-semibold text-foreground">
                  {t("Grand Total", "Total General")}
                </td>
                <td className="px-4 py-2 text-right font-bold text-konti-olive" data-testid="template-grand-total">
                  ${grandTotal.toLocaleString()}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {template.footer && (
        <div className="px-5 py-3 border-t border-border text-[11px] text-muted-foreground text-center" data-testid="template-preview-footer">
          {template.footer}
        </div>
      )}
    </div>
  );
}

function makeEntry(item: string, category: string, unit: string, qty: number, base: number, override: number | null): LocalEntry {
  const effective = override ?? base;
  return {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    materialName: item,
    category,
    unit,
    quantity: qty,
    basePrice: base,
    manualPriceOverride: override,
    effectivePrice: effective,
    lineTotal: effective * qty,
  };
}

export default function CalculatorPage() {
  const { t } = useLang();
  const { data: projects = [] } = useListProjects();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const initialProject = params.get("projectId") ?? "";
  // `tab=overview` is an alias used by deep-links from the project report
  // (e.g. the management-fee Edit link). The calculator surfaces management
  // fee on the Contractor tab, so funnel "overview" → "contractor".
  const normalizeTab = (tb: string | null) => (tb === "overview" ? "contractor" : (tb ?? "estimate"));
  const initialTab = normalizeTab(params.get("tab"));
  const [selectedProject, setSelectedProject] = useState<string>(initialProject);
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  useEffect(() => {
    const p = new URLSearchParams(search);
    const pid = p.get("projectId");
    const tb = p.get("tab");
    if (pid) setSelectedProject(pid);
    if (tb) setActiveTab(normalizeTab(tb));
  }, [search]);
  const [showAddModal, setShowAddModal] = useState(false);
  // Inline edits are keyed by entry.id (stable across refetches) so a server
  // refresh after a successful save naturally clears the local draft via the
  // "originalById" comparison below.
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [basePriceEdits, setBasePriceEdits] = useState<Record<string, string>>({});
  const [qtyEdits, setQtyEdits] = useState<Record<string, string>>({});
  const [localEntries, setLocalEntries] = useState<LocalEntry[]>([]);

  const projectId = selectedProject || projects[0]?.id || "";
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const updateLine = useUpdateProjectCalculationLine();

  useEffect(() => {
    setOverrides({});
    setBasePriceEdits({});
    setQtyEdits({});
  }, [projectId]);
  const { data: calc, isLoading } = useGetProjectCalculations(projectId, {
    query: { enabled: !!projectId, queryKey: getGetProjectCalculationsQueryKey(projectId) }
  });

  const baseEntries: LocalEntry[] = (calc?.entries ?? []).map((e) => {
    const id = e.id;
    const overrideRaw = overrides[id];
    const overrideVal = overrideRaw !== undefined && overrideRaw !== ""
      ? Number(overrideRaw)
      : (e.manualPriceOverride ?? null);
    const baseEditRaw = basePriceEdits[id];
    const baseVal = baseEditRaw !== undefined && baseEditRaw !== "" && isFinite(Number(baseEditRaw))
      ? Number(baseEditRaw)
      : e.basePrice;
    const qtyEditRaw = qtyEdits[id];
    const qtyVal = qtyEditRaw !== undefined && qtyEditRaw !== "" && isFinite(Number(qtyEditRaw))
      ? Number(qtyEditRaw)
      : e.quantity;
    const effective = overrideVal ?? baseVal;
    return {
      ...e,
      basePrice: baseVal,
      quantity: qtyVal,
      manualPriceOverride: overrideVal,
      effectivePrice: effective,
      lineTotal: effective * qtyVal,
    };
  });

  // Save an inline edit on blur. Compares the draft to the server value so
  // we don't fire a no-op PATCH when the user just tabs through fields.
  const saveLineEdit = (
    field: "quantity" | "basePrice" | "manualPriceOverride",
    lineId: string,
  ) => {
    const original = (calc?.entries ?? []).find((e) => e.id === lineId);
    if (!original) return;

    let body: { quantity?: number; basePrice?: number; manualPriceOverride?: number | null };
    if (field === "quantity") {
      const raw = qtyEdits[lineId];
      if (raw === undefined || raw === "") return;
      const next = Number(raw);
      if (!isFinite(next) || next < 0 || next === original.quantity) {
        setQtyEdits((p) => { const c = { ...p }; delete c[lineId]; return c; });
        return;
      }
      body = { quantity: next };
    } else if (field === "basePrice") {
      const raw = basePriceEdits[lineId];
      if (raw === undefined || raw === "") return;
      const next = Number(raw);
      if (!isFinite(next) || next < 0 || next === original.basePrice) {
        setBasePriceEdits((p) => { const c = { ...p }; delete c[lineId]; return c; });
        return;
      }
      body = { basePrice: next };
    } else {
      const raw = overrides[lineId];
      const nextVal: number | null = raw === undefined || raw === ""
        ? null
        : (isFinite(Number(raw)) && Number(raw) >= 0 ? Number(raw) : null);
      const prevVal = original.manualPriceOverride ?? null;
      if (nextVal === prevVal) {
        setOverrides((p) => { const c = { ...p }; delete c[lineId]; return c; });
        return;
      }
      body = { manualPriceOverride: nextVal };
    }

    updateLine.mutate(
      { projectId, lineId, data: body },
      {
        onSuccess: () => {
          // Server refresh wins; clear the matching local draft.
          if (field === "quantity") setQtyEdits((p) => { const c = { ...p }; delete c[lineId]; return c; });
          if (field === "basePrice") setBasePriceEdits((p) => { const c = { ...p }; delete c[lineId]; return c; });
          if (field === "manualPriceOverride") setOverrides((p) => { const c = { ...p }; delete c[lineId]; return c; });
          queryClient.invalidateQueries({ queryKey: getGetProjectCalculationsQueryKey(projectId) });
        },
        onError: () => {
          toast({
            title: t("Could not save change", "No se pudo guardar el cambio"),
            description: t("Please try again.", "Por favor inténtalo de nuevo."),
            variant: "destructive",
          });
        },
      },
    );
  };

  const allEntries: LocalEntry[] = [...baseEntries, ...localEntries];

  const subtotalByCategory: Record<string, number> = {};
  allEntries.forEach((e) => {
    subtotalByCategory[e.category] = (subtotalByCategory[e.category] ?? 0) + e.lineTotal;
  });
  const grandTotal = Object.values(subtotalByCategory).reduce((a, b) => a + b, 0);

  const handleAddEntry = (item: { item: string; category: string; unit: string; basePrice: number; quantity: number }) => {
    setLocalEntries((prev) => [
      ...prev,
      makeEntry(item.item, item.category, item.unit, item.quantity, item.basePrice, null),
    ]);
  };

  return (
    <RequireAuth>
      <AppLayout>
        <div className="space-y-6" data-testid="calculator-page">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
                <Calculator className="w-5 h-5 sm:w-6 sm:h-6 text-konti-olive shrink-0" />
                {t("Cost Calculator", "Calculadora de Costos")}
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                {t("Manage material quantities and cost overrides.", "Gestiona cantidades de materiales y sobrescritura de precios.")}
              </p>
            </div>
            </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList data-testid="calculator-tabs" className="flex flex-wrap h-auto">
              <TabsTrigger value="estimate" data-testid="tab-estimate">{t("Estimate", "Estimado")}</TabsTrigger>
              <TabsTrigger value="contractor" data-testid="tab-contractor">{t("Contractor", "Contratista")}</TabsTrigger>
              <TabsTrigger
                value="imports"
                data-testid="tab-imports"
                title={t(
                  "Bulk-import materials, labor rates, receipts, and report templates from CSV or Excel.",
                  "Importa en lote materiales, tarifas de mano de obra, recibos y plantillas de reporte desde CSV o Excel.",
                )}
              >
                {t("Imported Materials", "Materiales Importados")}
              </TabsTrigger>
              <TabsTrigger value="variance" data-testid="tab-variance">{t("Variance", "Varianza")}</TabsTrigger>
            </TabsList>

            <TabsContent value="estimate" className="space-y-4">
              <div className="flex items-center justify-end gap-3 flex-wrap">
                <select
                  value={selectedProject}
                  onChange={(e) => setSelectedProject(e.target.value)}
                  data-testid="project-selector"
                  className="px-3 py-2 rounded-md border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="">{t("Select Project", "Seleccionar Proyecto")}</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <button
                  onClick={() => setShowAddModal(true)}
                  data-testid="btn-add-material"
                  className="flex items-center gap-1.5 px-4 py-2 bg-konti-olive hover:bg-konti-olive/90 text-white text-sm font-semibold rounded-md transition-colors"
                >
                  <Plus className="w-4 h-4" /> {t("Add Material", "Agregar Material")}
                </button>
              </div>

              {isLoading ? (
            <div className="h-64 bg-card rounded-xl border animate-pulse" />
          ) : (
            <>
              <div className="bg-card rounded-xl border border-card-border shadow-sm overflow-x-auto">
                <table className="w-full text-sm min-w-[700px]" data-testid="calculator-table">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border">
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground">{t("Material", "Material")}</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell">{t("Category", "Categoría")}</th>
                      <th className="text-right px-4 py-3 font-semibold text-muted-foreground">{t("Unit", "Unidad")}</th>
                      <th className="text-right px-4 py-3 font-semibold text-muted-foreground">{t("Qty", "Cant.")}</th>
                      <th className="text-right px-4 py-3 font-semibold text-muted-foreground">{t("Base Price", "P. Base")}</th>
                      <th className="text-right px-4 py-3 font-semibold text-muted-foreground">{t("Override", "Sobrescribir")}</th>
                      <th className="text-right px-4 py-3 font-semibold text-muted-foreground">
                        <span className="inline-flex items-center justify-end gap-1" data-testid="effective-price-header">
                          {t("Effective Price", "Precio Efectivo")}
                          <TooltipProvider delayDuration={150}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button type="button" aria-label={t("What is the effective price?", "¿Qué es el precio efectivo?")} className="text-muted-foreground hover:text-foreground" data-testid="effective-price-help">
                                  <HelpCircle className="w-3.5 h-3.5" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-[260px] text-xs leading-relaxed">
                                {t(
                                  "The Effective Price is the price actually used for this line. It equals the Override when set, otherwise the Base Price. An asterisk (*) marks rows where an override is active.",
                                  "El Precio Efectivo es el precio realmente usado en la línea. Equivale al valor Sobrescribir cuando se ha ingresado, o al Precio Base cuando no. Un asterisco (*) marca las filas con sobrescritura activa."
                                )}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </span>
                      </th>
                      <th className="text-right px-4 py-3 font-semibold text-muted-foreground">{t("Total", "Total")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(subtotalByCategory).map(([cat]) => {
                      const catEntries = allEntries.filter((e) => e.category === cat);
                      const catTotal = catEntries.reduce((a, b) => a + b.lineTotal, 0);
                      return [
                        <tr key={`cat-${cat}`} className="bg-muted/30">
                          <td colSpan={7} className="px-4 py-2">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${CAT_COLORS[cat] ?? "bg-gray-100 text-gray-700"}`}>{cat}</span>
                          </td>
                          <td className="px-4 py-2 text-right text-xs font-bold text-muted-foreground">${catTotal.toLocaleString()}</td>
                        </tr>,
                        ...catEntries.map((entry, entryIdx) => {
                          const globalIdx = allEntries.indexOf(entry);
                          const isLocal = globalIdx >= baseEntries.length;
                          return (
                            <tr key={`${cat}-${entryIdx}`} className="hover:bg-muted/20 border-t border-border/50 transition-colors" data-testid={`calc-row-${globalIdx}`}>
                              <td className="px-4 py-2.5 font-medium text-foreground">{entry.materialName}</td>
                              <td className="px-4 py-2.5 text-muted-foreground hidden md:table-cell text-xs">{entry.category}</td>
                              <td className="px-4 py-2.5 text-right text-muted-foreground">{entry.unit}</td>
                              <td className="px-4 py-2.5 text-right">
                                {!isLocal ? (
                                  <input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    value={qtyEdits[entry.id] ?? String(entry.quantity)}
                                    onChange={(e) => setQtyEdits((prev) => ({ ...prev, [entry.id]: e.target.value }))}
                                    onBlur={() => saveLineEdit("quantity", entry.id)}
                                    data-testid={`calc-qty-${globalIdx}`}
                                    className="w-20 px-2 py-1 rounded border border-input text-right text-sm bg-background"
                                  />
                                ) : (
                                  entry.quantity
                                )}
                              </td>
                              <td className="px-4 py-2.5 text-right text-muted-foreground">
                                {!isLocal ? (
                                  <input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    value={basePriceEdits[entry.id] ?? String(entry.basePrice)}
                                    onChange={(e) => setBasePriceEdits((prev) => ({ ...prev, [entry.id]: e.target.value }))}
                                    onBlur={() => saveLineEdit("basePrice", entry.id)}
                                    data-testid={`calc-base-${globalIdx}`}
                                    className="w-24 px-2 py-1 rounded border border-input text-right text-sm bg-background"
                                  />
                                ) : (
                                  <>${entry.basePrice.toLocaleString()}</>
                                )}
                              </td>
                              <td className="px-4 py-2.5 text-right">
                                {!isLocal ? (
                                  <input
                                    type="number"
                                    min={0}
                                    value={overrides[entry.id] ?? (entry.manualPriceOverride !== null && entry.manualPriceOverride !== undefined ? String(entry.manualPriceOverride) : "")}
                                    onChange={(e) => setOverrides((prev) => ({ ...prev, [entry.id]: e.target.value }))}
                                    onBlur={() => saveLineEdit("manualPriceOverride", entry.id)}
                                    placeholder="—"
                                    data-testid={`calc-override-${globalIdx}`}
                                    className="w-20 px-2 py-1 rounded border border-input text-right text-sm bg-background"
                                  />
                                ) : (
                                  <span className="text-muted-foreground text-xs">—</span>
                                )}
                              </td>
                              <td className="px-4 py-2.5 text-right font-medium">
                                ${entry.effectivePrice.toLocaleString()}
                                {entry.manualPriceOverride !== null && (
                                  <span className="ml-1 text-xs text-konti-olive">*</span>
                                )}
                              </td>
                              <td className="px-4 py-2.5 text-right font-bold text-foreground">${entry.lineTotal.toLocaleString()}</td>
                            </tr>
                          );
                        }),
                      ];
                    })}
                  </tbody>
                </table>
              </div>

              {/* Grand total */}
              <div className="bg-konti-dark rounded-xl p-6 flex items-center justify-between text-white">
                <div>
                  <p className="text-white/50 text-sm">{t("Grand Total", "Total General")}</p>
                  <p className="text-xs text-white/30 mt-0.5">
                    {allEntries.length} {t("line items", "líneas de presupuesto")} · {Object.keys(subtotalByCategory).length} {t("categories", "categorías")}
                  </p>
                </div>
                <p className="text-4xl font-bold" data-testid="grand-total">${grandTotal.toLocaleString()}</p>
              </div>

              <p className="text-[11px] text-muted-foreground" data-testid="effective-price-legend">
                <span className="text-konti-olive font-semibold">*</span>{" "}
                {t(
                  "Effective Price uses the Override when set; otherwise the Base Price.",
                  "El Precio Efectivo usa el valor Sobrescribir cuando está presente; en caso contrario, el Precio Base."
                )}
              </p>

              {/* Subtotals */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries(subtotalByCategory).map(([cat, total]) => (
                  <div key={cat} className="bg-card rounded-lg border border-card-border p-3">
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${CAT_COLORS[cat] ?? "bg-gray-100 text-gray-700"}`}>{cat}</span>
                    <p className="text-lg font-bold text-foreground mt-2">${total.toLocaleString()}</p>
                  </div>
                ))}
              </div>

              {/* In-app preview using uploaded report template (#34) */}
              {projectId && (
                <TemplatePreviewPanel projectId={projectId} entries={allEntries} grandTotal={grandTotal} />
              )}
            </>
          )}
            </TabsContent>

            <TabsContent value="contractor">
              <ContractorCalculator defaultProjectId={selectedProject || projects[0]?.id} />
            </TabsContent>
            <TabsContent value="imports">
              <ImportsPanel />
            </TabsContent>
            <TabsContent value="variance">
              <VarianceReportPanel defaultProjectId={selectedProject || projects[0]?.id} />
            </TabsContent>
          </Tabs>
        </div>

        {showAddModal && (
          <AddMaterialModal onClose={() => setShowAddModal(false)} onAdd={handleAddEntry} />
        )}
      </AppLayout>
    </RequireAuth>
  );
}
