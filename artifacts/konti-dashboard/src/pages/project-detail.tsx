import { useState } from "react";
import { useParams, Link } from "wouter";
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
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/app-layout";
import { RequireAuth, useAuth } from "@/hooks/use-auth";
import { useLang } from "@/hooks/use-lang";
import { WeatherBadge } from "@/components/weather-badge";
import {
  MapPin, Calendar, Users, FileText, Upload, Check, Clock, ChevronLeft,
  Wind, Droplets, Thermometer, Eye, EyeOff, ArrowRight, X
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es as dateEs } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

function DocIcon({ type }: { type: string }) {
  const colors: Record<string, string> = {
    pdf: "text-red-600",
    excel: "text-emerald-600",
    pptx: "text-orange-600",
    photo: "text-sky-600",
  };
  return (
    <div className={`w-8 h-8 rounded flex items-center justify-center bg-muted ${colors[type] ?? "text-muted-foreground"}`}>
      <FileText className="w-4 h-4" />
    </div>
  );
}

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

function ProjectDetailContent({ projectId }: { projectId: string }) {
  const { t, lang } = useLang();
  const { viewRole, setViewRole, user } = useAuth();
  const [showUpload, setShowUpload] = useState(false);

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
    { key: "pre_design", label: t("Pre-Design", "Pre-Diseño"), num: 2 },
    { key: "design", label: t("Design", "Diseño"), num: 3 },
    { key: "permits", label: t("Permits", "Permisos"), num: 4 },
    { key: "construction", label: t("Construction", "Construcción"), num: 5 },
    { key: "completed", label: t("Completed", "Completado"), num: 6 },
  ];

  const catColors: Record<string, string> = {
    client_review: "bg-sky-100 text-sky-800",
    internal: "bg-purple-100 text-purple-800",
    permits: "bg-amber-100 text-amber-800",
    construction: "bg-orange-100 text-orange-800",
    design: "bg-indigo-100 text-indigo-800",
  };

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
            <div className="space-y-2">
              {docs.map((doc) => (
                <div key={doc.id} data-testid={`doc-${doc.id}`} className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-muted/30 transition-colors">
                  <DocIcon type={doc.type} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{doc.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${catColors[doc.category] ?? "bg-gray-100 text-gray-700"}`}>
                        {doc.category === "client_review" ? t("Client", "Cliente") : doc.category}
                      </span>
                      <span className="text-xs text-muted-foreground">{doc.fileSize}</span>
                    </div>
                  </div>
                </div>
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
