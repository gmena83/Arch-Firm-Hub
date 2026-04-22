import { useEffect, useState } from "react";
import { useLang } from "@/hooks/use-lang";
import { useListProjects } from "@workspace/api-client-react";
import { TrendingUp, TrendingDown, Minus, BarChart3 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from "recharts";
import { getJson, type VarianceReport } from "./estimating-helpers";

export function VarianceReportPanel({
  defaultProjectId,
  showProjectPicker = true,
  compact = false,
}: {
  defaultProjectId?: string;
  showProjectPicker?: boolean;
  compact?: boolean;
}) {
  const { t, lang } = useLang();
  const { data: projects = [] } = useListProjects();
  const [projectId, setProjectId] = useState<string>(defaultProjectId ?? "");
  const [report, setReport] = useState<VarianceReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (defaultProjectId) setProjectId(defaultProjectId);
  }, [defaultProjectId]);
  useEffect(() => {
    if (!projectId && projects[0]) setProjectId(projects[0].id);
  }, [projects, projectId]);

  useEffect(() => {
    if (!projectId) return;
    let cancel = false;
    setLoading(true);
    setError(null);
    getJson<VarianceReport>(`/api/projects/${projectId}/variance-report`)
      .then((d) => { if (!cancel) setReport(d); })
      .catch((e) => { if (!cancel) setError(e instanceof Error ? e.message : "error"); })
      .finally(() => { if (!cancel) setLoading(false); });
    return () => { cancel = true; };
  }, [projectId]);

  return (
    <div className="space-y-4" data-testid="variance-report-panel">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-konti-olive" />
          <h2 className="font-bold text-foreground">{t("Estimated vs Actual", "Estimado vs Real")}</h2>
        </div>
        {showProjectPicker && (
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            data-testid="variance-project"
            className="px-3 py-2 rounded-md border border-input bg-card text-sm"
          >
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
      </div>

      {loading && <p className="text-sm text-muted-foreground">{t("Loading variance report...", "Cargando reporte de varianza...")}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {report && (
        <>
          <p className="text-xs text-muted-foreground">
            {t("Source:", "Fuente:")} {report.estimateSource === "contractor_estimate" ? t("Contractor estimate", "Estimado de contratista") : t("Calculator entries", "Entradas de calculadora")}
          </p>

          <div className={`grid gap-3 ${compact ? "grid-cols-1" : "grid-cols-1 md:grid-cols-3"}`}>
            {report.buckets.map((b) => (
              <div key={b.key} className="bg-card rounded-xl border border-card-border p-4 shadow-sm" data-testid={`variance-bucket-${b.key}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">{lang === "es" ? b.labelEs : b.labelEn}</p>
                  <StatusPill status={b.status} />
                </div>
                <div className="flex items-baseline justify-between text-xs">
                  <span className="text-muted-foreground">{t("Estimated", "Estimado")}</span>
                  <span className="font-semibold text-foreground">${b.estimated.toLocaleString()}</span>
                </div>
                <div className="flex items-baseline justify-between text-xs mt-1">
                  <span className="text-muted-foreground">{t("Actual", "Real")}</span>
                  <span className="font-semibold text-foreground">${b.actual.toLocaleString()}</span>
                </div>
                <div className="flex items-baseline justify-between text-sm border-t border-border pt-1.5 mt-1.5">
                  <span className="text-muted-foreground">{t("Variance", "Varianza")}</span>
                  <span className={`font-bold ${b.variance > 0 ? "text-destructive" : "text-konti-olive"} flex items-center gap-1`}>
                    {b.variance > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : b.variance < 0 ? <TrendingDown className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
                    {b.variance >= 0 ? "+" : ""}${b.variance.toLocaleString()} ({b.variancePercent >= 0 ? "+" : ""}{b.variancePercent}%)
                  </span>
                </div>
              </div>
            ))}
          </div>

          {!compact && (
            <div className="bg-card rounded-xl border border-card-border p-5 shadow-sm">
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">{t("Top-line comparison", "Comparación general")}</p>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={report.buckets.map((b) => ({ name: lang === "es" ? b.labelEs : b.labelEn, Estimated: b.estimated, Actual: b.actual }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                    <Legend />
                    <Bar dataKey="Estimated" fill="#94a3b8" />
                    <Bar dataKey="Actual" fill="#7a8450" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {!compact && report.materialCategories.length > 0 && (
            <div className="bg-card rounded-xl border border-card-border p-5 shadow-sm">
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">{t("Materials by category", "Materiales por categoría")}</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[480px]">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="text-left px-3 py-2">{t("Category", "Categoría")}</th>
                      <th className="text-right px-3 py-2">{t("Estimated", "Estimado")}</th>
                      <th className="text-right px-3 py-2">{t("Actual", "Real")}</th>
                      <th className="text-right px-3 py-2">{t("Variance", "Varianza")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {report.materialCategories.map((c) => (
                      <tr key={c.category}>
                        <td className="px-3 py-1.5 capitalize">{c.category}</td>
                        <td className="px-3 py-1.5 text-right">${c.estimated.toLocaleString()}</td>
                        <td className="px-3 py-1.5 text-right">${c.actual.toLocaleString()}</td>
                        <td className={`px-3 py-1.5 text-right font-semibold ${c.variance > 0 ? "text-destructive" : "text-konti-olive"}`}>
                          {c.variance >= 0 ? "+" : ""}${c.variance.toLocaleString()} ({c.variancePercent >= 0 ? "+" : ""}{c.variancePercent}%)
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="bg-konti-dark rounded-xl p-5 flex flex-wrap items-center justify-between gap-3 text-white" data-testid="variance-totals">
            <div>
              <p className="text-xs text-white/50">{t("Total estimated", "Total estimado")}</p>
              <p className="text-xl font-bold">${report.totals.estimated.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-white/50">{t("Total actual", "Total real")}</p>
              <p className="text-xl font-bold">${report.totals.actual.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-white/50">{t("Variance", "Varianza")}</p>
              <p className={`text-xl font-bold ${report.totals.variance > 0 ? "text-red-300" : "text-emerald-300"}`}>
                {report.totals.variance >= 0 ? "+" : ""}${report.totals.variance.toLocaleString()} ({report.totals.variancePercent >= 0 ? "+" : ""}{report.totals.variancePercent}%)
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: "on_track" | "warning" | "over" }) {
  const { t } = useLang();
  const map = {
    on_track: { label: t("On track", "En línea"), cls: "bg-emerald-100 text-emerald-700" },
    warning: { label: t("Watch", "Atención"), cls: "bg-amber-100 text-amber-700" },
    over: { label: t("Over", "Sobre"), cls: "bg-red-100 text-red-700" },
  } as const;
  const m = map[status];
  return <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${m.cls}`}>{m.label}</span>;
}

export default VarianceReportPanel;
