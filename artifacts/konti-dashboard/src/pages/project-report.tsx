import { useParams, Link } from "wouter";
import { useEffect, useState } from "react";
import {
  useGetProject, useGetProjectWeather, useGetProjectTasks,
  useGetProjectCalculations,
  useGetProjectCostPlus, useGetProjectInspections, useGetProjectMilestones,
  getGetProjectQueryKey, getGetProjectWeatherQueryKey,
  getGetProjectTasksQueryKey, getGetProjectCalculationsQueryKey,
  getGetProjectCostPlusQueryKey, getGetProjectInspectionsQueryKey, getGetProjectMilestonesQueryKey,
} from "@workspace/api-client-react";
import { RequireAuth } from "@/hooks/use-auth";
import { useLang } from "@/hooks/use-lang";
import { WeatherBadge } from "@/components/weather-badge";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { Check, ArrowLeft, MapPin, Calendar, TrendingUp, Download, Loader2 } from "lucide-react";
import logoWhite from "@assets/Horizontal02_WhitePNG_1776258303461.png";

const CHART_COLORS = ["#4F5E2A", "#778894", "#1C1814", "#a3b38c", "#9fb0ba"];

interface ReportTemplate { name: string; columns: string[]; headerLines: string[]; footer: string }

function ReportContent({ projectId }: { projectId: string }) {
  const { t, lang } = useLang();
  const [isDownloading, setIsDownloading] = useState(false);
  const [template, setTemplate] = useState<ReportTemplate | null>(null);

  useEffect(() => {
    if (!projectId) return;
    let cancel = false;
    const raw = typeof window !== "undefined" ? window.localStorage.getItem("konti_auth") : null;
    let token: string | undefined;
    try { token = raw ? (JSON.parse(raw).token as string) : undefined; } catch { /* ignore */ }
    fetch(`/api/projects/${projectId}/report-template`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (!cancel && d) setTemplate(d as ReportTemplate); })
      .catch(() => undefined);
    return () => { cancel = true; };
  }, [projectId]);

  const { data: project } = useGetProject(projectId, {
    query: { enabled: !!projectId, queryKey: getGetProjectQueryKey(projectId) }
  });
  const { data: weather } = useGetProjectWeather(projectId, {
    query: { enabled: !!projectId, queryKey: getGetProjectWeatherQueryKey(projectId) }
  });
  const { data: tasks = [] } = useGetProjectTasks(projectId, {
    query: { enabled: !!projectId, queryKey: getGetProjectTasksQueryKey(projectId) }
  });
  const { data: calc } = useGetProjectCalculations(projectId, {
    query: { enabled: !!projectId, queryKey: getGetProjectCalculationsQueryKey(projectId) }
  });
  const { data: costPlus } = useGetProjectCostPlus(projectId, {
    query: { enabled: !!projectId, queryKey: getGetProjectCostPlusQueryKey(projectId) }
  });
  const { data: inspectionsData } = useGetProjectInspections(projectId, {
    query: { enabled: !!projectId, queryKey: getGetProjectInspectionsQueryKey(projectId) }
  });
  const { data: milestonesData } = useGetProjectMilestones(projectId, {
    query: { enabled: !!projectId, queryKey: getGetProjectMilestonesQueryKey(projectId) }
  });
  const inspections = inspectionsData?.inspections ?? [];
  const milestones = milestonesData?.milestones ?? [];

  async function downloadPdf() {
    if (!project || isDownloading) return;
    setIsDownloading(true);
    try {
      const response = await fetch(`/api/projects/${project.id}/pdf`, { method: "POST" });
      if (!response.ok) {
        window.print();
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const dateStr = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `KONTi-Report-${project.name.replace(/\s+/g, "-")}-${dateStr}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      window.print();
    } finally {
      setIsDownloading(false);
    }
  }

  if (!project) {
    return <div className="min-h-screen flex items-center justify-center bg-konti-dark text-white">Loading report...</div>;
  }

  const phaseLabel = lang === "es" ? project.phaseLabelEs : project.phaseLabel;
  const spendPct = Math.round((project.budgetUsed / project.budgetAllocated) * 100);
  const completedTasks = tasks.filter((t) => t.completed);
  const pendingTasks = tasks.filter((t) => !t.completed);

  const phases = [
    { key: "discovery", label: t("Discovery", "Descubrimiento"), num: 1 },
    { key: "consultation", label: t("Consultation", "Consulta"), num: 2 },
    { key: "pre_design", label: t("Pre-Design", "Pre-Diseño"), num: 3 },
    { key: "schematic_design", label: t("SD", "DE"), num: 4 },
    { key: "design_development", label: t("DD", "DD"), num: 5 },
    { key: "construction_documents", label: t("CD", "DC"), num: 6 },
    { key: "permits", label: t("Permits", "Permisos"), num: 7 },
    { key: "construction", label: t("Construction", "Construcción"), num: 8 },
    { key: "completed", label: t("Completed", "Completado"), num: 9 },
  ];

  const chartData = calc?.subtotalByCategory
    ? Object.entries(calc.subtotalByCategory).map(([name, value]) => ({ name, value }))
    : [
        { name: "Steel/Container", value: 45000 },
        { name: "Foundation", value: 32000 },
        { name: "Electrical", value: 18000 },
        { name: "Plumbing", value: 12000 },
        { name: "Finishes", value: 22000 },
      ];

  const reportDate = new Date().toLocaleDateString(lang === "es" ? "es-PR" : "en-US", {
    year: "numeric", month: "long", day: "numeric"
  });

  return (
    <div className="min-h-screen bg-konti-dark" data-testid="project-report-page">
      {/* Header */}
      <div className="bg-konti-dark border-b border-white/10 px-6 md:px-12 py-4 flex items-center justify-between sticky top-0 z-10">
        <img src={logoWhite} alt="KONTi" className="h-7 w-auto" />
        <div className="flex items-center gap-3">
          <span className="text-white/50 text-xs hidden sm:inline">{t("Progress Report", "Reporte de Progreso")} — {reportDate}</span>
          <button
            onClick={downloadPdf}
            disabled={isDownloading}
            data-testid="btn-download-pdf"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-konti-olive text-white text-xs font-semibold hover:bg-konti-olive/80 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {isDownloading
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {t("Generating…", "Generando…")}</>
              : <><Download className="w-3.5 h-3.5" /> {t("Download PDF", "Descargar PDF")}</>
            }
          </button>
          <Link
            href={`/projects/${projectId}`}
            className="flex items-center gap-1.5 text-xs text-white/60 hover:text-white transition-colors"
            data-testid="link-back-from-report"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> {t("Back to Project", "Volver al Proyecto")}
          </Link>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 md:px-12 py-12 space-y-16">
        {template && template.headerLines.length > 0 && (
          <div className="border border-konti-olive/40 bg-konti-olive/5 rounded-lg p-4 text-center" data-testid="report-template-header">
            <p className="text-[10px] uppercase tracking-widest text-konti-olive/80 mb-2">{t("Template", "Plantilla")}: {template.name}</p>
            {template.headerLines.map((line, i) => (
              <p key={i} className="text-white/80 text-sm">{line}</p>
            ))}
          </div>
        )}
        {/* Hero section */}
        <section className="text-center space-y-4">
          <div className="inline-block bg-konti-olive/20 text-konti-olive text-xs font-semibold px-4 py-1.5 rounded-full border border-konti-olive/30">
            {phaseLabel} — {t("Phase", "Fase")} {project.phaseNumber} / 9
          </div>
          <h1 className="font-display text-4xl md:text-6xl font-bold text-white leading-tight">
            {project.name}
          </h1>
          <p className="text-white/60 text-lg max-w-2xl mx-auto">
            {project.description}
          </p>
          <div className="flex items-center justify-center gap-6 text-sm text-white/50">
            <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4" /> {project.location}</span>
            <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" /> {project.startDate} → {project.estimatedEndDate}</span>
          </div>
        </section>

        {/* Key metrics */}
        <section>
          <h2 className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-6">
            {t("Key Metrics", "Métricas Clave")}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: t("Overall Progress", "Progreso General"), value: `${project.progressPercent}%`, sub: t("completion", "completado") },
              { label: t("Budget Used", "Presupuesto Usado"), value: `${spendPct}%`, sub: `$${project.budgetUsed.toLocaleString()} / $${project.budgetAllocated.toLocaleString()}` },
              { label: t("Tasks Completed", "Tareas Completadas"), value: `${completedTasks.length}`, sub: `${t("of", "de")} ${tasks.length} ${t("total", "total")}` },
              { label: t("Build Status", "Estado de Obra"), value: weather?.buildSuitabilityLabel ?? "—", sub: weather?.city ?? "" },
            ].map((metric) => (
              <div key={metric.label} className="bg-white/5 rounded-xl border border-white/10 p-5">
                <p className="text-white/40 text-xs mb-2">{metric.label}</p>
                <p className="text-white text-3xl font-bold leading-none mb-1">{metric.value}</p>
                <p className="text-white/50 text-xs">{metric.sub}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Progress bar */}
        <section className="bg-white/5 rounded-xl border border-white/10 p-6">
          <div className="flex justify-between mb-3">
            <h2 className="text-white font-bold">{t("Overall Progress", "Progreso General")}</h2>
            <span className="text-3xl font-bold text-konti-olive">{project.progressPercent}%</span>
          </div>
          <div className="h-4 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-konti-olive transition-all"
              style={{ width: `${project.progressPercent}%` }}
            />
          </div>
          <div className="flex justify-between mt-3">
            <span className="text-white/40 text-xs">{project.startDate}</span>
            <span className="text-white/40 text-xs">{project.estimatedEndDate}</span>
          </div>
        </section>

        {/* Phase timeline */}
        <section>
          <h2 className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-6">
            {t("Phase Timeline", "Línea de Tiempo de Fases")}
          </h2>
          <div className="flex gap-3">
            {phases.map((phase) => {
              const isCompleted = project.phaseNumber > phase.num;
              const isCurrent = project.phaseNumber === phase.num;
              return (
                <div key={phase.key} className="flex-1 text-center">
                  <div className={`h-1 rounded-full mb-3 ${isCompleted ? "bg-konti-olive" : isCurrent ? "bg-konti-olive/50" : "bg-white/10"}`} />
                  <div className={`w-8 h-8 rounded-full mx-auto flex items-center justify-center text-xs font-bold mb-2 ${
                    isCompleted ? "bg-konti-olive text-white" :
                    isCurrent ? "border-2 border-konti-olive text-konti-olive bg-transparent" :
                    "bg-white/10 text-white/30"
                  }`}>
                    {isCompleted ? <Check className="w-3.5 h-3.5" /> : phase.num}
                  </div>
                  <p className="text-xs text-white/40 leading-tight hidden md:block">{phase.label}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Budget chart */}
        <section className="grid md:grid-cols-2 gap-8 items-center">
          <div>
            <h2 className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-4">
              {t("Budget Breakdown", "Desglose del Presupuesto")}
            </h2>
            <div className="space-y-2">
              {chartData.map((item, i) => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                    <span className="text-sm text-white/70">{item.name}</span>
                  </div>
                  <span className="text-sm font-medium text-white">${item.value.toLocaleString()}</span>
                </div>
              ))}
              <div className="border-t border-white/10 pt-2 flex items-center justify-between">
                <span className="text-sm font-bold text-white">{t("Grand Total", "Total General")}</span>
                <span className="text-sm font-bold text-konti-olive">${chartData.reduce((a, b) => a + b.value, 0).toLocaleString()}</span>
              </div>
            </div>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={chartData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="value">
                  {chartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => [`$${value.toLocaleString()}`, ""]} contentStyle={{ background: "#1C1814", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "white" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Cost-Plus breakdown */}
        {costPlus && (
          <section data-testid="report-cost-plus">
            <h2 className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-4">
              {t("Cost-Plus Budget", "Presupuesto Cost-Plus")}
            </h2>
            <div className="bg-white/5 rounded-xl border border-white/10 p-6 space-y-2">
              {[
                { label: t("Materials", "Materiales"), value: costPlus.materialsCost },
                { label: t("Labor", "Mano de Obra"), value: costPlus.laborCost },
                { label: t("Subcontractors", "Subcontratistas"), value: costPlus.subcontractorCost },
              ].map((row) => (
                <div key={row.label} className="flex justify-between text-sm text-white/70">
                  <span>{row.label}</span>
                  <span className="text-white">${row.value.toLocaleString()}</span>
                </div>
              ))}
              <div className="flex justify-between border-t border-white/10 pt-2 text-sm">
                <span className="text-white/60 font-medium">{t("Subtotal", "Subtotal")}</span>
                <span className="font-semibold text-white">${costPlus.subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between bg-konti-olive/20 border border-konti-olive/40 rounded-md px-3 py-2 my-1">
                <span className="text-konti-olive font-semibold">
                  {t("Plus Management Fee", "Cargo de Administración Plus")} ({costPlus.plusFeePercent}%)
                </span>
                <span className="text-konti-olive font-bold">${costPlus.plusFeeAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-t border-white/10 pt-3">
                <span className="text-white font-bold">{t("Final Total", "Total Final")}</span>
                <span className="text-white text-xl font-bold">${costPlus.finalTotal.toLocaleString()}</span>
              </div>
            </div>
          </section>
        )}

        {/* Construction milestones */}
        {milestones.length > 0 && (
          <section data-testid="report-milestones">
            <h2 className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-4">
              {t("Construction Milestones", "Hitos de Construcción")}
            </h2>
            <div className="bg-white/5 rounded-xl border border-white/10 p-6 space-y-3">
              {milestones.map((m) => {
                const color = m.status === "completed" ? "bg-konti-olive" : m.status === "in_progress" ? "bg-amber-500" : "bg-white/10";
                const label = m.status === "completed" ? t("Done", "Listo") : m.status === "in_progress" ? t("In Progress", "En Progreso") : t("Upcoming", "Próximo");
                return (
                  <div key={m.id} className="flex items-center gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full ${color} shrink-0`} />
                    <div className="flex-1 flex items-center justify-between text-sm">
                      <span className="text-white">{lang === "es" ? m.titleEs : m.title}</span>
                      <span className="text-white/40 text-xs">{m.startDate} → {m.endDate} · {label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Inspections summary */}
        {inspections.length > 0 && (
          <section data-testid="report-inspections">
            <h2 className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-4">
              {t("Inspections", "Inspecciones")}
            </h2>
            <div className="bg-white/5 rounded-xl border border-white/10 divide-y divide-white/5">
              {inspections.map((insp) => {
                const statusLabels: Record<string, string> = {
                  scheduled: t("Scheduled", "Programada"),
                  passed: t("Passed", "Aprobada"),
                  failed: t("Failed", "Fallida"),
                  re_inspect: t("Re-inspect", "Re-inspección"),
                };
                const statusColor = insp.status === "passed" ? "text-emerald-400" : insp.status === "failed" ? "text-red-400" : insp.status === "re_inspect" ? "text-amber-400" : "text-sky-400";
                return (
                  <div key={insp.id} id={`inspection-${insp.id}`} className="px-5 py-3 flex items-center justify-between gap-3 text-sm scroll-mt-20">
                    <div className="min-w-0">
                      <p className="text-white font-medium truncate">{lang === "es" ? insp.titleEs : insp.title}</p>
                      <p className="text-white/40 text-xs">{insp.inspector} · {insp.scheduledDate}{insp.completedDate ? ` → ${insp.completedDate}` : ""}</p>
                      {insp.reportSentToName && (
                        <p className="text-konti-olive text-xs mt-0.5">↳ {t("Report sent to", "Reporte enviado a")} {insp.reportSentToName}</p>
                      )}
                    </div>
                    <span className={`text-xs font-bold ${statusColor} whitespace-nowrap`}>{statusLabels[insp.status]}</span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Weather */}
        {weather && (
          <section className="bg-white/5 rounded-xl border border-white/10 p-6">
            <h2 className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-4">
              {t("Site Conditions", "Condiciones del Sitio")} — {weather.city}
            </h2>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-5xl font-bold text-white">{weather.temperature}{weather.temperatureUnit}</p>
                <p className="text-white/50 mt-1">{lang === "es" ? weather.conditionEs : weather.condition} · {weather.humidity}% RH · {weather.windSpeed} {weather.windUnit}</p>
              </div>
              <div className={`px-4 py-2 rounded-xl border text-sm font-bold ${
                weather.buildSuitability === "green" ? "bg-emerald-900/40 border-emerald-500/30 text-emerald-400" :
                weather.buildSuitability === "yellow" ? "bg-amber-900/40 border-amber-500/30 text-amber-400" :
                "bg-red-900/40 border-red-500/30 text-red-400"
              }`}>
                {lang === "es" ? weather.buildSuitabilityLabelEs : weather.buildSuitabilityLabel}
              </div>
            </div>
            <p className="text-white/40 text-xs mt-3">
              {lang === "es" ? weather.buildSuitabilityReasonEs : weather.buildSuitabilityReason}
            </p>
          </section>
        )}

        {/* Tasks */}
        <section>
          <h2 className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-6">
            {t("Task Summary", "Resumen de Tareas")}
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-semibold text-white/60 mb-3">{t("Completed", "Completadas")} ({completedTasks.length})</h3>
              <div className="space-y-2">
                {completedTasks.map((task) => (
                  <div key={task.id} className="flex items-center gap-2.5 text-sm">
                    <div className="w-5 h-5 rounded-full bg-konti-olive flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-white/60 line-through">{lang === "es" ? task.titleEs : task.title}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white/60 mb-3">{t("Upcoming", "Próximas")} ({pendingTasks.length})</h3>
              <div className="space-y-2">
                {pendingTasks.slice(0, 5).map((task) => (
                  <div key={task.id} className="flex items-center gap-2.5 text-sm">
                    <div className="w-5 h-5 rounded-full border border-white/20 shrink-0" />
                    <span className="text-white/70">{lang === "es" ? task.titleEs : task.title}</span>
                    {task.dueDate && <span className="text-white/30 text-xs ml-auto">{task.dueDate}</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Next milestone */}
        {pendingTasks[0] && (
          <section className="bg-konti-olive/10 border border-konti-olive/20 rounded-xl p-6">
            <div className="flex items-start gap-3">
              <TrendingUp className="w-5 h-5 text-konti-olive mt-0.5 shrink-0" />
              <div>
                <p className="text-konti-olive text-xs font-semibold uppercase tracking-widest mb-1">{t("Next Milestone", "Próximo Hito")}</p>
                <p className="text-white font-bold text-lg">{lang === "es" ? pendingTasks[0].titleEs : pendingTasks[0].title}</p>
                {pendingTasks[0].dueDate && (
                  <p className="text-white/50 text-sm mt-1">
                    {t("Due:", "Vence:")} {pendingTasks[0].dueDate} · {pendingTasks[0].assignee}
                  </p>
                )}
              </div>
            </div>
          </section>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-white/10 px-12 py-6 flex items-center justify-between mt-12">
        <img src={logoWhite} alt="KONTi" className="h-6 w-auto opacity-50" />
        <p className="text-white/20 text-xs" data-testid="report-template-footer">
          {template?.footer
            ? template.footer
            : t("Powered by KONTi Design | Build Studio", "Desarrollado por KONTi Design | Build Studio") + " · " + t("Sustainable architecture for Puerto Rico", "Arquitectura sostenible para Puerto Rico")}
        </p>
      </footer>
    </div>
  );
}

export default function ProjectReportPage() {
  const params = useParams<{ id: string }>();

  return (
    <RequireAuth>
      <ReportContent projectId={params.id} />
    </RequireAuth>
  );
}
