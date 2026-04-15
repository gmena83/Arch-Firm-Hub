import { Users, Mail, Award } from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { RequireAuth } from "@/hooks/use-auth";
import { useLang } from "@/hooks/use-lang";

const TEAM = [
  {
    name: "Carla Gautier",
    title: "CEO & Founder",
    titleEs: "CEO y Fundadora",
    email: "carla@konti.com",
    specialty: "Sustainable Architecture & Project Vision",
    specialtyEs: "Arquitectura Sostenible y Visión de Proyectos",
    initials: "CG",
    color: "bg-konti-olive",
  },
  {
    name: "Michelle Telon Sosa",
    title: "Lead Designer",
    titleEs: "Diseñadora Principal",
    email: "michelle@konti.com",
    specialty: "Bioclimatic Design & Interior Architecture",
    specialtyEs: "Diseño Bioclimático y Arquitectura de Interiores",
    initials: "MT",
    color: "bg-konti-slate",
  },
  {
    name: "Jorge Rosa",
    title: "Chief Operations Officer",
    titleEs: "Director de Operaciones",
    email: "jorge@konti.com",
    specialty: "Construction Management & Site Logistics",
    specialtyEs: "Gestión de Construcción y Logística de Obra",
    initials: "JR",
    color: "bg-amber-700",
  },
  {
    name: "Andrea Camacho",
    title: "Environmental Construction Manager",
    titleEs: "Gerente de Construcción Ambiental",
    email: "andrea@konti.com",
    specialty: "Environmental Compliance & Permitting",
    specialtyEs: "Cumplimiento Ambiental y Permisos OGPE",
    initials: "AC",
    color: "bg-teal-700",
  },
  {
    name: "Miranda Klopf",
    title: "Sales, Marketing & Design",
    titleEs: "Ventas, Mercadeo y Diseño",
    email: "miranda@konti.com",
    specialty: "Client Relations & Brand Communications",
    specialtyEs: "Relaciones con Clientes y Comunicaciones de Marca",
    initials: "MK",
    color: "bg-purple-700",
  },
];

export default function TeamPage() {
  const { t, lang } = useLang();

  return (
    <RequireAuth>
      <AppLayout>
        <div className="space-y-6" data-testid="team-page">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Users className="w-6 h-6 text-konti-olive" />
              {t("Team Directory", "Directorio del Equipo")}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {t("The KONTi Design | Build Studio team.", "El equipo de KONTi Design | Build Studio.")}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {TEAM.map((member) => (
              <div
                key={member.email}
                data-testid={`team-card-${member.initials}`}
                className="bg-card rounded-xl border border-card-border shadow-sm p-5 flex flex-col gap-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full ${member.color} flex items-center justify-center text-white font-bold text-sm shrink-0`}>
                    {member.initials}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground text-sm leading-tight">{member.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-tight">
                      {lang === "es" ? member.titleEs : member.title}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Mail className="w-3.5 h-3.5 shrink-0" />
                    <a href={`mailto:${member.email}`} className="hover:text-foreground transition-colors truncate">
                      {member.email}
                    </a>
                  </div>
                  <div className="flex items-start gap-2">
                    <Award className="w-3.5 h-3.5 shrink-0 text-konti-olive mt-0.5" />
                    <p className="text-xs text-muted-foreground leading-tight">
                      {lang === "es" ? member.specialtyEs : member.specialty}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </AppLayout>
    </RequireAuth>
  );
}
