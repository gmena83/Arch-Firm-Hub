import { useEffect, useState } from "react";
import { useLang } from "@/hooks/use-lang";
import { useToast } from "@/hooks/use-toast";
import { useListProjects, useGetProject, getGetProjectQueryKey } from "@workspace/api-client-react";
import { FileSpreadsheet, Sparkles, Loader2, Save, Plus, Trash2 } from "lucide-react";
import { ProjectMetadataCard } from "@/components/project-metadata-card";
import { getJson, postJson, putJson, type ContractorEstimate } from "./estimating-helpers";

type EditableLine = ContractorEstimate["lines"][number];

const SCOPE_PRESETS = [
  { key: "pool", labelEn: "Pool / piscina", labelEs: "Piscina" },
  { key: "solar", labelEn: "Solar PV", labelEs: "Sistema solar" },
  { key: "roof", labelEn: "Roof membrane", labelEs: "Membrana de techo" },
  { key: "kitchen", labelEn: "Kitchen remodel", labelEs: "Remodelación de cocina" },
  { key: "bathroom", labelEn: "Bathroom remodel", labelEs: "Remodelación de baño" },
];

/**
 * B-05: The Contractor Calculator owns *contractor-only* commercial inputs —
 * scope, source, target margin %, and management fee %. Project metadata
 * (square meters, bathrooms, kitchens, project type, contingency %) lives on
 * the Project record and is shown here read-only via `ProjectMetadataCard`.
 * Generating an estimate reads those fields from the project so the math
 * stays unchanged regardless of where they're entered.
 */
