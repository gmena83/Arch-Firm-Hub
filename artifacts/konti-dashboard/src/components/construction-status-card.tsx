import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  useGetProjectInspections,
  useGetProjectMilestones,
  useGetProjectChangeOrders,
  getGetProjectInspectionsQueryKey,
  getGetProjectMilestonesQueryKey,
  getGetProjectChangeOrdersQueryKey,
  customFetch,
} from "@workspace/api-client-react";
import { useLang } from "@/hooks/use-lang";
import { MilestonesTimeline } from "@/components/milestones-timeline";
import { HardHat, ClipboardCheck, FileSpreadsheet, ArrowRight, CheckCircle2, AlertTriangle, RotateCcw, ListChecks } from "lucide-react";

export function ConstructionStatusCard({
  projectId,
  projectName,
  progressPercent,
}: {
  projectId: string;
  projectName: string;
  progressPercent: number;
}) {
  const { t, lang } = useLang();

  const { data: inspectionsData } = useGetProjectInspections(projectId, {
    query: { enabled: !!projectId, queryKey: getGetProjectInspectionsQueryKey(projectId) },
  });
  const { data: milestonesData } = useGetProjectMilestones(projectId, {
    query: { enabled: !!projectId, queryKey: getGetProjectMilestonesQueryKey(projectId) },
  });
  const { data: coData } = useGetProjectChangeOrders(projectId, {
    query: { enabled: !!projectId, queryKey: getGetProjectChangeOrdersQueryKey(projectId) },
  });

  const inspections = inspectionsData?.inspections ?? [];
  const milestones = milestonesData?.milestones ?? [];
  const approvedDelta = coData?.totals?.approvedDelta ?? 0;

  const [punchlist, setPunchlist] = useState<{ openCount: number; doneCount: number; waivedCount: number; totalCount: number } | null>(null);
  useEffect(() => {
    let alive = true;
    customFetch<{ openCount: number; doneCount: number; waivedCount: number; totalCount: number }>(
      `/api/projects/${projectId}/punchlist`,
    )
      .then((d) => { if (alive) setPunchlist({ openCount: d.openCount, doneCount: d.doneCount, waivedCount: d.waivedCount, totalCount: d.totalCount }); })
      .catch(() => {});
    return () => { alive = false; };
  }, [projectId]);

  const currentMilestone = milestones.find((m) => m.status === "in_progress")
    ?? milestones.find((m) => m.status === "upcoming")
    ?? milestones[milestones.length - 1];

  const upcomingInspection = inspections
    .filter((i) => i.status === "scheduled")
    .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))[0];

  const completedInspections = inspections.filter((i) => i.status === "passed" || i.status === "failed" || i.status === "re_inspect");
  const lastInspection = completedInspections
    .sort((a, b) => (b.completedDate ?? "").localeCompare(a.completedDate ?? ""))[0];

  const lastIcon = lastInspection?.status === "passed"
    ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
    : lastInspection?.status === "failed"
      ? <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
      : lastInspection?.status === "re_inspect"
        ? <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
        : null;
  const lastStatusLabel = lastInspection?.status === "passed"
    ? t("Passed", "Aprobada")
    : lastInspection?.status === "failed"
      ? t("Failed", "Fallida")
      : lastInspection?.status === "re_inspect"
        ? t("Re-inspect", "Re-inspección")
        : "";
  const lastStatusColor = lastInspection?.status === "passed"
    ? "text-emerald-700"
    : lastInspection?.status === "failed"
      ? "text-red-700"
      : lastInspection?.status === "re_inspect"
        ? "text-amber-700"
        : "text-muted-foreground";

  return (
    <div data-testid="construction-status-card" className="bg-card rounded-xl border border-card-border shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold text-foreground flex items-center gap-2">
          <HardHat className="w-5 h-5 text-konti-olive" />
          {t("Construction Status", "Estado de Construcción")}
        </h2>
        <Link
          href={`/projects/${projectId}`}
          data-testid="link-construction-detail"
          className="text-xs text-konti-olive hover:underline font-semibold flex items-center gap-1"
        >
          {projectName} <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <div className="bg-muted/40 rounded-lg p-3">
          <p className="text-xs text-muted-foreground mb-1">{t("Complete", "Completo")}</p>
          <p className="text-2xl font-bold text-foreground">{progressPercent}%</p>
        </div>
        <div className="bg-muted/40 rounded-lg p-3">
          <p className="text-xs text-muted-foreground mb-1">{t("Current Milestone", "Hito Actual")}</p>
          <p className="text-sm font-semibold text-foreground truncate" data-testid="status-current-milestone">
            {currentMilestone ? (lang === "es" ? currentMilestone.titleEs : currentMilestone.title) : "—"}
          </p>
        </div>
        <div className="bg-muted/40 rounded-lg p-3">
          <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><ClipboardCheck className="w-3 h-3" />{t("Next Inspection", "Próx. Inspección")}</p>
          <p className="text-sm font-semibold text-foreground truncate" data-testid="status-next-inspection">
            {upcomingInspection ? `${lang === "es" ? upcomingInspection.titleEs : upcomingInspection.title}` : "—"}
          </p>
          {upcomingInspection && <p className="text-xs text-muted-foreground">{upcomingInspection.scheduledDate}</p>}
        </div>
        <div className="bg-muted/40 rounded-lg p-3">
          <p className="text-xs text-muted-foreground mb-1">{t("Last Inspection", "Última Inspección")}</p>
          <p className="text-sm font-semibold text-foreground flex items-center gap-1.5" data-testid="status-last-inspection">
            {lastIcon}
            <span className="truncate">{lastInspection ? (lang === "es" ? lastInspection.titleEs : lastInspection.title) : "—"}</span>
          </p>
          {lastInspection && (
            <p className={`text-xs font-semibold ${lastStatusColor}`} data-testid="status-last-inspection-result">
              {lastStatusLabel}
            </p>
          )}
        </div>
      </div>

      {punchlist && punchlist.totalCount > 0 && (
        <Link
          href={`/projects/${projectId}#punchlist`}
          data-testid="status-punchlist-progress"
          className="mt-4 pt-4 border-t border-border flex items-center justify-between text-xs hover:bg-muted/40 -mx-2 px-2 py-2 rounded-md"
        >
          <span className="text-muted-foreground flex items-center gap-1.5">
            <ListChecks className="w-3.5 h-3.5" />
            {t("Punchlist progress", "Progreso del punchlist")}
          </span>
          <span className={`font-semibold flex items-center gap-1 ${punchlist.openCount > 0 ? "text-amber-700" : "text-emerald-700"}`}>
            {punchlist.doneCount + punchlist.waivedCount} {t("of", "de")} {punchlist.totalCount} {t("complete", "completos")}
            <ArrowRight className="w-3 h-3" />
          </span>
        </Link>
      )}

      <div className="mt-4 pt-4 border-t border-border" data-testid="status-milestones-strip">
        <p className="text-xs font-semibold text-muted-foreground mb-2">{t("Milestone Timeline", "Línea de Hitos")}</p>
        <MilestonesTimeline projectId={projectId} compact />
      </div>

      <Link
        href={`/projects/${projectId}#change-orders`}
        data-testid="status-co-total"
        className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs hover:bg-muted/40 -mx-2 px-2 py-2 rounded-md"
      >
        <span className="text-muted-foreground flex items-center gap-1.5"><FileSpreadsheet className="w-3.5 h-3.5" />{t("Approved Change Orders", "Órdenes de Cambio Aprobadas")}</span>
        <span className={`font-semibold ${approvedDelta > 0 ? "text-amber-700" : approvedDelta < 0 ? "text-emerald-700" : "text-muted-foreground"} flex items-center gap-1`}>
          {approvedDelta > 0 ? "+" : approvedDelta < 0 ? "−" : ""}${Math.abs(approvedDelta).toLocaleString()}
          <ArrowRight className="w-3 h-3" />
        </span>
      </Link>
    </div>
  );
}

export default ConstructionStatusCard;
