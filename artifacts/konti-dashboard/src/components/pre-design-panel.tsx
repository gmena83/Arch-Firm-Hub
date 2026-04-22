import { useEffect, useState } from "react";
import { customFetch } from "@workspace/api-client-react";
import { useLang } from "@/hooks/use-lang";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle2, Circle, Loader2, FileText, Sparkles, ArrowRight, Calendar,
} from "lucide-react";

type ChecklistStatus = "pending" | "in_progress" | "done";

interface ChecklistItem {
  id: string;
  label: string;
  labelEs: string;
  status: ChecklistStatus;
  assignee: string;
  completedAt?: string;
}

interface StructuredVariables {
  squareMeters: number;
  zoningCode: string;
  projectType: "residencial" | "comercial" | "mixto" | "contenedor";
  submittedAt: string;
  submittedBy: string;
}

interface AssistedBudgetRange {
  low: number;
  mid: number;
  high: number;
  currency: string;
  perSqMeterMid: number;
}

interface WeeklyReport {
  id: string;
  weekStart: string;
  weekEnd: string;
  title: string;
  titleEs: string;
  url: string;
}

interface ProjectActivity {
  id: string;
  timestamp: string;
  type: string;
  actor: string;
  description: string;
  descriptionEs: string;
}

interface PreDesignData {
  projectId: string;
  checklist: ChecklistItem[];
  structuredVariables: StructuredVariables | null;
  assistedBudgetRange: AssistedBudgetRange | null;
  weeklyReports: WeeklyReport[];
  activities: ProjectActivity[];
}

const STATUS_CYCLE: Record<ChecklistStatus, ChecklistStatus> = {
  pending: "in_progress",
  in_progress: "done",
  done: "pending",
};

