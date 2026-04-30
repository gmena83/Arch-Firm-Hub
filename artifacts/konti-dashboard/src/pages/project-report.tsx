import { useParams, Link } from "wouter";
import { useEffect, useMemo, useState } from "react";
import {
  useGetProject, useGetProjectWeather, useGetProjectTasks,
  useGetProjectCalculations,
  useGetProjectCostPlus, useGetProjectInspections, useGetProjectMilestones,
  getGetProjectQueryKey, getGetProjectWeatherQueryKey,
  getGetProjectTasksQueryKey, getGetProjectCalculationsQueryKey,
  getGetProjectCostPlusQueryKey, getGetProjectInspectionsQueryKey, getGetProjectMilestonesQueryKey,
} from "@workspace/api-client-react";
import { RequireAuth, useAuth } from "@/hooks/use-auth";
import { useLang } from "@/hooks/use-lang";
import { PunchlistPanel } from "@/components/punchlist-panel";
import { ContractorMonitoringSection } from "@/components/contractor-monitoring-section";
import { reportCategoryLabel } from "@/lib/report-categories";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Check, ArrowLeft, MapPin, Calendar, TrendingUp, Download, Loader2, Sun, Moon } from "lucide-react";
import logoWhite from "@assets/Horizontal02_WhitePNG_1776258303461.png";
import logoGreen from "@assets/Horizontal02_VerdePNG_1776258303461.png";

const CHART_COLORS = ["#4F5E2A", "#778894", "#A3B38C", "#2A2622", "#9FB0BA"];

// Industry-typical share of project budget per macro phase. Sums to 1.00.
const PHASE_BUDGET_WEIGHTS: Record<string, number> = {
  discovery: 0.01,
  consultation: 0.01,
  pre_design: 0.04,
  schematic_design: 0.05,
  design_development: 0.07,
  construction_documents: 0.08,
  permits: 0.04,
  construction: 0.65,
  completed: 0.05,
};

type ReportTheme = "light" | "dark";
const REPORT_THEME_KEY = "konti.report.theme";

function loadInitialTheme(): ReportTheme {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(REPORT_THEME_KEY);
  return stored === "dark" ? "dark" : "light";
}

interface ThemeVars extends Record<string, string> {
  "--rep-bg": string;
  "--rep-bg-strong": string;
  "--rep-fg": string;
  "--rep-fg-strong": string;
  "--rep-fg-muted": string;
  "--rep-fg-soft": string;
  "--rep-fg-faint": string;
  "--rep-surface": string;
  "--rep-surface-2": string;
  "--rep-border": string;
  "--rep-border-strong": string;
}

const THEME_VARS: Record<ReportTheme, ThemeVars> = {
  light: {
    "--rep-bg": "#F4F2EE",
    "--rep-bg-strong": "#FFFFFF",
    "--rep-fg": "#1C1814",
    "--rep-fg-strong": "#1C1814",
    "--rep-fg-muted": "rgba(28,24,20,0.82)",
    "--rep-fg-soft": "rgba(28,24,20,0.65)",
    "--rep-fg-faint": "rgba(28,24,20,0.55)",
    "--rep-surface": "#FFFFFF",
    "--rep-surface-2": "rgba(119,136,148,0.14)",
    "--rep-border": "rgba(28,24,20,0.10)",
    "--rep-border-strong": "rgba(28,24,20,0.20)",
  },
  dark: {
    "--rep-bg": "#1C1814",
    "--rep-bg-strong": "#2A2622",
    "--rep-fg": "#E6EAEB",
    "--rep-fg-strong": "#FFFFFF",
    "--rep-fg-muted": "rgba(230,234,235,0.78)",
    "--rep-fg-soft": "rgba(230,234,235,0.62)",
    "--rep-fg-faint": "rgba(230,234,235,0.50)",
    "--rep-surface": "rgba(255,255,255,0.05)",
    "--rep-surface-2": "rgba(255,255,255,0.10)",
    "--rep-border": "rgba(255,255,255,0.10)",
    "--rep-border-strong": "rgba(255,255,255,0.20)",
  },
};

interface ReportTemplate { name: string; columns: string[]; headerLines: string[]; footer: string }
interface ContractorLine { id: string; category: string; description: string; descriptionEs: string; quantity: number; unit: string; unitPrice: number; lineTotal: number }
interface ContractorEstimate {
  lines: ContractorLine[];
  grandTotal: number;
  subtotalMaterials: number;
  subtotalLabor: number;
  subtotalSubcontractor: number;
  contingencyPercent: number;
  contingency: number;
  marginPercent?: number;
  marginAmount?: number;
  managementFeePercent?: number;
  managementFeeAmount?: number;
}

