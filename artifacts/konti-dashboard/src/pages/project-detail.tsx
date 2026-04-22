import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import {
  useGetProject,
  useGetProjectTasks,
  useGetProjectWeather,
  useGetProjectDocuments,
  useGetProjectCalculations,
  getGetProjectQueryKey,
  getGetProjectTasksQueryKey,
  getGetProjectWeatherQueryKey,
  getGetProjectDocumentsQueryKey,
  getGetProjectCalculationsQueryKey,
  type Document,
  type WeatherHistoryEntry,
} from "@workspace/api-client-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LabelList,
} from "recharts";
import { AppLayout } from "@/components/layout/app-layout";
import { RequireAuth, useAuth } from "@/hooks/use-auth";
import { useLang } from "@/hooks/use-lang";
import { WeatherBadge } from "@/components/weather-badge";
import { PreDesignPanel } from "@/components/pre-design-panel";
import { DesignPanel } from "@/components/design-panel";
import { ProposalsPanel } from "@/components/proposals-panel";
import { ChangeOrdersPanel } from "@/components/change-orders-panel";
import PermitsPanel from "@/components/permits-panel";
import {
  MapPin, Users, FileText, Upload, Check, Clock, ChevronLeft,
  Wind, Droplets, Thermometer, Eye, EyeOff, ArrowRight, X,
  ChevronDown, ChevronUp, BarChart2, History,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function UploadModal({ onClose, projectId }: { onClose: () => void; projectId: string }) {
  const { t } = useLang();
  const { toast } = useToast();
  const [category, setCategory] = useState<"client_review" | "internal">("client_review");
  const [dragOver, setDragOver] = useState(false);

  const handleSimulateUpload = () => {
    toast({
      title: t("File uploaded successfully", "Archivo subido exitosamente"),
      description: category === "client_review"
        ? t("Email notification sent to client.", "Notificación enviada al cliente por correo.")
        : t("File saved to internal documents.", "Archivo guardado en documentos internos."),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" data-testid="upload-modal">
      <div className="bg-card rounded-xl border border-card-border shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold">{t("Upload Document", "Subir Documento")}</h2>
          <button onClick={onClose} data-testid="btn-close-upload"><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">{t("Category", "Categoría")}</label>
            <div className="flex gap-2">
              {(["client_review", "internal"] as const).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  data-testid={`btn-category-${cat}`}
                  className={`flex-1 py-2 px-3 rounded-md text-sm font-medium border transition-colors ${
                    category === cat
                      ? "bg-konti-olive text-white border-konti-olive"
                      : "border-border text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  {cat === "client_review" ? t("Client Review", "Revisión del Cliente") : t("Internal", "Interno")}
                </button>
              ))}
            </div>
          </div>

          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); handleSimulateUpload(); }}
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
              dragOver ? "border-konti-olive bg-konti-olive/5" : "border-border"
            }`}
          >
            <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm font-medium text-foreground">{t("Drop files here or click to browse", "Suelta archivos aquí o haz clic para navegar")}</p>
            <p className="text-xs text-muted-foreground mt-1">PDF, Excel, PPTX, JPG, PNG</p>
          </div>

          {category === "client_review" && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              {t("Client will receive an email notification when files are added to Client Review.", "El cliente recibirá una notificación por correo al agregar archivos a Revisión del Cliente.")}
            </p>
          )}

          <button
            onClick={handleSimulateUpload}
            data-testid="btn-simulate-upload"
            className="w-full py-2.5 bg-konti-olive hover:bg-konti-olive/90 text-white text-sm font-semibold rounded-md transition-colors"
          >
            {t("Simulate Upload", "Simular Subida")}
          </button>
        </div>
      </div>
    </div>
  );
}

function EmojiDayTick({ x, y, payload, chartData }: { x?: number; y?: number; payload?: { value: string }; chartData: Array<{ day: string; emoji: string }> }) {
  const entry = chartData.find((d) => d.day === payload?.value);
  return (
    <g transform={`translate(${x ?? 0},${y ?? 0})`}>
      <text x={0} y={0} dy={14} textAnchor="middle" fontSize={10} fill="currentColor" className="fill-muted-foreground">{payload?.value}</text>
      <text x={0} y={0} dy={30} textAnchor="middle" fontSize={13}>{entry?.emoji ?? ""}</text>
    </g>
  );
}

function WeatherHistoryChart({ history }: { history: WeatherHistoryEntry[] }) {
  const { t, lang } = useLang();
  const [visible, setVisible] = useState(false);

  const data = history.map((h) => ({
    day: lang === "es" ? h.dayLabelEs : h.dayLabel,
    emoji: h.emoji,
    tempHigh: h.tempHigh,
    tempLow: h.tempLow,
    precip: h.precipMm,
  }));

  return (
    <div className="mt-4 border-t border-border pt-4">
      <button
        onClick={() => setVisible((v) => !v)}
        className="flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors w-full"
        data-testid="btn-toggle-weather-chart"
      >
        <BarChart2 className="w-3.5 h-3.5" />
        {t("7-Day Weather History", "Historial Climático (7 Días)")}
        {visible ? <ChevronUp className="w-3.5 h-3.5 ml-auto" /> : <ChevronDown className="w-3.5 h-3.5 ml-auto" />}
      </button>

      {visible && (
        <div className="mt-3" data-testid="weather-history-chart">
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={data} margin={{ top: 8, right: 16, left: -8, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="day"
                tick={(props) => <EmojiDayTick {...props} chartData={data} />}
                axisLine={false}
                tickLine={false}
                height={48}
              />
              <YAxis
                yAxisId="temp"
                orientation="left"
                domain={[60, 100]}
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${v}°`}
              />
              <YAxis
                yAxisId="precip"
                orientation="right"
                domain={[0, 40]}
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${v}mm`}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                formatter={(value, name) => {
                  if (name === "precip") return [`${value}mm`, t("Precipitation", "Precipitación")];
                  if (name === "tempHigh") return [`${value}°F`, t("High Temp", "Temp. Máx.")];
                  if (name === "tempLow") return [`${value}°F`, t("Low Temp", "Temp. Mín.")];
                  return [value, name];
                }}
              />
              <Bar
                yAxisId="precip"
                dataKey="precip"
                fill="#3B82F6"
                opacity={0.7}
                radius={[3, 3, 0, 0]}
                maxBarSize={24}
                name="precip"
              >
                <LabelList
                  dataKey="emoji"
                  position="top"
                  content={(props) => {
                    const { x, y, width, value } = props;
                    if (!value) return null;
                    return (
                      <text
                        x={Number(x ?? 0) + Number(width ?? 0) / 2}
                        y={Number(y ?? 0) - 4}
                        textAnchor="middle"
                        fontSize={13}
                        data-testid="weather-emoji-label"
                      >
                        {String(value)}
                      </text>
                    );
                  }}
                />
              </Bar>
              <Line yAxisId="temp" type="monotone" dataKey="tempHigh" stroke="#F97316" strokeWidth={2} dot={{ r: 3, fill: "#F97316" }} name="tempHigh" />
              <Line yAxisId="temp" type="monotone" dataKey="tempLow" stroke="#94A3B8" strokeWidth={1.5} strokeDasharray="4 2" dot={false} name="tempLow" />
            </ComposedChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-1 justify-center">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="w-3 h-0.5 bg-orange-400 inline-block rounded" /> {t("High", "Máx.")}</span>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="w-3 h-0.5 bg-slate-400 inline-block rounded" style={{ borderTop: "2px dashed #94A3B8", background: "none" }} /> {t("Low", "Mín.")}</span>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="w-3 h-3 rounded-sm bg-blue-400 opacity-70 inline-block" /> {t("Precip.", "Precip.")}</span>
          </div>
        </div>
      )}
    </div>
  );
}

const TYPE_ICON_CONFIG: Record<string, { color: string; bg: string; border: string; label: string }> = {
  pdf:   { color: "text-red-600",     bg: "bg-red-50",     border: "border-red-200",     label: "PDF" },
  excel: { color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200", label: "XLSX" },
  pptx:  { color: "text-orange-600",  bg: "bg-orange-50",  border: "border-orange-200",  label: "PPTX" },
  photo: { color: "text-sky-600",     bg: "bg-sky-50",     border: "border-sky-200",     label: "IMG" },
};

function DocPreviewModal({ doc, onClose }: { doc: Document; onClose: () => void }) {
  const { t, lang } = useLang();
  const catColors: Record<string, string> = {
    client_review: "bg-sky-100 text-sky-800",
    internal: "bg-purple-100 text-purple-800",
    permits: "bg-amber-100 text-amber-800",
    construction: "bg-orange-100 text-orange-800",
    design: "bg-indigo-100 text-indigo-800",
  };
  const versions = doc.versions ?? [];
  const typeIcon = TYPE_ICON_CONFIG[doc.type] ?? { color: "text-muted-foreground", bg: "bg-muted", border: "border-border", label: "FILE" };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" data-testid="doc-preview-modal">
      <div className="bg-card rounded-xl border border-card-border shadow-xl w-full max-w-lg flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <FileText className="w-5 h-5 text-konti-olive shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground truncate">{doc.name}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${catColors[doc.category] ?? "bg-gray-100 text-gray-700"}`}>
                  {doc.category === "client_review" ? t("Client", "Cliente") : doc.category}
                </span>
                {versions.length > 1 && (
                  <span className="text-xs bg-konti-olive/10 text-konti-olive border border-konti-olive/30 px-1.5 py-0.5 rounded font-medium">
                    v{versions.length}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">{doc.fileSize}</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} data-testid="btn-close-doc-preview" className="text-muted-foreground hover:text-foreground ml-3 shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-5">
          {doc.previewable ? (
            <div className={`rounded-xl border-2 border-dashed ${typeIcon.border} ${typeIcon.bg} flex flex-col items-center justify-center h-44 gap-3`}>
              <div className={`w-16 h-16 rounded-2xl ${typeIcon.bg} border ${typeIcon.border} flex items-center justify-center`}>
                <FileText className={`w-9 h-9 ${typeIcon.color}`} />
              </div>
              <div className="text-center">
                <p className={`text-sm font-bold ${typeIcon.color}`}>{typeIcon.label} {t("Document", "Documento")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t("Full preview available in production.", "Vista completa disponible en producción.")}</p>
              </div>
            </div>
          ) : (
            <div className={`rounded-xl border-2 border-dashed ${typeIcon.border} ${typeIcon.bg} flex flex-col items-center justify-center h-36 gap-3`}>
              <div className={`w-14 h-14 rounded-2xl ${typeIcon.bg} border ${typeIcon.border} flex items-center justify-center`}>
                <FileText className={`w-8 h-8 ${typeIcon.color}`} />
              </div>
              <p className="text-xs text-muted-foreground">{typeIcon.label} — {t("Preview not available for this file type.", "Vista previa no disponible para este tipo de archivo.")}</p>
            </div>
          )}

          {doc.description && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">{t("Description", "Descripción")}</p>
              <p className="text-sm text-foreground">{doc.description}</p>
            </div>
          )}

          {versions.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <History className="w-3.5 h-3.5 text-muted-foreground" />
                <p className="text-xs font-semibold text-muted-foreground">{t("Version History", "Historial de Versiones")}</p>
              </div>
              <div className="space-y-2">
                {[...versions].reverse().map((v) => {
                  const isLatest = v.version === versions.length;
                  return (
                    <div key={v.version} className={`rounded-lg border p-3 text-xs ${isLatest ? "border-konti-olive/30 bg-konti-olive/5" : "border-border bg-muted/20"}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`font-bold ${isLatest ? "text-konti-olive" : "text-muted-foreground"}`}>
                          v{v.version} {isLatest && <span className="text-xs font-normal ml-1 opacity-70">{t("current", "actual")}</span>}
                        </span>
                        <span className="text-muted-foreground">{new Date(v.uploadedAt).toLocaleDateString(lang === "es" ? "es-PR" : "en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                      </div>
                      <div className="flex items-center justify-between text-muted-foreground mb-1.5">
                        <span>{v.uploadedBy}</span>
                        <span>{v.fileSize}</span>
                      </div>
                      {(lang === "es" ? v.notesEs : v.notes) && (
                        <p className="text-muted-foreground leading-relaxed">{lang === "es" ? v.notesEs : v.notes}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ChangeOrderDelta({ projectId }: { projectId: string }) {
  const { t } = useLang();
  const [totals, setTotals] = useState<{ approvedDelta: number; pendingDelta: number; approvedDays: number } | null>(null);
  useEffect(() => {
    let alive = true;
    customFetch<{ totals: { approvedDelta: number; pendingDelta: number; approvedDays: number } }>(`/api/projects/${projectId}/change-orders`)
      .then((d) => { if (alive) setTotals(d.totals); })
      .catch(() => {});
    return () => { alive = false; };
  }, [projectId]);
  if (!totals) return null;
  const { approvedDelta, pendingDelta } = totals;
  if (approvedDelta === 0 && pendingDelta === 0) return null;
  return (
    <div data-testid="budget-co-delta" className="mt-3 pt-3 border-t border-border space-y-1">
      {approvedDelta !== 0 && (
        <p className="text-xs flex items-center justify-between">
          <span className="text-muted-foreground">{t("Approved Change Orders", "Órdenes de Cambio Aprobadas")}</span>
          <span className={`font-semibold ${approvedDelta >= 0 ? "text-amber-700" : "text-emerald-700"}`}>
            {approvedDelta >= 0 ? "+" : "−"}${Math.abs(approvedDelta).toLocaleString()}
          </span>
        </p>
      )}
      {pendingDelta !== 0 && (
        <p className="text-xs flex items-center justify-between">
          <span className="text-muted-foreground">{t("Pending Change Orders", "Órdenes Pendientes")}</span>
          <span className="font-semibold text-amber-600">
            {pendingDelta >= 0 ? "+" : "−"}${Math.abs(pendingDelta).toLocaleString()}
          </span>
        </p>
      )}
    </div>
  );
}

function DocCard({ doc, isClientView }: { doc: Document; isClientView: boolean }) {
  const { t, lang } = useLang();
  const [showVersions, setShowVersions] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const catColors: Record<string, string> = {
    client_review: "bg-sky-100 text-sky-800",
    internal: "bg-purple-100 text-purple-800",
    permits: "bg-amber-100 text-amber-800",
    construction: "bg-orange-100 text-orange-800",
    design: "bg-indigo-100 text-indigo-800",
  };

  const subPhaseLabels: Record<string, { en: string; es: string }> = {
    schematic_design: { en: "SD", es: "DE" },
    design_development: { en: "DD", es: "DD" },
    construction_documents: { en: "CD", es: "DC" },
  };
  const subPhase = (doc as Document & { designSubPhase?: string }).designSubPhase;
  const subBadge = subPhase ? subPhaseLabels[subPhase] : null;

  const typeColors: Record<string, string> = {
    pdf: "text-red-600 bg-red-50",
    excel: "text-emerald-600 bg-emerald-50",
    pptx: "text-orange-600 bg-orange-50",
    photo: "text-sky-600 bg-sky-50",
  };

  const versions = doc.versions ?? [];
  const hasVersions = versions.length > 1;

  return (
    <>
      <div data-testid={`doc-${doc.id}`} className="rounded-lg border border-border hover:border-konti-olive/30 hover:bg-muted/20 transition-colors">
        <div className="flex items-start gap-2.5 p-2.5">
          <div
            role="button"
            tabIndex={0}
            className="flex-1 flex items-start gap-2.5 cursor-pointer min-w-0"
            onClick={() => setShowPreview(true)}
            onKeyDown={(e) => e.key === "Enter" && setShowPreview(true)}
            data-testid={`btn-preview-doc-${doc.id}`}
          >
            <div className={`w-8 h-8 rounded flex items-center justify-center shrink-0 ${typeColors[doc.type] ?? "bg-muted text-muted-foreground"}`}>
              <FileText className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground truncate">{doc.name}</p>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${catColors[doc.category] ?? "bg-gray-100 text-gray-700"}`}>
                  {doc.category === "client_review" ? t("Client", "Cliente") : doc.category}
                </span>
                {subBadge && (
                  <span data-testid={`doc-sub-phase-${doc.id}`} className="text-xs px-1.5 py-0.5 rounded font-semibold bg-konti-olive/15 text-konti-olive border border-konti-olive/30">
                    {lang === "es" ? subBadge.es : subBadge.en}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">{doc.fileSize}</span>
                {hasVersions && (
                  <span className="text-xs bg-konti-olive/10 text-konti-olive border border-konti-olive/30 px-1.5 py-0.5 rounded font-semibold">
                    v{versions.length}
                  </span>
                )}
              </div>
            </div>
          </div>
          {hasVersions && (
            <button
              onClick={() => setShowVersions((v) => !v)}
              className="p-1 text-muted-foreground hover:text-foreground transition-colors shrink-0 mt-0.5"
              data-testid={`btn-toggle-versions-${doc.id}`}
              aria-label={showVersions ? t("Hide version history", "Ocultar historial") : t("Show version history", "Ver historial")}
            >
              {showVersions ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>

        {showVersions && (
          <div className="border-t border-border px-3 pb-2.5 pt-2 space-y-2" data-testid={`version-history-${doc.id}`}>
            <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 mb-2">
              <History className="w-3 h-3" /> {t("Version History", "Historial de Versiones")}
            </p>
            {[...versions].reverse().map((v) => {
              const isLatest = v.version === versions.length;
              return (
                <div key={v.version} className="flex items-start justify-between gap-2 text-xs">
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className={`font-bold shrink-0 ${isLatest ? "text-konti-olive" : "text-muted-foreground"}`}>v{v.version}</span>
                      <span className="text-muted-foreground font-medium truncate">{v.uploadedBy}</span>
                    </div>
                    {(lang === "es" ? v.notesEs : v.notes) && (
                      <p className="text-muted-foreground/80 truncate">{lang === "es" ? v.notesEs : v.notes}</p>
                    )}
                  </div>
                  <span className="text-muted-foreground whitespace-nowrap shrink-0 text-right">
                    {new Date(v.uploadedAt).toLocaleDateString(lang === "es" ? "es-PR" : "en-US", { month: "short", day: "numeric" })}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showPreview && <DocPreviewModal doc={doc} onClose={() => setShowPreview(false)} />}
    </>
  );
}

function ProjectDetailContent({ projectId }: { projectId: string }) {
  const { t, lang } = useLang();
  const { viewRole, setViewRole, user } = useAuth();
  const [showUpload, setShowUpload] = useState(false);

  const queryClient = useQueryClient();
  const onProjectUpdated = () => {
    queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
  };
  const { data: project, isLoading: projectLoading } = useGetProject(projectId, {
    query: { enabled: !!projectId, queryKey: getGetProjectQueryKey(projectId) }
  });
  const { data: tasks = [] } = useGetProjectTasks(projectId, {
    query: { enabled: !!projectId, queryKey: getGetProjectTasksQueryKey(projectId) }
  });
  const { data: weather } = useGetProjectWeather(projectId, {
    query: { enabled: !!projectId, queryKey: getGetProjectWeatherQueryKey(projectId) }
  });
  const { data: allDocs = [] } = useGetProjectDocuments(projectId, undefined, {
    query: { enabled: !!projectId, queryKey: getGetProjectDocumentsQueryKey(projectId, undefined) }
  });
  const { data: calc } = useGetProjectCalculations(projectId, {
    query: { enabled: !!projectId, queryKey: getGetProjectCalculationsQueryKey(projectId) }
  });

  const isClientView = viewRole === "client";
  const docs = isClientView ? allDocs.filter((d) => d.isClientVisible) : allDocs;

  if (projectLoading || !project) {
    return <div className="h-96 bg-card rounded-xl border animate-pulse" />;
  }

  const spendPct = Math.round((project.budgetUsed / project.budgetAllocated) * 100);
  const phaseLabel = lang === "es" ? project.phaseLabelEs : project.phaseLabel;

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

  const priorityColors: Record<string, string> = {
    high: "text-red-600 bg-red-50 border border-red-200",
    medium: "text-amber-700 bg-amber-50 border border-amber-200",
    low: "text-slate-600 bg-slate-50 border border-slate-200",
  };

  return (
    <div className="space-y-6" data-testid="project-detail-page">
      {/* Header */}
      <div>
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
          <ChevronLeft className="w-4 h-4" /> {t("Back to Dashboard", "Volver al Panel")}
        </Link>

        <div className="relative rounded-xl overflow-hidden h-56">
          {project.coverImage && (
            <img src={project.coverImage} alt={project.name} className="w-full h-full object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-konti-dark/90 to-konti-dark/20" />
          <div className="absolute bottom-4 left-6 right-6">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-white/70 text-sm mb-1">{project.clientName}</p>
                <h1 className="text-white text-2xl font-bold">{project.name}</h1>
                <p className="text-white/60 text-sm flex items-center gap-1 mt-1">
                  <MapPin className="w-3.5 h-3.5" /> {project.location}
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-konti-olive text-white">
                  {phaseLabel}
                </span>
                <Link
                  href={`/projects/${projectId}/report`}
                  className="text-xs flex items-center gap-1 text-white/70 hover:text-white transition-colors"
                  data-testid="link-view-report"
                >
                  {t("View Report", "Ver Reporte")} <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* View toggle (team members only) */}
      {user?.role !== "client" && (
        <div className="flex items-center gap-2 p-1 bg-muted rounded-lg w-fit" data-testid="view-role-toggle">
          <button
            onClick={() => setViewRole("team")}
            data-testid="btn-team-view"
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${!isClientView ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
          >
            <Eye className="inline w-3.5 h-3.5 mr-1.5" />{t("Team View", "Vista Interna")}
          </button>
          <button
            onClick={() => setViewRole("client")}
            data-testid="btn-client-view"
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${isClientView ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
          >
            <EyeOff className="inline w-3.5 h-3.5 mr-1.5" />{t("Client View", "Vista del Cliente")}
          </button>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="md:col-span-2 space-y-6">
          {/* Phase timeline */}
          <div className="bg-card rounded-xl border border-card-border p-5 shadow-sm">
            <h2 className="font-bold text-foreground mb-4">{t("Project Phase", "Fase del Proyecto")}</h2>
            <div className="flex items-center gap-1">
              {phases.map((phase, i) => {
                const isCompleted = project.phaseNumber > phase.num;
                const isCurrent = project.phaseNumber === phase.num;
                return (
                  <div key={phase.key} className="flex-1 flex flex-col items-center gap-1">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                      isCompleted ? "bg-konti-olive text-white" :
                      isCurrent ? "bg-konti-olive/20 border-2 border-konti-olive text-konti-olive" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {isCompleted ? <Check className="w-3.5 h-3.5" /> : phase.num}
                    </div>
                    {i < phases.length - 1 && (
                      <div className={`h-0.5 w-full ${isCompleted ? "bg-konti-olive" : "bg-border"}`} />
                    )}
                    <span className="text-xs text-muted-foreground text-center leading-tight hidden md:block">{phase.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pre-Design & Viability Panel */}
          <PreDesignPanel projectId={projectId} isClientView={isClientView} currentPhase={project.phase} />

          {/* Proposals (Pre-Design → onward) */}
          <ProposalsPanel projectId={projectId} isClientView={isClientView} currentPhase={project.phase} />

          {/* Design sub-phases (Design phase onward) */}
          <DesignPanel projectId={projectId} isClientView={isClientView} currentPhase={project.phase} />

          {/* Change Orders (Design phase onward, or anytime there are existing COs) */}
          <ChangeOrdersPanel projectId={projectId} isClientView={isClientView} currentPhase={project.phase} />

          {/* Phase 4 — Permits authorization workflow */}
          <PermitsPanel projectId={projectId} projectPhase={project.phase} onProjectUpdated={onProjectUpdated} />

          {/* Weather widget */}
          {weather && (
            <div className="bg-card rounded-xl border border-card-border p-5 shadow-sm">
              <h2 className="font-bold text-foreground mb-4">{t("Site Conditions", "Condiciones del Sitio")} — {weather.city}</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground flex items-center gap-1"><Thermometer className="w-3 h-3" />{t("Temperature", "Temperatura")}</span>
                  <span className="text-xl font-bold">{weather.temperature}{weather.temperatureUnit}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">{t("Condition", "Condición")}</span>
                  <span className="text-sm font-medium">{lang === "es" ? weather.conditionEs : weather.condition}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground flex items-center gap-1"><Droplets className="w-3 h-3" />{t("Humidity", "Humedad")}</span>
                  <span className="text-xl font-bold">{weather.humidity}%</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground flex items-center gap-1"><Wind className="w-3 h-3" />{t("Wind", "Viento")}</span>
                  <span className="text-xl font-bold">{weather.windSpeed} {weather.windUnit}</span>
                </div>
              </div>

              <div className={`rounded-lg p-3 ${
                weather.buildSuitability === "green" ? "bg-emerald-50 border border-emerald-200" :
                weather.buildSuitability === "yellow" ? "bg-amber-50 border border-amber-200" :
                "bg-red-50 border border-red-200"
              }`}>
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-3 h-3 rounded-full ${
                    weather.buildSuitability === "green" ? "bg-emerald-500" :
                    weather.buildSuitability === "yellow" ? "bg-amber-500" : "bg-red-500"
                  }`} />
                  <span className="font-bold text-sm" data-testid="build-status-label">
                    {t("Build Status", "Estado de Obra")}: {lang === "es" ? weather.buildSuitabilityLabelEs : weather.buildSuitabilityLabel}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {lang === "es" ? weather.buildSuitabilityReasonEs : weather.buildSuitabilityReason}
                </p>
              </div>

              {weather.weatherHistory && weather.weatherHistory.length > 0 && (
                <WeatherHistoryChart history={weather.weatherHistory} />
              )}
            </div>
          )}

          {/* Tasks */}
          <div className="bg-card rounded-xl border border-card-border p-5 shadow-sm">
            <h2 className="font-bold text-foreground mb-4">{t("Tasks", "Tareas")}</h2>
            <div className="space-y-2">
              {tasks.map((task) => {
                const title = lang === "es" ? task.titleEs : task.title;
                return (
                  <div key={task.id} data-testid={`task-${task.id}`} className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/30 transition-colors">
                    <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      task.completed ? "bg-konti-olive border-konti-olive" : "border-border"
                    }`}>
                      {task.completed && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${task.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
                        {title}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        {task.assignee && (
                          <span className="text-xs text-muted-foreground">{task.assignee}</span>
                        )}
                        {task.dueDate && (
                          <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                            <Clock className="w-3 h-3" /> {task.dueDate}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${priorityColors[task.priority]}`}>
                      {task.priority}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Budget */}
          <div className="bg-card rounded-xl border border-card-border p-5 shadow-sm">
            <h2 className="font-bold text-foreground mb-3">{t("Budget", "Presupuesto")}</h2>
            {isClientView ? (
              <>
                <div className="text-3xl font-bold text-foreground mb-1">{spendPct}%</div>
                <p className="text-xs text-muted-foreground mb-3">{t("of budget used", "del presupuesto utilizado")}</p>
              </>
            ) : (
              <>
                <div className="text-3xl font-bold text-foreground mb-1">${project.budgetUsed.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mb-3">{t("of", "de")} ${project.budgetAllocated.toLocaleString()} {t("allocated", "asignado")}</p>
              </>
            )}
            <div className="h-2 rounded-full bg-muted overflow-hidden mb-1">
              <div className={`h-full rounded-full ${spendPct > 90 ? "bg-red-500" : spendPct > 70 ? "bg-amber-500" : "bg-konti-olive"}`} style={{ width: `${Math.min(spendPct, 100)}%` }} />
            </div>
            <p className="text-xs text-muted-foreground">{spendPct}% {t("used", "utilizado")}</p>
            <ChangeOrderDelta projectId={projectId} />
          </div>

          {/* Team */}
          {!isClientView && project.teamMembers && (
            <div className="bg-card rounded-xl border border-card-border p-5 shadow-sm">
              <h2 className="font-bold text-foreground mb-3 flex items-center gap-1.5">
                <Users className="w-4 h-4" /> {t("Team", "Equipo")}
              </h2>
              <div className="space-y-2">
                {project.teamMembers.map((member) => (
                  <div key={member} className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-konti-olive/20 text-konti-olive flex items-center justify-center text-xs font-bold shrink-0">
                      {member.split(" ").map(w => w[0]).slice(0,2).join("")}
                    </div>
                    <span className="text-sm text-foreground">{member}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Material Cost Summary */}
          {calc && (
            <div className="bg-card rounded-xl border border-card-border p-5 shadow-sm" data-testid="material-cost-summary">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-foreground">{t("Material Costs", "Costos de Materiales")}</h2>
                <Link
                  href="/calculator"
                  className="text-xs text-konti-olive hover:text-konti-olive/80 font-medium transition-colors"
                >
                  {t("Full Calculator", "Calculadora Completa")} →
                </Link>
              </div>
              <div className="space-y-1.5">
                {Object.entries(calc.subtotalByCategory ?? {}).map(([cat, total]) => (
                  <div key={cat} className="flex items-center justify-between text-xs">
                    <span className="capitalize text-muted-foreground">{cat}</span>
                    <span className="font-semibold text-foreground">${(total as number).toLocaleString()}</span>
                  </div>
                ))}
                <div className="border-t border-border pt-1.5 mt-1.5 flex items-center justify-between">
                  <span className="text-sm font-bold text-foreground">{t("Grand Total", "Total General")}</span>
                  <span className="text-sm font-bold text-konti-olive">${calc.grandTotal.toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}

          {/* Documents */}
          <div className="bg-card rounded-xl border border-card-border p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-foreground">{t("Documents", "Documentos")}</h2>
              {!isClientView && (
                <button
                  onClick={() => setShowUpload(true)}
                  data-testid="btn-upload-document"
                  className="flex items-center gap-1 text-xs text-konti-olive hover:text-konti-olive/80 font-medium transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" /> {t("Upload", "Subir")}
                </button>
              )}
            </div>
            <div className="space-y-1.5">
              {docs.map((doc) => (
                <DocCard key={doc.id} doc={doc} isClientView={isClientView} />
              ))}
              {docs.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">{t("No documents available.", "No hay documentos disponibles.")}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {showUpload && <UploadModal onClose={() => setShowUpload(false)} projectId={projectId} />}
    </div>
  );
}

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();

  return (
    <RequireAuth>
      <AppLayout>
        <ProjectDetailContent projectId={params.id} />
      </AppLayout>
    </RequireAuth>
  );
}