export function PreDesignPanel({
  projectId,
  isClientView,
  currentPhase,
}: {
  projectId: string;
  isClientView: boolean;
  currentPhase: string;
}) {
  const { t, lang } = useLang();
  const { user } = useAuth();
  const { toast } = useToast();
  const [data, setData] = useState<PreDesignData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyItem, setBusyItem] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [showVarsForm, setShowVarsForm] = useState(false);
  const [varsForm, setVarsForm] = useState({ squareMeters: "", zoningCode: "", projectType: "residencial" });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    customFetch<PreDesignData>(`/api/projects/${projectId}/pre-design`)
      .then((d) => { if (!cancelled) setData(d); })
      .catch(() => { /* ignore */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [projectId]);

  const refresh = async () => {
    const d = await customFetch<PreDesignData>(`/api/projects/${projectId}/pre-design`);
    setData(d);
  };

  const toggleItem = async (item: ChecklistItem) => {
    setBusyItem(item.id);
    try {
      const next = STATUS_CYCLE[item.status];
      await customFetch(`/api/projects/${projectId}/checklist-toggle`, {
        method: "POST",
        body: JSON.stringify({ itemId: item.id, status: next }),
      });
      await refresh();
    } catch {
      toast({ title: t("Update failed", "Error al actualizar"), description: t("Could not update checklist item.", "No se pudo actualizar la tarea."), variant: "destructive" });
    } finally {
      setBusyItem(null);
    }
  };

  const generateGamma = async () => {
    setBusyAction("gamma");
    try {
      const res = await customFetch<{ url: string }>(`/api/projects/${projectId}/gamma-report`, { method: "POST" });
      toast({ title: t("GAMMA report ready", "Reporte GAMMA listo"), description: t("Opening client-facing report.", "Abriendo reporte para el cliente.") });
      await refresh();
      setTimeout(() => { window.location.href = res.url; }, 800);
    } catch {
      toast({ title: t("GAMMA failed", "GAMMA falló"), variant: "destructive" });
    } finally {
      setBusyAction(null);
    }
  };

  const advancePhase = async () => {
    setBusyAction("advance");
    try {
      await customFetch(`/api/projects/${projectId}/advance-phase`, { method: "POST" });
      toast({ title: t("Phase advanced", "Fase avanzada"), description: t("The project has moved to the next phase.", "El proyecto avanzó a la siguiente fase.") });
      window.location.reload();
    } catch {
      toast({ title: t("Could not advance phase", "No se pudo avanzar la fase"), variant: "destructive" });
    } finally {
      setBusyAction(null);
    }
  };

  const submitVars = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusyAction("vars");
    try {
      await customFetch(`/api/projects/${projectId}/structured-variables`, {
        method: "POST",
        body: JSON.stringify({
          squareMeters: Number(varsForm.squareMeters),
          zoningCode: varsForm.zoningCode.trim().toUpperCase(),
          projectType: varsForm.projectType,
        }),
      });
      toast({ title: t("Variables saved", "Variables guardadas"), description: t("Assisted budget range computed.", "Rango de presupuesto asistido calculado.") });
      setShowVarsForm(false);
      setVarsForm({ squareMeters: "", zoningCode: "", projectType: "residencial" });
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : t("Validation failed", "Validación fallida");
      toast({ title: t("Could not save variables", "No se pudieron guardar las variables"), description: message, variant: "destructive" });
    } finally {
      setBusyAction(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-card rounded-xl border border-card-border p-5 shadow-sm">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> {t("Loading pre-design data…", "Cargando datos de pre-diseño…")}
        </div>
      </div>
    );
  }
  if (!data) return null;

  const totalSteps = data.checklist.length;
  const doneSteps = data.checklist.filter((c) => c.status === "done").length;
  const checklistComplete = totalSteps > 0 && doneSteps === totalSteps;
  const showChecklist = currentPhase === "consultation" || currentPhase === "discovery";
  const isTeam = !isClientView && user?.role !== "client";
  const isClient = user?.role === "client";

  const projectTypeLabel = (pt: string) => {
    const map: Record<string, { en: string; es: string }> = {
      residencial: { en: "Residential", es: "Residencial" },
      comercial: { en: "Commercial", es: "Comercial" },
      mixto: { en: "Mixed-use", es: "Mixto" },
      contenedor: { en: "Container", es: "Contenedor" },
    };
    return lang === "es" ? map[pt]?.es : map[pt]?.en;
  };

  return (
    <div className="space-y-6">
      {/* Pre-Design Checklist */}
      {showChecklist && (
        <div className="bg-card rounded-xl border border-card-border p-5 shadow-sm" data-testid="predesign-checklist">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-foreground">{t("Pre-Design & Viability Checklist", "Lista de Pre-Diseño y Viabilidad")}</h2>
            <span className="text-xs font-semibold text-konti-olive">{doneSteps}/{totalSteps}</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-4">
            <div className="h-full bg-konti-olive transition-all" style={{ width: `${(doneSteps / Math.max(totalSteps, 1)) * 100}%` }} />
          </div>
          <div className="space-y-1.5">
            {data.checklist.map((item) => {
              const label = lang === "es" ? item.labelEs : item.label;
              const isBusy = busyItem === item.id;
              const Icon = item.status === "done" ? CheckCircle2 : item.status === "in_progress" ? Loader2 : Circle;
              const iconColor =
                item.status === "done" ? "text-konti-olive" :
                item.status === "in_progress" ? "text-amber-500" : "text-muted-foreground";
              return (
                <button
                  key={item.id}
                  type="button"
                  data-testid={`checklist-${item.id}`}
                  disabled={!isTeam || isBusy}
                  onClick={() => toggleItem(item)}
                  className={`w-full flex items-start gap-3 p-2.5 rounded-lg text-left transition-colors ${isTeam ? "hover:bg-muted/40 cursor-pointer" : "cursor-default"}`}
                >
                  <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${iconColor} ${item.status === "in_progress" ? "animate-spin" : ""}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${item.status === "done" ? "line-through text-muted-foreground" : "text-foreground"}`}>{label}</p>
                    <p className="text-xs text-muted-foreground">{item.assignee}</p>
                  </div>
                  <span className={`text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded ${
                    item.status === "done" ? "bg-konti-olive/15 text-konti-olive" :
                    item.status === "in_progress" ? "bg-amber-50 text-amber-700" :
                    "bg-muted text-muted-foreground"
                  }`}>{item.status.replace("_", " ")}</span>
                </button>
              );
            })}
          </div>

          {/* Team actions */}
          {isTeam && (
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                data-testid="btn-generate-gamma"
                onClick={generateGamma}
                disabled={!checklistComplete || busyAction === "gamma"}
                className="flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold bg-konti-olive text-white hover:bg-konti-olive/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {busyAction === "gamma" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {t("Generate GAMMA Report", "Generar Reporte GAMMA")}
              </button>
              {!checklistComplete && (
                <span className="text-xs text-muted-foreground self-center">
                  {t("Complete all checklist items to enable.", "Completa todas las tareas para habilitar.")}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Structured Variables / Assisted Budget */}
      <div className="bg-card rounded-xl border border-card-border p-5 shadow-sm" data-testid="structured-vars-card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-foreground">{t("Structured Variables & Assisted Budget", "Variables Estructuradas y Presupuesto Asistido")}</h2>
          {isTeam && !showVarsForm && (
            <button
              type="button"
              data-testid="btn-edit-vars"
              onClick={() => setShowVarsForm(true)}
              className="text-xs font-semibold text-konti-olive hover:text-konti-olive/80"
            >
              {data.structuredVariables ? t("Edit", "Editar") : t("Add", "Agregar")}
            </button>
          )}
        </div>

        {showVarsForm ? (
          <form onSubmit={submitVars} className="space-y-3" data-testid="vars-form">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">{t("Square meters", "Metros cuadrados")}</label>
                <input
                  type="number"
                  required min={1} max={100000}
                  data-testid="input-square-meters"
                  value={varsForm.squareMeters}
                  onChange={(e) => setVarsForm({ ...varsForm, squareMeters: e.target.value })}
                  className="mt-1 w-full px-2 py-1.5 text-sm rounded-md border border-input bg-background"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{t("Zoning code (e.g. R-3)", "Código de zonificación (ej. R-3)")}</label>
                <input
                  type="text"
                  required
                  data-testid="input-zoning-code"
                  value={varsForm.zoningCode}
                  onChange={(e) => setVarsForm({ ...varsForm, zoningCode: e.target.value })}
                  className="mt-1 w-full px-2 py-1.5 text-sm rounded-md border border-input bg-background uppercase"
                  placeholder="R-3"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">{t("Project type", "Tipo de proyecto")}</label>
              <select
                data-testid="select-project-type"
                value={varsForm.projectType}
                onChange={(e) => setVarsForm({ ...varsForm, projectType: e.target.value })}
                className="mt-1 w-full px-2 py-1.5 text-sm rounded-md border border-input bg-background"
              >
                <option value="residencial">{t("Residential", "Residencial")}</option>
                <option value="comercial">{t("Commercial", "Comercial")}</option>
                <option value="mixto">{t("Mixed-use", "Mixto")}</option>
                <option value="contenedor">{t("Container", "Contenedor")}</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={busyAction === "vars"} data-testid="btn-save-vars" className="flex-1 py-2 rounded-md bg-konti-olive text-white text-sm font-semibold hover:bg-konti-olive/90 disabled:opacity-50">
                {busyAction === "vars" ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : t("Save & compute", "Guardar y calcular")}
              </button>
              <button type="button" onClick={() => setShowVarsForm(false)} className="px-3 py-2 rounded-md border border-input text-sm">
                {t("Cancel", "Cancelar")}
              </button>
            </div>
          </form>
        ) : data.structuredVariables ? (
          <>
            <div className="grid grid-cols-3 gap-2 mb-3 text-xs">
              <div><div className="text-muted-foreground">{t("Area", "Área")}</div><div className="font-bold text-foreground" data-testid="vars-sqm">{data.structuredVariables.squareMeters} m²</div></div>
              <div><div className="text-muted-foreground">{t("Zoning", "Zonificación")}</div><div className="font-bold text-foreground" data-testid="vars-zoning">{data.structuredVariables.zoningCode}</div></div>
              <div><div className="text-muted-foreground">{t("Type", "Tipo")}</div><div className="font-bold text-foreground" data-testid="vars-type">{projectTypeLabel(data.structuredVariables.projectType)}</div></div>
            </div>
            {data.assistedBudgetRange && (
              <div className="rounded-lg bg-konti-olive/10 border border-konti-olive/30 p-3" data-testid="assisted-budget">
                <div className="text-xs text-muted-foreground mb-1">{t("Assisted budget range", "Rango de presupuesto asistido")}</div>
                <div className="flex items-baseline gap-2">
                  <span className="text-xs">${data.assistedBudgetRange.low.toLocaleString()}</span>
                  <span className="text-xl font-bold text-konti-olive">${data.assistedBudgetRange.mid.toLocaleString()}</span>
                  <span className="text-xs">${data.assistedBudgetRange.high.toLocaleString()}</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">{t("Mid estimate at", "Estimado medio a")} ${data.assistedBudgetRange.perSqMeterMid}/m²</p>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{t("No structured variables submitted yet.", "Aún no se han ingresado variables estructuradas.")}</p>
        )}
      </div>

      {/* Client decision card */}
      {isClient && (currentPhase === "consultation" || currentPhase === "pre_design") && (
        <div className="bg-konti-olive/10 border-2 border-konti-olive rounded-xl p-5 shadow-sm" data-testid="client-decision-card">
          <div className="flex items-start gap-3">
            <ArrowRight className="w-6 h-6 text-konti-olive shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-bold text-foreground mb-1">
                {t("Ready to advance?", "¿Listo para avanzar?")}
              </h3>
              <p className="text-sm text-muted-foreground mb-3">
                {currentPhase === "consultation"
                  ? t("Review the consultation summary and approve to move into Pre-Design & Viability.", "Revisa el resumen de la consulta y aprueba para entrar en Pre-Diseño y Viabilidad.")
                  : t("Approve the viability study to begin the Design phase.", "Aprueba el estudio de viabilidad para iniciar la fase de Diseño.")}
              </p>
              <button
                type="button"
                data-testid="btn-client-advance"
                onClick={advancePhase}
                disabled={busyAction === "advance"}
                className="px-4 py-2 rounded-md bg-konti-olive text-white text-sm font-semibold hover:bg-konti-olive/90 disabled:opacity-50"
              >
                {busyAction === "advance" ? <Loader2 className="w-4 h-4 animate-spin" /> : t("Approve & Advance", "Aprobar y Avanzar")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Weekly Reports */}
      {data.weeklyReports.length > 0 && (
        <div className="bg-card rounded-xl border border-card-border p-5 shadow-sm" data-testid="weekly-reports">
          <h2 className="font-bold text-foreground mb-3 flex items-center gap-1.5">
            <Calendar className="w-4 h-4" /> {t("Weekly Reports", "Reportes Semanales")}
          </h2>
          <div className="space-y-2">
            {data.weeklyReports.map((r) => (
              <a
                key={r.id}
                href={r.url}
                data-testid={`weekly-${r.id}`}
                className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/40 transition-colors"
              >
                <FileText className="w-4 h-4 text-konti-olive shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{lang === "es" ? r.titleEs : r.title}</p>
                  <p className="text-xs text-muted-foreground">{r.weekStart} → {r.weekEnd}</p>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Activity log (team only) */}
      {isTeam && data.activities.length > 0 && (
        <div className="bg-card rounded-xl border border-card-border p-5 shadow-sm" data-testid="activity-log">
          <h2 className="font-bold text-foreground mb-3">{t("Activity Log", "Registro de Actividad")}</h2>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {data.activities.map((a) => (
              <div key={a.id} className="text-xs flex items-start gap-2 pb-2 border-b border-border last:border-0">
                <div className="w-1.5 h-1.5 rounded-full bg-konti-olive mt-1.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-foreground">{lang === "es" ? a.descriptionEs : a.description}</p>
                  <p className="text-muted-foreground">{a.actor} · {new Date(a.timestamp).toLocaleString(lang === "es" ? "es" : "en")}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
