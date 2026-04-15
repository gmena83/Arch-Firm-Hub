import { useState } from "react";
import { useListProjects, useGetProjectCalculations, useListMaterials, getGetProjectCalculationsQueryKey } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/app-layout";
import { RequireAuth } from "@/hooks/use-auth";
import { useLang } from "@/hooks/use-lang";
import { Calculator, Plus, X } from "lucide-react";

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
  materialName: string;
  category: string;
  unit: string;
  quantity: number;
  basePrice: number;
  manualPriceOverride: number | null;
  effectivePrice: number;
  lineTotal: number;
}

function makeEntry(item: string, category: string, unit: string, qty: number, base: number, override: number | null): LocalEntry {
  const effective = override ?? base;
  return {
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
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [overrides, setOverrides] = useState<Record<number, string>>({});
  const [localEntries, setLocalEntries] = useState<LocalEntry[]>([]);

  const projectId = selectedProject || projects[0]?.id || "";
  const { data: calc, isLoading } = useGetProjectCalculations(projectId, {
    query: { enabled: !!projectId, queryKey: getGetProjectCalculationsQueryKey(projectId) }
  });

  const baseEntries: LocalEntry[] = (calc?.entries ?? []).map((e, i) => {
    const overrideVal = overrides[i] !== undefined && overrides[i] !== "" ? Number(overrides[i]) : null;
    const effective = overrideVal ?? e.effectivePrice;
    return {
      ...e,
      manualPriceOverride: overrideVal,
      effectivePrice: effective,
      lineTotal: effective * e.quantity,
    };
  });

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
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Calculator className="w-6 h-6 text-konti-olive" />
                {t("Cost Calculator", "Calculadora de Costos")}
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                {t("Manage material quantities and cost overrides.", "Gestiona cantidades de materiales y sobrescritura de precios.")}
              </p>
            </div>
            <div className="flex items-center gap-3">
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
          </div>

          {isLoading ? (
            <div className="h-64 bg-card rounded-xl border animate-pulse" />
          ) : (
            <>
              <div className="bg-card rounded-xl border border-card-border shadow-sm overflow-hidden">
                <table className="w-full text-sm" data-testid="calculator-table">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border">
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground">{t("Material", "Material")}</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell">{t("Category", "Categoría")}</th>
                      <th className="text-right px-4 py-3 font-semibold text-muted-foreground">{t("Unit", "Unidad")}</th>
                      <th className="text-right px-4 py-3 font-semibold text-muted-foreground">{t("Qty", "Cant.")}</th>
                      <th className="text-right px-4 py-3 font-semibold text-muted-foreground">{t("Base Price", "P. Base")}</th>
                      <th className="text-right px-4 py-3 font-semibold text-muted-foreground">{t("Override", "Sobrescribir")}</th>
                      <th className="text-right px-4 py-3 font-semibold text-muted-foreground">{t("Effective", "Efectivo")}</th>
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
                            <tr key={`${cat}-${entryIdx}`} className="hover:bg-muted/20 border-t border-border/50 transition-colors">
                              <td className="px-4 py-2.5 font-medium text-foreground">{entry.materialName}</td>
                              <td className="px-4 py-2.5 text-muted-foreground hidden md:table-cell text-xs">{entry.category}</td>
                              <td className="px-4 py-2.5 text-right text-muted-foreground">{entry.unit}</td>
                              <td className="px-4 py-2.5 text-right">{entry.quantity}</td>
                              <td className="px-4 py-2.5 text-right text-muted-foreground">${entry.basePrice.toLocaleString()}</td>
                              <td className="px-4 py-2.5 text-right">
                                {!isLocal ? (
                                  <input
                                    type="number"
                                    min={0}
                                    value={overrides[globalIdx] ?? ""}
                                    onChange={(e) => setOverrides((prev) => ({ ...prev, [globalIdx]: e.target.value }))}
                                    placeholder="—"
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

              {/* Subtotals */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries(subtotalByCategory).map(([cat, total]) => (
                  <div key={cat} className="bg-card rounded-lg border border-card-border p-3">
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${CAT_COLORS[cat] ?? "bg-gray-100 text-gray-700"}`}>{cat}</span>
                    <p className="text-lg font-bold text-foreground mt-2">${total.toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {showAddModal && (
          <AddMaterialModal onClose={() => setShowAddModal(false)} onAdd={handleAddEntry} />
        )}
      </AppLayout>
    </RequireAuth>
  );
}
