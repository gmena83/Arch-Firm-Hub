import { useEffect, useState } from "react";
import { useLang } from "@/hooks/use-lang";
import { useToast } from "@/hooks/use-toast";
import { useListProjects } from "@workspace/api-client-react";
import { FileSpreadsheet, Sparkles, Loader2 } from "lucide-react";
import { getJson, postJson, type ContractorEstimate } from "./estimating-helpers";

const SCOPE_PRESETS = [
  { key: "pool", labelEn: "Pool / piscina", labelEs: "Piscina" },
  { key: "solar", labelEn: "Solar PV", labelEs: "Sistema solar" },
  { key: "roof", labelEn: "Roof membrane", labelEs: "Membrana de techo" },
  { key: "kitchen", labelEn: "Kitchen remodel", labelEs: "Remodelación de cocina" },
  { key: "bathroom", labelEn: "Bathroom remodel", labelEs: "Remodelación de baño" },
];

export function ContractorCalculator({ defaultProjectId }: { defaultProjectId?: string }) {
  const { t, lang } = useLang();
  const { toast } = useToast();
  const { data: projects = [] } = useListProjects();
  const [projectId, setProjectId] = useState<string>(defaultProjectId ?? "");
  const [squareMeters, setSquareMeters] = useState<string>("180");
  const [projectType, setProjectType] = useState<string>("residencial");
  const [scope, setScope] = useState<string[]>(["pool", "solar"]);
  const [source, setSource] = useState<string>("Preliminary project doc — site visit notes");
  const [contingency, setContingency] = useState<string>("8");
  const [estimate, setEstimate] = useState<ContractorEstimate | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!projectId && projects[0]) setProjectId(projects[0].id);
  }, [projects, projectId]);

  useEffect(() => {
    if (!projectId) return;
    let cancel = false;
    getJson<ContractorEstimate>(`/api/projects/${projectId}/contractor-estimate`)
      .then((d) => { if (!cancel) setEstimate(d); })
      .catch(() => { if (!cancel) setEstimate(null); });
    return () => { cancel = true; };
  }, [projectId]);

  const toggleScope = (k: string) => setScope((prev) => prev.includes(k) ? prev.filter((s) => s !== k) : [...prev, k]);

  const generate = async () => {
    if (!projectId) return;
    const sm = Number(squareMeters);
    if (!isFinite(sm) || sm <= 0) {
      toast({ title: t("Invalid square meters", "Metros cuadrados inválidos"), variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const est = await postJson<ContractorEstimate>(`/api/projects/${projectId}/contractor-estimate`, {
        squareMeters: sm,
        projectType,
        scope,
        source,
        contingencyPercent: Number(contingency) || 0,
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
          <h2 className="font-bold text-foreground">{t("Contractor Calculator", "Calculadora de Contratista")}</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          {t(
            "Start from the preliminary project document. Enter scope and size to generate a draft contractor-side estimate using the current materials catalog and labor rates.",
            "Parte del documento preliminar del proyecto. Ingresa el alcance y tamaño para generar un estimado borrador del contratista usando el catálogo de materiales y las tarifas de mano de obra actuales."
          )}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="text-xs font-medium space-y-1 block">
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
            {t("Project type", "Tipo de proyecto")}
            <select value={projectType} onChange={(e) => setProjectType(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-md border border-input bg-background text-sm">
              <option value="residencial">{t("Residential", "Residencial")}</option>
              <option value="comercial">{t("Commercial", "Comercial")}</option>
              <option value="mixto">{t("Mixed-use", "Mixto")}</option>
              <option value="contenedor">{t("Container", "Contenedor")}</option>
            </select>
          </label>
          <label className="text-xs font-medium space-y-1 block">
            {t("Square meters", "Metros cuadrados")}
            <input type="number" min={1} value={squareMeters} onChange={(e) => setSquareMeters(e.target.value)} data-testid="contractor-sqm" className="w-full mt-1 px-3 py-2 rounded-md border border-input bg-background text-sm" />
          </label>
          <label className="text-xs font-medium space-y-1 block">
            {t("Contingency %", "Contingencia %")}
            <input type="number" min={0} max={30} value={contingency} onChange={(e) => setContingency(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-md border border-input bg-background text-sm" />
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

      {estimate && (
        <div className="bg-card rounded-xl border border-card-border p-5 shadow-sm" data-testid="contractor-estimate-result">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <div>
              <h3 className="font-bold text-foreground">{t("Estimate Result", "Resultado del Estimado")}</h3>
              <p className="text-xs text-muted-foreground">{estimate.source} · {new Date(estimate.generatedAt).toLocaleString(lang === "es" ? "es-PR" : "en-US")}</p>
            </div>
            <p className="text-2xl font-bold text-konti-olive" data-testid="contractor-grand-total">${estimate.grandTotal.toLocaleString()}</p>
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
              <tbody className="divide-y divide-border">
                {estimate.lines.map((l) => (
                  <tr key={l.id}>
                    <td className="px-3 py-1.5 capitalize">{l.category}</td>
                    <td className="px-3 py-1.5">{lang === "es" ? l.descriptionEs : l.description}</td>
                    <td className="px-3 py-1.5 text-right">{l.quantity}</td>
                    <td className="px-3 py-1.5">{l.unit}</td>
                    <td className="px-3 py-1.5 text-right">${l.unitPrice.toLocaleString()}</td>
                    <td className="px-3 py-1.5 text-right font-semibold">${l.lineTotal.toLocaleString()}</td>
                  </tr>
                ))}
                <tr className="bg-muted/30">
                  <td colSpan={5} className="px-3 py-2 text-right font-medium">{t("Contingency", "Contingencia")} ({estimate.contingencyPercent}%)</td>
                  <td className="px-3 py-2 text-right font-semibold">${estimate.contingency.toLocaleString()}</td>
                </tr>
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