const DEFAULT_REPORT_COLUMNS = ["Category", "Item", "Qty", "Unit", "Unit Price", "Total"];

function reportCellForColumn(col: string, line: ContractorLine, lang: string): string {
  const c = col.trim().toLowerCase();
  if (c === "category" || c === "categoría" || c === "categoria") return line.category;
  if (c === "item" || c === "description" || c === "descripción" || c === "descripcion") return lang === "es" ? line.descriptionEs : line.description;
  if (c === "qty" || c === "quantity" || c === "cant." || c === "cantidad") return String(line.quantity);
  if (c === "unit" || c === "unidad") return line.unit;
  if (c === "unit price" || c === "precio unit." || c === "precio unitario") return `$${line.unitPrice.toLocaleString()}`;
  if (c === "total") return `$${line.lineTotal.toLocaleString()}`;
  return "";
}

function ReportContent({ projectId }: { projectId: string }) {
  const { t, lang } = useLang();
  const { viewRole } = useAuth();
  const isClientView = viewRole === "client";
  const [isDownloading, setIsDownloading] = useState(false);
  const [template, setTemplate] = useState<ReportTemplate | null>(null);
  const [contractorEst, setContractorEst] = useState<ContractorEstimate | null>(null);
  const [theme, setTheme] = useState<ReportTheme>(loadInitialTheme);
  const isLight = theme === "light";

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(REPORT_THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    if (!projectId) return;
    let cancel = false;
    const raw = typeof window !== "undefined" ? window.localStorage.getItem("konti_auth") : null;
    let token: string | undefined;
    try { token = raw ? (JSON.parse(raw).token as string) : undefined; } catch { /* ignore */ }
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
    fetch(`/api/projects/${projectId}/report-template`, { headers })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (!cancel && d) setTemplate(d as ReportTemplate); })
      .catch(() => undefined);
    // The contractor BOM is internal-only. Skip the request entirely for
    // client viewers so the raw line items never reach the browser even if
    // someone opens devtools.
    if (!isClientView) {
      fetch(`/api/projects/${projectId}/contractor-estimate`, { headers })
        .then((r) => r.ok ? r.json() : null)
        .then((d) => { if (!cancel && d) setContractorEst(d as ContractorEstimate); })
        .catch(() => undefined);
    }
    return () => { cancel = true; };
  }, [projectId, isClientView]);

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

  const themeStyle = THEME_VARS[theme];

  // Hoisted above the early return so hook order stays stable.
  const phases = useMemo(() => [
    { key: "discovery", label: t("Discovery", "Descubrimiento"), num: 1 },
    { key: "consultation", label: t("Consultation", "Consulta"), num: 2 },
    { key: "pre_design", label: t("Pre-Design", "Pre-Diseño"), num: 3 },
    { key: "schematic_design", label: t("Schematic Design", "Diseño Esquemático"), num: 4 },
    { key: "design_development", label: t("Design Development", "Desarrollo de Diseño"), num: 5 },
    { key: "construction_documents", label: t("Construction Documents", "Documentos de Construcción"), num: 6 },
    { key: "permits", label: t("Permits", "Permisos"), num: 7 },
    { key: "construction", label: t("Construction", "Construcción"), num: 8 },
    { key: "completed", label: t("Completed", "Completado"), num: 9 },
  ], [t]);

  const budgetAllocated = project?.budgetAllocated ?? 0;
  const phaseBudgetData = useMemo(() => {
    if (budgetAllocated <= 0) return [] as Array<{ key: string; name: string; value: number }>;
    return phases
      .map((p) => ({
        key: p.key,
        name: p.label,
        value: Math.round((PHASE_BUDGET_WEIGHTS[p.key] ?? 0) * budgetAllocated),
      }))
      .filter((row) => row.value > 0);
  }, [phases, budgetAllocated]);
  const phaseBudgetTotal = phaseBudgetData.reduce((sum, r) => sum + r.value, 0);

  if (!project) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-[color:var(--rep-bg)] text-[color:var(--rep-fg)]"
        style={themeStyle as React.CSSProperties}
      >
        Loading report...
      </div>
    );
  }

  const phaseLabel = lang === "es" ? project.phaseLabelEs : project.phaseLabel;
  const spendPct = Math.round((project.budgetUsed / project.budgetAllocated) * 100);
  const completedTasks = tasks.filter((task) => task.completed);
  const pendingTasks = tasks.filter((task) => !task.completed);

  const chartData = calc?.subtotalByCategory
    ? Object.entries(calc.subtotalByCategory).map(([name, value]) => ({ name: reportCategoryLabel(name, lang), value }))
    : [
        { name: reportCategoryLabel("steel", lang),      value: 45000 },
        { name: reportCategoryLabel("foundation", lang), value: 32000 },
        { name: reportCategoryLabel("electrical", lang), value: 18000 },
        { name: reportCategoryLabel("plumbing", lang),   value: 12000 },
        { name: reportCategoryLabel("finishes", lang),   value: 22000 },
      ];

  // Category rollup row data (used by the client-facing card that replaces
  // the BOM detail and by the team report as a summary above the BOM).
  const categoryRows: Array<{ key: string; label: string; total: number }> = calc?.subtotalByCategory
    ? Object.entries(calc.subtotalByCategory)
        .map(([key, total]) => ({ key, label: reportCategoryLabel(key, lang), total }))
        .sort((a, b) => b.total - a.total)
    : [];
  const categoryTotal = categoryRows.reduce((sum, r) => sum + r.total, 0);

  const reportDate = new Date().toLocaleDateString(lang === "es" ? "es-PR" : "en-US", {
    year: "numeric", month: "long", day: "numeric"
  });

  // Recharts tooltip styled per active theme so it stays readable on light or dark.
  const tooltipContentStyle = isLight
    ? { background: "#FFFFFF", border: "1px solid rgba(28,24,20,0.15)", borderRadius: 8, color: "#1C1814", boxShadow: "0 4px 12px rgba(28,24,20,0.10)" }
    : { background: "#1C1814", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 8, color: "white" };

  const reportLogo = isLight ? logoGreen : logoWhite;

  return (
    <div
      // `dark` class flips global tokens for nested panels (e.g. PunchlistPanel).
      className={`min-h-screen bg-[color:var(--rep-bg)] text-[color:var(--rep-fg)] ${isLight ? "" : "dark"}`}
      data-testid="project-report-page"
      data-report-theme={theme}
      style={themeStyle as React.CSSProperties}
    >
      {/* Header */}
      <div className="bg-[color:var(--rep-bg)] border-b border-[color:var(--rep-border)] px-4 sm:px-6 md:px-12 py-4 sm:py-5 flex items-center justify-between gap-4 sm:gap-6 flex-wrap sticky top-0 z-10">
        <img src={reportLogo} alt="KONTi" className="h-14 sm:h-16 md:h-20 w-auto shrink-0" data-testid="report-logo" />
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <span className="text-[color:var(--rep-fg-soft)] text-xs hidden sm:inline">
            {t("Progress Report", "Reporte de Progreso")} — {reportDate}
          </span>
          <button
            onClick={() => setTheme(isLight ? "dark" : "light")}
            data-testid="btn-toggle-theme"
            aria-label={isLight ? t("Switch to dark mode", "Cambiar a modo oscuro") : t("Switch to light mode", "Cambiar a modo claro")}
            title={isLight ? t("Dark mode", "Modo oscuro") : t("Light mode", "Modo claro")}
            className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-[color:var(--rep-border-strong)] text-[color:var(--rep-fg-muted)] hover:text-[color:var(--rep-fg-strong)] hover:bg-[color:var(--rep-surface-2)] transition-colors"
          >
            {isLight ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>
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
            className="flex items-center gap-1.5 text-xs text-[color:var(--rep-fg-muted)] hover:text-[color:var(--rep-fg-strong)] transition-colors"
            data-testid="link-back-from-report"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> {t("Back to Project", "Volver al Proyecto")}
          </Link>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 md:px-12 py-8 md:py-12 space-y-12 md:space-y-16">
        {template && template.headerLines.length > 0 && (
          <div className="border border-konti-olive/40 bg-konti-olive/5 rounded-lg p-4 text-center" data-testid="report-template-header">
            <p className="text-[10px] uppercase tracking-widest text-konti-olive/80 mb-2">{t("Template", "Plantilla")}: {template.name}</p>
            {template.headerLines.map((line, i) => (
              <p key={i} className="text-[color:var(--rep-fg-muted)] text-sm">{line}</p>
            ))}
          </div>
        )}
        {/* Hero section */}
        <section className="text-center space-y-4">
          <div className="inline-block bg-konti-olive/20 text-konti-olive text-xs font-semibold px-4 py-1.5 rounded-full border border-konti-olive/30">
            {phaseLabel}
          </div>
          <h1 className="font-display text-4xl md:text-6xl font-bold text-[color:var(--rep-fg-strong)] leading-tight">
            {project.name}
          </h1>
          <p className="text-[color:var(--rep-fg-muted)] text-lg max-w-2xl mx-auto">
            {project.description}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-[color:var(--rep-fg-soft)]">
            <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4" /> {project.location}</span>
            <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" /> {project.startDate} → {project.estimatedEndDate}</span>
          </div>
        </section>

        {/* Key metrics */}
        <section>
          <h2 className="text-[color:var(--rep-fg-faint)] text-xs font-semibold uppercase tracking-widest mb-6">
            {t("Key Metrics", "Métricas Clave")}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: t("Overall Progress", "Progreso General"), value: `${project.progressPercent}%`, sub: t("completion", "completado") },
              { label: t("Budget Used", "Presupuesto Usado"), value: `${spendPct}%`, sub: `$${project.budgetUsed.toLocaleString()} / $${project.budgetAllocated.toLocaleString()}` },
              { label: t("Tasks Completed", "Tareas Completadas"), value: `${completedTasks.length}`, sub: `${t("of", "de")} ${tasks.length} ${t("total", "total")}` },
              { label: t("Site Conditions", "Condiciones del Sitio"), value: weather?.buildSuitabilityLabel ?? "—", sub: weather?.city ?? "" },
            ].map((metric) => (
              <div key={metric.label} className="bg-[color:var(--rep-surface)] rounded-xl border border-[color:var(--rep-border)] p-5">
                <p className="text-[color:var(--rep-fg-faint)] text-xs mb-2">{metric.label}</p>
                <p className="text-[color:var(--rep-fg-strong)] text-3xl font-bold leading-none mb-1">{metric.value}</p>
                <p className="text-[color:var(--rep-fg-soft)] text-xs">{metric.sub}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Progress bar */}
        <section className="bg-[color:var(--rep-surface)] rounded-xl border border-[color:var(--rep-border)] p-6">
          <div className="flex justify-between mb-3">
            <h2 className="text-[color:var(--rep-fg-strong)] font-bold">{t("Overall Progress", "Progreso General")}</h2>
            <span className="text-3xl font-bold text-konti-olive">{project.progressPercent}%</span>
          </div>
          <div className="h-4 rounded-full bg-[color:var(--rep-surface-2)] overflow-hidden">
            <div
              className="h-full rounded-full bg-konti-olive transition-all"
              style={{ width: `${project.progressPercent}%` }}
            />
          </div>
          <div className="flex justify-between mt-3">
            <span className="text-[color:var(--rep-fg-faint)] text-xs">{project.startDate}</span>
            <span className="text-[color:var(--rep-fg-faint)] text-xs">{project.estimatedEndDate}</span>
          </div>
        </section>

        {/* Phase timeline */}
        <section>
          <h2 className="text-[color:var(--rep-fg-faint)] text-xs font-semibold uppercase tracking-widest mb-6">
            {t("Phase Timeline", "Línea de Tiempo de Fases")}
          </h2>
          <div className="flex gap-2 sm:gap-3 overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0 pb-2">
            {phases.map((phase) => {
              const isCompleted = project.phaseNumber > phase.num;
              const isCurrent = project.phaseNumber === phase.num;
              return (
                <div key={phase.key} className="flex-1 min-w-[60px] text-center">
                  <div className={`h-1 rounded-full mb-3 ${isCompleted ? "bg-konti-olive" : isCurrent ? "bg-konti-olive/50" : "bg-[color:var(--rep-surface-2)]"}`} />
                  <div className={`w-8 h-8 rounded-full mx-auto flex items-center justify-center mb-2 ${
                    isCompleted ? "bg-konti-olive text-white" :
                    isCurrent ? "border-2 border-konti-olive bg-transparent" :
                    "bg-[color:var(--rep-surface-2)]"
                  }`}>
                    {isCompleted
                      ? <Check className="w-3.5 h-3.5" />
                      : isCurrent
                        ? <span className="w-2 h-2 rounded-full bg-konti-olive" />
                        : <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--rep-fg-faint)]" />
                    }
                  </div>
                  <p className={`text-xs leading-tight hidden md:block ${isCurrent ? "text-konti-olive font-semibold" : "text-[color:var(--rep-fg-soft)]"}`}>{phase.label}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Budget breakdown — pie by category */}
        <section className="grid md:grid-cols-2 gap-8 items-center">
          <div>
            <h2 className="text-[color:var(--rep-fg-faint)] text-xs font-semibold uppercase tracking-widest mb-4">
              {t("Budget Breakdown", "Desglose del Presupuesto")}
            </h2>
            <div className="space-y-2">
              {chartData.map((item, i) => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                    <span className="text-sm text-[color:var(--rep-fg-muted)]">{item.name}</span>
                  </div>
                  <span className="text-sm font-medium text-[color:var(--rep-fg-strong)]">${item.value.toLocaleString()}</span>
                </div>
              ))}
              <div className="border-t border-[color:var(--rep-border)] pt-2 flex items-center justify-between">
                <span className="text-sm font-bold text-[color:var(--rep-fg-strong)]">{t("Grand Total", "Total General")}</span>
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
                <Tooltip formatter={(value: number) => [`$${value.toLocaleString()}`, ""]} contentStyle={tooltipContentStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Budget by phase */}
        {phaseBudgetTotal > 0 && (
          <section className="grid md:grid-cols-2 gap-8 items-center" data-testid="report-budget-by-phase">
            <div>
              <h2 className="text-[color:var(--rep-fg-faint)] text-xs font-semibold uppercase tracking-widest mb-4">
                {t("Budget by Phase", "Presupuesto por Fase")}
              </h2>
              <p className="text-[color:var(--rep-fg-soft)] text-xs mb-3">
                {t(
                  "Estimated distribution of the allocated budget across macro phases (industry baseline) — not actual spend by phase.",
                  "Distribución estimada del presupuesto asignado entre las fases macro (referencia de la industria) — no representa el gasto real por fase.",
                )}
              </p>
              <div className="space-y-2">
                {phaseBudgetData.map((item, i) => (
                  <div key={item.key} className="flex items-center justify-between" data-testid={`phase-budget-row-${item.key}`}>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                      <span className="text-sm text-[color:var(--rep-fg-muted)]">{item.name}</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-medium text-[color:var(--rep-fg-strong)]">${item.value.toLocaleString()}</span>
                      <span className="text-xs text-[color:var(--rep-fg-faint)] tabular-nums">
                        {Math.round((item.value / phaseBudgetTotal) * 100)}%
                      </span>
                    </div>
                  </div>
                ))}
                <div className="border-t border-[color:var(--rep-border)] pt-2 flex items-center justify-between">
                  <span className="text-sm font-bold text-[color:var(--rep-fg-strong)]">{t("Allocated Budget", "Presupuesto Asignado")}</span>
                  <span className="text-sm font-bold text-konti-olive">${phaseBudgetTotal.toLocaleString()}</span>
                </div>
              </div>
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={phaseBudgetData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="value" nameKey="name">
                    {phaseBudgetData.map((_, index) => (
                      <Cell key={`phase-cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number, name: string) => [`$${value.toLocaleString()}`, name]} contentStyle={tooltipContentStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        {/* Cost-Plus breakdown */}
        {costPlus && (
          <section data-testid="report-cost-plus">
            <h2 className="text-[color:var(--rep-fg-faint)] text-xs font-semibold uppercase tracking-widest mb-4">
              {t("Cost-Plus Budget", "Presupuesto Cost-Plus")}
            </h2>
            <div className="bg-[color:var(--rep-surface)] rounded-xl border border-[color:var(--rep-border)] p-6 space-y-2">
              {[
                { label: t("Materials", "Materiales"), value: costPlus.materialsCost },
                { label: t("Labor", "Mano de Obra"), value: costPlus.laborCost },
                { label: t("Subcontractors", "Subcontratistas"), value: costPlus.subcontractorCost },
              ].map((row) => (
                <div key={row.label} className="flex justify-between text-sm text-[color:var(--rep-fg-muted)]">
                  <span>{row.label}</span>
                  <span className="text-[color:var(--rep-fg-strong)]">${row.value.toLocaleString()}</span>
                </div>
              ))}
              <div className="flex justify-between border-t border-[color:var(--rep-border)] pt-2 text-sm">
                <span className="text-[color:var(--rep-fg-soft)] font-medium">{t("Subtotal", "Subtotal")}</span>
                <span className="font-semibold text-[color:var(--rep-fg-strong)]">${costPlus.subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between bg-konti-olive/20 border border-konti-olive/40 rounded-md px-3 py-2 my-1">
                <span className="text-konti-olive font-semibold">
                  {t("Plus Management Fee", "Cargo de Administración Plus")} ({costPlus.plusFeePercent}%)
                </span>
                <span className="text-konti-olive font-bold">${costPlus.plusFeeAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-t border-[color:var(--rep-border)] pt-3">
                <span className="text-[color:var(--rep-fg-strong)] font-bold">{t("Final Total", "Total Final")}</span>
                <span className="text-[color:var(--rep-fg-strong)] text-xl font-bold">${costPlus.finalTotal.toLocaleString()}</span>
              </div>
              {!isClientView && contractorEst && (
                <div
                  className="mt-3 pt-3 border-t border-dashed border-[color:var(--rep-border)] space-y-1.5"
                  data-testid="report-contractor-rollup"
                >
                  <p className="text-[11px] uppercase tracking-widest text-[color:var(--rep-fg-faint)]">
                    {t("Contractor Estimate Rollup", "Resumen del Estimado del Contratista")}
                  </p>
                  <div className="flex justify-between text-sm text-[color:var(--rep-fg-muted)]">
                    <span>{t("Contractor Subtotal", "Subtotal Contratista")}</span>
                    <span className="text-[color:var(--rep-fg-strong)]">
                      ${(contractorEst.subtotalMaterials + contractorEst.subtotalLabor + contractorEst.subtotalSubcontractor).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm text-[color:var(--rep-fg-muted)]">
                    <span>{t("Contingency", "Contingencia")} ({contractorEst.contingencyPercent}%)</span>
                    <span className="text-[color:var(--rep-fg-strong)]">${contractorEst.contingency.toLocaleString()}</span>
                  </div>
                  {(contractorEst.marginPercent ?? 0) > 0 && (
                    <div className="flex justify-between text-sm text-[color:var(--rep-fg-muted)]" data-testid="report-contractor-margin">
                      <span>{t("Margin", "Margen")} ({contractorEst.marginPercent}%)</span>
                      <span className="text-[color:var(--rep-fg-strong)]">${(contractorEst.marginAmount ?? 0).toLocaleString()}</span>
                    </div>
                  )}
                  {(contractorEst.managementFeePercent ?? 0) > 0 && (
                    <div className="flex justify-between text-sm text-[color:var(--rep-fg-muted)]" data-testid="report-contractor-mgmt-fee">
                      <span>{t("Management Fee", "Honorarios de Administración")} ({contractorEst.managementFeePercent}%)</span>
                      <span className="text-[color:var(--rep-fg-strong)]">${(contractorEst.managementFeeAmount ?? 0).toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-[color:var(--rep-border)] pt-2">
                    <span className="text-[color:var(--rep-fg-strong)] font-semibold">{t("Contractor Grand Total", "Total Contratista")}</span>
                    <span className="text-[color:var(--rep-fg-strong)] font-bold">${contractorEst.grandTotal.toLocaleString()}</span>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Cost-by-category card — clients see this in place of the raw BOM. Team
            view also renders it as a summary above the BOM detail table. */}
        {categoryRows.length > 0 && (
          <section data-testid="report-category-breakdown">
            <h2 className="text-[color:var(--rep-fg-faint)] text-xs font-semibold uppercase tracking-widest mb-4">
              {t("Cost by Category", "Costo por Categoría")}
            </h2>
            <div className="bg-[color:var(--rep-surface)] rounded-xl border border-[color:var(--rep-border)] overflow-hidden">
              <table className="w-full text-sm" data-testid="report-category-table">
                <thead className="bg-[color:var(--rep-surface-2)]">
                  <tr>
                    <th className="text-left px-4 py-2 text-xs uppercase tracking-wider text-[color:var(--rep-fg-soft)]">{t("Category", "Categoría")}</th>
                    <th className="text-right px-4 py-2 text-xs uppercase tracking-wider text-[color:var(--rep-fg-soft)]">{t("Subtotal", "Subtotal")}</th>
                    <th className="text-right px-4 py-2 text-xs uppercase tracking-wider text-[color:var(--rep-fg-soft)]">{t("Share", "Participación")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--rep-border)]">
                  {categoryRows.map((row) => (
                    <tr key={row.key} data-testid={`report-category-row-${row.key}`}>
                      <td className="px-4 py-2 text-[color:var(--rep-fg-muted)]">{row.label}</td>
                      <td className="px-4 py-2 text-right text-[color:var(--rep-fg-strong)]">${row.total.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right text-[color:var(--rep-fg-soft)]">
                        {categoryTotal > 0 ? Math.round((row.total / categoryTotal) * 100) : 0}%
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-konti-olive/20">
                    <td className="px-4 py-3 font-bold text-[color:var(--rep-fg-strong)]">{t("Grand Total", "Total General")}</td>
                    <td className="px-4 py-3 text-right font-bold text-konti-olive">${categoryTotal.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-bold text-konti-olive">100%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Punchlist (read-only on the report). Always rendered — `PunchlistPanel`
            self-disables editing for client viewers via `isClientView`. */}
        <section data-testid="report-punchlist">
          <h2 className="text-[color:var(--rep-fg-faint)] text-xs font-semibold uppercase tracking-widest mb-4">
            {t("Punchlist by Phase", "Lista de Pendientes por Fase")}
          </h2>
          <div className="bg-[color:var(--rep-surface)] rounded-xl border border-[color:var(--rep-border)] p-4">
            <PunchlistPanel projectId={projectId} currentPhase={project.phase} isClientView={isClientView} />
          </div>
        </section>

        {/* Contractor monitoring narrative (delays / weather / issues / changes / breaches / rework) */}
        <ContractorMonitoringSection projectId={projectId} variant="report" />

        {/* Bill of Materials — team-only detailed line items. Clients see the
            higher-level Cost-by-Category card above instead. */}
        {!isClientView && contractorEst && contractorEst.lines.length > 0 && (
          <section data-testid="report-bill-of-materials">
            <h2 className="text-[color:var(--rep-fg-faint)] text-xs font-semibold uppercase tracking-widest mb-4">
              {t("Bill of Materials", "Lista de Materiales")}
              {template ? <span className="ml-2 text-konti-olive normal-case font-normal">· {template.name}</span> : null}
            </h2>
            <div className="bg-[color:var(--rep-surface)] rounded-xl border border-[color:var(--rep-border)] overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]" data-testid="report-bom-table">
                <thead className="bg-[color:var(--rep-surface-2)]">
                  <tr>
                    {(template?.columns?.length ? template.columns : DEFAULT_REPORT_COLUMNS).map((col) => (
                      <th key={col} className="text-left px-4 py-2 text-xs uppercase tracking-wider text-[color:var(--rep-fg-soft)]" data-testid={`report-bom-col-${col.replace(/\s+/g, "-").toLowerCase()}`}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--rep-border)]">
                  {contractorEst.lines.map((line) => (
                    <tr key={line.id}>
                      {(template?.columns?.length ? template.columns : DEFAULT_REPORT_COLUMNS).map((col) => (
                        <td key={col} className="px-4 py-2 text-[color:var(--rep-fg-muted)]">{reportCellForColumn(col, line, lang)}</td>
                      ))}
                    </tr>
                  ))}
                  <tr className="bg-konti-olive/20">
                    <td colSpan={(template?.columns?.length ? template.columns : DEFAULT_REPORT_COLUMNS).length - 1} className="px-4 py-3 text-right font-bold text-[color:var(--rep-fg-strong)]">
                      {t("Grand Total", "Total General")}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-konti-olive">${contractorEst.grandTotal.toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Construction milestones */}
        {milestones.length > 0 && (
          <section data-testid="report-milestones">
            <h2 className="text-[color:var(--rep-fg-faint)] text-xs font-semibold uppercase tracking-widest mb-4">
              {t("Construction Milestones", "Hitos de Construcción")}
            </h2>
            <div className="bg-[color:var(--rep-surface)] rounded-xl border border-[color:var(--rep-border)] p-6 space-y-3">
              {milestones.map((m) => {
                const color = m.status === "completed" ? "bg-konti-olive" : m.status === "in_progress" ? "bg-amber-500" : "bg-[color:var(--rep-surface-2)]";
                const label = m.status === "completed" ? t("Done", "Listo") : m.status === "in_progress" ? t("In Progress", "En Progreso") : t("Upcoming", "Próximo");
                return (
                  <div key={m.id} className="flex items-center gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full ${color} shrink-0`} />
                    <div className="flex-1 flex items-center justify-between text-sm">
                      <span className="text-[color:var(--rep-fg-strong)]">{lang === "es" ? m.titleEs : m.title}</span>
                      <span className="text-[color:var(--rep-fg-faint)] text-xs">{m.startDate} → {m.endDate} · {label}</span>
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
            <h2 className="text-[color:var(--rep-fg-faint)] text-xs font-semibold uppercase tracking-widest mb-4">
              {t("Inspections", "Inspecciones")}
            </h2>
            <div className="bg-[color:var(--rep-surface)] rounded-xl border border-[color:var(--rep-border)] divide-y divide-[color:var(--rep-border)]">
              {inspections.map((insp) => {
                const statusLabels: Record<string, string> = {
                  scheduled: t("Scheduled", "Programada"),
                  passed: t("Passed", "Aprobada"),
                  failed: t("Failed", "Fallida"),
                  re_inspect: t("Re-inspect", "Re-inspección"),
                };
                const statusColor = insp.status === "passed" ? "text-emerald-500" : insp.status === "failed" ? "text-red-500" : insp.status === "re_inspect" ? "text-amber-500" : "text-sky-500";
                return (
                  <div key={insp.id} id={`inspection-${insp.id}`} className="px-5 py-3 flex items-center justify-between gap-3 text-sm scroll-mt-20">
                    <div className="min-w-0">
                      <p className="text-[color:var(--rep-fg-strong)] font-medium truncate">{lang === "es" ? insp.titleEs : insp.title}</p>
                      <p className="text-[color:var(--rep-fg-faint)] text-xs">{insp.inspector} · {insp.scheduledDate}{insp.completedDate ? ` → ${insp.completedDate}` : ""}</p>
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
          <section className="bg-[color:var(--rep-surface)] rounded-xl border border-[color:var(--rep-border)] p-6">
            <h2 className="text-[color:var(--rep-fg-faint)] text-xs font-semibold uppercase tracking-widest mb-4">
              {t("Site Conditions", "Condiciones del Sitio")} — {weather.city}
            </h2>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="min-w-0">
                <p className="text-4xl sm:text-5xl font-bold text-[color:var(--rep-fg-strong)]">{weather.temperature}{weather.temperatureUnit}</p>
                <p className="text-[color:var(--rep-fg-soft)] mt-1 text-sm sm:text-base break-words">{lang === "es" ? weather.conditionEs : weather.condition} · {weather.humidity}% RH · {weather.windSpeed} {weather.windUnit}</p>
              </div>
              <div className={`self-start sm:self-auto shrink-0 px-4 py-2 rounded-xl border text-sm font-bold ${
                weather.buildSuitability === "green" ? (isLight ? "bg-emerald-100 border-emerald-300 text-emerald-800" : "bg-emerald-900/40 border-emerald-500/30 text-emerald-400") :
                weather.buildSuitability === "yellow" ? (isLight ? "bg-amber-100 border-amber-300 text-amber-800" : "bg-amber-900/40 border-amber-500/30 text-amber-400") :
                (isLight ? "bg-red-100 border-red-300 text-red-800" : "bg-red-900/40 border-red-500/30 text-red-400")
              }`}>
                {lang === "es" ? weather.buildSuitabilityLabelEs : weather.buildSuitabilityLabel}
              </div>
            </div>
            <p className="text-[color:var(--rep-fg-faint)] text-xs mt-3">
              {lang === "es" ? weather.buildSuitabilityReasonEs : weather.buildSuitabilityReason}
            </p>
          </section>
        )}

        {/* Tasks */}
        <section>
          <h2 className="text-[color:var(--rep-fg-faint)] text-xs font-semibold uppercase tracking-widest mb-6">
            {t("Task Summary", "Resumen de Tareas")}
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-semibold text-[color:var(--rep-fg-soft)] mb-3">{t("Completed", "Completadas")} ({completedTasks.length})</h3>
              <div className="space-y-2">
                {completedTasks.map((task) => (
                  <div key={task.id} className="flex items-center gap-2.5 text-sm">
                    <div className="w-5 h-5 rounded-full bg-konti-olive flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-[color:var(--rep-fg-soft)] line-through">{lang === "es" ? task.titleEs : task.title}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[color:var(--rep-fg-soft)] mb-3">{t("Upcoming", "Próximas")} ({pendingTasks.length})</h3>
              <div className="space-y-2">
                {pendingTasks.slice(0, 5).map((task) => (
                  <div key={task.id} className="flex items-center gap-2.5 text-sm">
                    <div className="w-5 h-5 rounded-full border border-[color:var(--rep-border-strong)] shrink-0" />
                    <span className="text-[color:var(--rep-fg-muted)]">{lang === "es" ? task.titleEs : task.title}</span>
                    {task.dueDate && <span className="text-[color:var(--rep-fg-faint)] text-xs ml-auto">{task.dueDate}</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Next milestone */}
        {pendingTasks[0] && (
          <section className="bg-konti-olive/10 border border-konti-olive/30 rounded-xl p-6">
            <div className="flex items-start gap-3">
              <TrendingUp className="w-5 h-5 text-konti-olive mt-0.5 shrink-0" />
              <div>
                <p className="text-konti-olive text-xs font-semibold uppercase tracking-widest mb-1">{t("Next Milestone", "Próximo Hito")}</p>
                <p className="text-[color:var(--rep-fg-strong)] font-bold text-lg">{lang === "es" ? pendingTasks[0].titleEs : pendingTasks[0].title}</p>
                {pendingTasks[0].dueDate && (
                  <p className="text-[color:var(--rep-fg-soft)] text-sm mt-1">
                    {t("Due:", "Vence:")} {pendingTasks[0].dueDate} · {pendingTasks[0].assignee}
                  </p>
                )}
              </div>
            </div>
          </section>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-[color:var(--rep-border)] px-12 py-6 flex items-center justify-between mt-12">
        <img src={reportLogo} alt="KONTi" className="h-10 w-auto opacity-70" />
        <p className="text-[color:var(--rep-fg-faint)] text-xs" data-testid="report-template-footer">
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
