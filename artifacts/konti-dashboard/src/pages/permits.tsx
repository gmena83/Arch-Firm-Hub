import { useState, useEffect } from "react";
import { Link } from "wouter";
import { FileCheck, ExternalLink } from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { RequireRole, useAuth } from "@/hooks/use-auth";
import { useLang } from "@/hooks/use-lang";
import { useListProjects } from "@workspace/api-client-react";
import PermitsPanel from "@/components/permits-panel";
import { PermitsDesignSection } from "@/components/permits-design-section";

export default function PermitsPage() {
  const { t, lang } = useLang();
  useAuth();
  const { data: projects = [] } = useListProjects();
  const visible = projects;
  const [projectId, setProjectId] = useState<string>("");
  useEffect(() => {
    if (visible.length === 0) return;
    if (projectId && visible.some((p) => p.id === projectId)) return;
    const next =
      visible.find((p) => p.phase === "permits")?.id ?? visible[0]!.id;
    setProjectId(next);
  }, [visible, projectId]);
  const project = visible.find((p) => p.id === projectId);

  return (
    <RequireRole roles={["architect", "admin", "superadmin", "client"]}>
      <AppLayout>
        <div className="max-w-6xl mx-auto p-6 space-y-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                <FileCheck className="w-6 h-6 text-emerald-700" />
                {t("Permits", "Permisos")}
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                {t(
                  "OGPE submission packet, required signatures, and permit item statuses per project.",
                  "Paquete de sometimiento OGPE, firmas requeridas y estados de permisos por proyecto.",
                )}
              </p>
            </div>
            {visible.length > 0 && (
              <div className="flex items-center gap-3">
                <label className="text-sm text-slate-600">{t("Project", "Proyecto")}:</label>
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="text-sm px-3 py-2 border border-slate-300 rounded-md bg-white focus:ring-2 focus:ring-emerald-500"
                >
                  {visible.map((p) => (
                    <option key={p.id} value={p.id}>
                      {lang === "es" ? p.nameEs ?? p.name : p.name} — {lang === "es" ? p.phaseLabelEs : p.phaseLabel}
                    </option>
                  ))}
                </select>
                {project && (
                  <Link href={`/projects/${project.id}`} className="text-sm text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1">
                    {t("Open project", "Abrir proyecto")} <ExternalLink className="w-3 h-3" />
                  </Link>
                )}
              </div>
            )}
          </div>

          {project ? (
            <>
              <PermitsPanel projectId={project.id} projectPhase={project.phase} />
              <PermitsDesignSection projectId={project.id} />
            </>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
              {t("No projects available.", "No hay proyectos disponibles.")}
            </div>
          )}
        </div>
      </AppLayout>
    </RequireRole>
  );
}