export function ContractorCalculator({ defaultProjectId }: { defaultProjectId?: string }) {
  const { t, lang } = useLang();
  const { toast } = useToast();
  const { data: projects = [] } = useListProjects();
  const [projectId, setProjectId] = useState<string>(defaultProjectId ?? "");
  const [scope, setScope] = useState<string[]>(["pool", "solar"]);
  const [source, setSource] = useState<string>(() => t(
    "Preliminary project doc — site visit notes",
    "Documento preliminar del proyecto — notas de visita",
  ));
  const [marginPercent, setMarginPercent] = useState<string>("12");
  const [managementFeePercent, setManagementFeePercent] = useState<string>("5");
  const [estimate, setEstimate] = useState<ContractorEstimate | null>(null);
  const [editLines, setEditLines] = useState<EditableLine[] | null>(null);
  const [savingEdits, setSavingEdits] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!projectId && projects[0]) setProjectId(projects[0].id);
  }, [projects, projectId]);

  // Hydrate the read-only metadata summary from the live project record so the
  // user can confirm what will feed the estimate before clicking Generate.
  const { data: project } = useGetProject(projectId, {
    query: { enabled: !!projectId, queryKey: getGetProjectQueryKey(projectId) },
  });

  useEffect(() => {
    if (!projectId) return;
    let cancel = false;
    getJson<ContractorEstimate>(`/api/projects/${projectId}/contractor-estimate`)
      .then((d) => { if (!cancel) { setEstimate(d); setEditLines(null); } })
      .catch(() => { if (!cancel) { setEstimate(null); setEditLines(null); } });
    return () => { cancel = true; };
  }, [projectId]);

  const startEdit = () => { if (estimate) setEditLines(estimate.lines.map((l) => ({ ...l }))); };
  const cancelEdit = () => setEditLines(null);
  const updateLine = (i: number, patch: Partial<EditableLine>) => {
    setEditLines((prev) => prev ? prev.map((l, idx) => idx === i ? { ...l, ...patch, lineTotal: Math.round((Number(patch.quantity ?? l.quantity) * Number(patch.unitPrice ?? l.unitPrice)) * 100) / 100 } : l) : prev);
  };
  const removeLine = (i: number) => setEditLines((prev) => prev ? prev.filter((_, idx) => idx !== i) : prev);
  const addLine = () => setEditLines((prev) => prev ? [...prev, { id: `line-new-${prev.length + 1}`, category: "materials", description: "New line", descriptionEs: "Nueva línea", quantity: 1, unit: "unit", unitPrice: 0, lineTotal: 0 }] : prev);

  const saveEdits = async () => {
    if (!projectId || !editLines) return;
    setSavingEdits(true);
    try {
      const updated = await putJson<ContractorEstimate>(`/api/projects/${projectId}/contractor-estimate/lines`, { lines: editLines });
      setEstimate(updated);
      setEditLines(null);
      toast({ title: t("Estimate updated", "Estimado actualizado"), description: `$${updated.grandTotal.toLocaleString()}` });
    } catch (err) {
      toast({ title: t("Failed to save", "Error al guardar"), description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    } finally {
      setSavingEdits(false);
    }
  };

  const toggleScope = (k: string) => setScope((prev) => prev.includes(k) ? prev.filter((s) => s !== k) : [...prev, k]);

  const generate = async () => {
    if (!projectId) return;
    if (!project || !project.squareMeters || project.squareMeters <= 0) {
      toast({
        title: t("Project metadata required", "Se requieren los metadatos del proyecto"),
        description: t(
          "Open Project Detail and set square meters before generating an estimate.",
          "Abre el Detalle del Proyecto y define los metros cuadrados antes de generar un estimado.",
        ),
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    try {
      // Project metadata fields are intentionally omitted from the body so the
      // server reads them from the project record (B-05 single source of truth).
      const est = await postJson<ContractorEstimate>(`/api/projects/${projectId}/contractor-estimate`, {
        scope,
        source,
        marginPercent: Number(marginPercent) || 0,
        managementFeePercent: Number(managementFeePercent) || 0,
      });
      setEstimate(est);
      toast({
        title: t("Contractor estimate generated", "Estimado de contratista generado"),
        description: `$${est.grandTotal.toLocaleString()} · ${est.lines.length} ${t("line items", "líneas")}`,
      });
    } catch (err) {
      toast({ title: t("Failed to generate estimate", "Error al generar estimado"), description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4" data-testid="contractor-calculator">
      <div className="bg-card rounded-xl border border-card-border p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <FileSpreadsheet className="w-5 h-5 text-konti-olive" />
          <h2 className="font-bold text-foreground" data-testid="project-information-heading">{t("Contractor Estimate Inputs", "Datos del Estimado del Contratista")}</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          {t(
            "Pick the project, set the contractor-only inputs (scope, target margin, management fee), and we'll pull project metadata from the Project Detail to generate a draft estimate.",
            "Elige el proyecto, define los datos exclusivos del contratista (alcance, margen objetivo, honorarios admin.) y tomaremos los metadatos desde el Detalle del Proyecto para generar un estimado borrador.",
          )}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="text-xs font-medium space-y-1 block md:col-span-2">
            {t("Project", "Proyecto")}
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              data-testid="contractor-project"
              className="w-full mt-1 px-3 py-2 rounded-md border border-input bg-background text-sm"
            >
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label className="text-xs font-medium space-y-1 block">
            {t("Margin %", "Margen %")}
            <input type="number" min={0} max={50} step="0.1" value={marginPercent} onChange={(e) => setMarginPercent(e.target.value)} data-testid="contractor-margin" className="w-full mt-1 px-3 py-2 rounded-md border border-input bg-background text-sm" />
          </label>
          <label className="text-xs font-medium space-y-1 block">
            {t("Management Fee %", "Honorarios Admin. %")}
            <input type="number" min={0} max={30} step="0.1" value={managementFeePercent} onChange={(e) => setManagementFeePercent(e.target.value)} data-testid="contractor-mgmt-fee" className="w-full mt-1 px-3 py-2 rounded-md border border-input bg-background text-sm" />
          </label>
          <label className="text-xs font-medium space-y-1 block md:col-span-2">
            {t("Source / preliminary doc reference", "Fuente / referencia del documento preliminar")}
            <input value={source} onChange={(e) => setSource(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-md border border-input bg-background text-sm" />
          </label>
        </div>

        <div className="mt-4">
          <p className="text-xs font-medium mb-2">{t("Scope", "Alcance")}</p>
          <div className="flex flex-wrap gap-2" data-testid="scope-chips">
            {SCOPE_PRESETS.map((p) => (
              <button
                key={p.key}
                onClick={() => toggleScope(p.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${scope.includes(p.key) ? "bg-konti-olive text-white border-konti-olive" : "bg-muted text-muted-foreground border-border hover:bg-muted/80"}`}
              >
                {lang === "es" ? p.labelEs : p.labelEn}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={generate}
          disabled={loading || !projectId}
          data-testid="btn-generate-contractor-estimate"
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-konti-olive hover:bg-konti-olive/90 text-white text-sm font-semibold rounded-md transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {loading ? t("Generating...", "Generando...") : t("Generate Estimate", "Generar Estimado")}
        </button>
      </div>

      {/* Read-only project metadata summary (single source of truth lives on
          the project record, edited from Project Detail). */}
      {projectId && (
        <ProjectMetadataCard
          projectId={projectId}
          variant="readonly"
          squareMeters={project?.squareMeters}
          bathrooms={project?.bathrooms}
          kitchens={project?.kitchens}
          projectType={project?.projectType}
          contingencyPercent={project?.contingencyPercent}
        />
      )}

      {estimate && (
        <div className="bg-card rounded-xl border border-card-border p-5 shadow-sm" data-testid="contractor-estimate-result">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <div>
              <h3 className="font-bold text-foreground">{t("Estimate Result", "Resultado del Estimado")}</h3>
              <p className="text-xs text-muted-foreground">{estimate.source} · {new Date(estimate.generatedAt).toLocaleString(lang === "es" ? "es-PR" : "en-US")}</p>
            </div>
            <div className="flex items-center gap-2">
              <p className="text-2xl font-bold text-konti-olive" data-testid="contractor-grand-total">${estimate.grandTotal.toLocaleString()}</p>
              {!editLines ? (
                <button onClick={startEdit} data-testid="btn-edit-lines" className="text-xs font-semibold px-3 py-1.5 rounded-md border border-border bg-background hover:bg-muted">
                  {t("Edit lines", "Editar líneas")}
                </button>
              ) : (
                <>
                  <button onClick={cancelEdit} className="text-xs font-semibold px-3 py-1.5 rounded-md border border-border bg-background hover:bg-muted">
                    {t("Cancel", "Cancelar")}
                  </button>
                  <button onClick={saveEdits} disabled={savingEdits} data-testid="btn-save-lines" className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-md bg-konti-olive text-white hover:bg-konti-olive/90 disabled:opacity-50">
                    {savingEdits ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                    {t("Save", "Guardar")}
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-4 text-xs">
            <div className="bg-muted/50 rounded p-2">
              <p className="text-muted-foreground">{t("Materials", "Materiales")}</p>
              <p className="font-bold text-foreground text-sm">${estimate.subtotalMaterials.toLocaleString()}</p>
            </div>
            <div className="bg-muted/50 rounded p-2">
              <p className="text-muted-foreground">{t("Labor", "Mano de Obra")}</p>
              <p className="font-bold text-foreground text-sm">${estimate.subtotalLabor.toLocaleString()}</p>
            </div>
            <div className="bg-muted/50 rounded p-2">
              <p className="text-muted-foreground">{t("Subcontractor", "Subcontratistas")}</p>
              <p className="font-bold text-foreground text-sm">${estimate.subtotalSubcontractor.toLocaleString()}</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[600px]">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-3 py-2">{t("Category", "Categoría")}</th>
                  <th className="text-left px-3 py-2">{t("Description", "Descripción")}</th>
                  <th className="text-right px-3 py-2">{t("Qty", "Cant.")}</th>
                  <th className="text-left px-3 py-2">{t("Unit", "Unidad")}</th>
                  <th className="text-right px-3 py-2">{t("Unit Price", "Precio Unit.")}</th>
                  <th className="text-right px-3 py-2">{t("Total", "Total")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border" data-testid="contractor-lines-tbody">
                {(editLines ?? estimate.lines).map((l, i) => editLines ? (
                  <tr key={l.id} data-testid={`edit-line-${i}`}>
                    <td className="px-2 py-1">
                      <select value={l.category} onChange={(e) => updateLine(i, { category: e.target.value })} className="w-full text-xs px-1.5 py-1 rounded border border-input bg-background capitalize">
                        <option value="materials">{t("Materials", "Materiales")}</option>
                        <option value="labor">{t("Labor", "Mano de Obra")}</option>
                        <option value="subcontractor">{t("Subcontractor", "Subcontratistas")}</option>
                      </select>
                    </td>
                    <td className="px-2 py-1">
                      <input value={lang === "es" ? l.descriptionEs : l.description} onChange={(e) => updateLine(i, lang === "es" ? { descriptionEs: e.target.value } : { description: e.target.value })} className="w-full text-xs px-1.5 py-1 rounded border border-input bg-background" data-testid={`edit-line-desc-${i}`} />
                    </td>
                    <td className="px-2 py-1">
                      <input type="number" min={0} step="0.01" value={l.quantity} onChange={(e) => updateLine(i, { quantity: Number(e.target.value) })} className="w-20 text-xs px-1.5 py-1 rounded border border-input bg-background text-right" data-testid={`edit-line-qty-${i}`} />
                    </td>
                    <td className="px-2 py-1">
                      <input value={l.unit} onChange={(e) => updateLine(i, { unit: e.target.value })} className="w-16 text-xs px-1.5 py-1 rounded border border-input bg-background" />
                    </td>
                    <td className="px-2 py-1">
                      <input type="number" min={0} step="0.01" value={l.unitPrice} onChange={(e) => updateLine(i, { unitPrice: Number(e.target.value) })} className="w-24 text-xs px-1.5 py-1 rounded border border-input bg-background text-right" data-testid={`edit-line-price-${i}`} />
                    </td>
                    <td className="px-2 py-1 text-right text-xs font-semibold">
                      <div className="flex items-center justify-end gap-1">
                        <span>${l.lineTotal.toLocaleString()}</span>
                        <button onClick={() => removeLine(i)} className="p-1 text-destructive hover:bg-destructive/10 rounded" aria-label={t("Remove line", "Eliminar línea")}><Trash2 className="w-3 h-3" /></button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={l.id}>
                    <td className="px-3 py-1.5 capitalize">{l.category}</td>
                    <td className="px-3 py-1.5">{lang === "es" ? l.descriptionEs : l.description}</td>
                    <td className="px-3 py-1.5 text-right">{l.quantity}</td>
                    <td className="px-3 py-1.5">{l.unit}</td>
                    <td className="px-3 py-1.5 text-right">${l.unitPrice.toLocaleString()}</td>
                    <td className="px-3 py-1.5 text-right font-semibold">${l.lineTotal.toLocaleString()}</td>
                  </tr>
                ))}
                {editLines && (
                  <tr>
                    <td colSpan={6} className="px-3 py-2">
                      <button onClick={addLine} className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded border border-dashed border-border hover:bg-muted" data-testid="btn-add-line">
                        <Plus className="w-3 h-3" />{t("Add line", "Agregar línea")}
                      </button>
                    </td>
                  </tr>
                )}
                <tr className="bg-muted/30">
                  <td colSpan={5} className="px-3 py-2 text-right font-medium">{t("Contingency", "Contingencia")} ({estimate.contingencyPercent}%)</td>
                  <td className="px-3 py-2 text-right font-semibold" data-testid="contractor-contingency-amount">${estimate.contingency.toLocaleString()}</td>
                </tr>
                {(estimate.marginPercent ?? 0) > 0 && (
                  <tr className="bg-muted/30">
                    <td colSpan={5} className="px-3 py-2 text-right font-medium">{t("Margin", "Margen")} ({estimate.marginPercent}%)</td>
                    <td className="px-3 py-2 text-right font-semibold" data-testid="contractor-margin-amount">${(estimate.marginAmount ?? 0).toLocaleString()}</td>
                  </tr>
                )}
                {(estimate.managementFeePercent ?? 0) > 0 && (
                  <tr className="bg-muted/30">
                    <td colSpan={5} className="px-3 py-2 text-right font-medium">{t("Management Fee", "Honorarios de Administración")} ({estimate.managementFeePercent}%)</td>
                    <td className="px-3 py-2 text-right font-semibold" data-testid="contractor-mgmt-fee-amount">${(estimate.managementFeeAmount ?? 0).toLocaleString()}</td>
                  </tr>
                )}
                <tr className="bg-konti-olive/10">
                  <td colSpan={5} className="px-3 py-2.5 text-right font-bold">{t("Grand Total", "Total General")}</td>
                  <td className="px-3 py-2.5 text-right font-bold text-konti-olive">${estimate.grandTotal.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default ContractorCalculator;
