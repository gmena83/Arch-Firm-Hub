import { Link } from "wouter";
import { useListProjects } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/app-layout";
import { RequireAuth, useAuth } from "@/hooks/use-auth";
import { useLang } from "@/hooks/use-lang";
import { ArrowRight, MapPin } from "lucide-react";

export default function ProjectsPage() {
  const { t, lang } = useLang();
  const { user } = useAuth();
  const { data: allProjects = [], isLoading } = useListProjects();

  const isClientUser = user?.role === "client";

  const projects = isClientUser
    ? allProjects.filter((p) => p.clientName.includes(user?.name ?? ""))
    : allProjects;

  const phaseColors: Record<string, string> = {
    discovery: "bg-sky-100 text-sky-800",
    pre_design: "bg-purple-100 text-purple-800",
    design: "bg-indigo-100 text-indigo-800",
    permits: "bg-amber-100 text-amber-800",
    construction: "bg-orange-100 text-orange-800",
    completed: "bg-emerald-100 text-emerald-800",
  };

  return (
    <RequireAuth>
      <AppLayout>
        <div className="space-y-6" data-testid="projects-page">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {isClientUser ? t("My Project", "Mi Proyecto") : t("Projects", "Proyectos")}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {isClientUser
                ? t("Your current project overview.", "Resumen de tu proyecto actual.")
                : t("All active and completed projects.", "Todos los proyectos activos y completados.")}
            </p>
          </div>

          {isLoading ? (
            <div className="space-y-4">
              {[1,2,3].map(i => <div key={i} className="h-24 bg-card rounded-xl border animate-pulse" />)}
            </div>
          ) : (
            <div className="space-y-4">
              {projects.map((project) => {
                const phaseLabel = lang === "es" ? project.phaseLabelEs : project.phaseLabel;
                const spendPct = Math.round((project.budgetUsed / project.budgetAllocated) * 100);
                return (
                  <div
                    key={project.id}
                    data-testid={`row-project-${project.id}`}
                    className="bg-card rounded-xl border border-card-border shadow-sm p-4 flex items-center gap-4 hover:shadow-md transition-shadow"
                  >
                    {project.coverImage && (
                      <img
                        src={project.coverImage}
                        alt={project.name}
                        className="w-20 h-16 object-cover rounded-lg shrink-0 hidden sm:block"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="font-bold text-foreground">{project.name}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${phaseColors[project.phase]}`}>
                          {phaseLabel}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <MapPin className="w-3 h-3 shrink-0" /> {project.clientName} — {project.location}
                      </p>
                      <div className="flex items-center gap-4 mt-2">
                        <div className="flex-1">
                          <div className="flex justify-between text-xs mb-0.5">
                            <span className="text-muted-foreground">{t("Progress", "Progreso")}</span>
                            <span className="font-medium">{project.progressPercent}%</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className="h-full bg-konti-olive rounded-full" style={{ width: `${project.progressPercent}%` }} />
                          </div>
                        </div>
                        {!isClientUser && (
                          <span className="text-xs text-muted-foreground whitespace-nowrap hidden sm:block">
                            ${project.budgetUsed.toLocaleString()} / ${project.budgetAllocated.toLocaleString()} ({spendPct}%)
                          </span>
                        )}
                      </div>
                    </div>
                    <Link
                      href={`/projects/${project.id}`}
                      data-testid={`link-projects-list-${project.id}`}
                      className="shrink-0 flex items-center gap-1.5 py-2 px-4 bg-konti-olive hover:bg-konti-olive/90 text-white text-xs font-semibold rounded-md transition-colors"
                    >
                      {t("View", "Ver")} <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </AppLayout>
    </RequireAuth>
  );
}
