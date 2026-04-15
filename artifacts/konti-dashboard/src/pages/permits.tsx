import { FileCheck, CheckCircle, Clock, AlertCircle, Minus } from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { RequireAuth } from "@/hooks/use-auth";
import { useLang } from "@/hooks/use-lang";

type PermitStatus = "approved" | "submitted" | "pending" | "na";

interface Permit {
  id: string;
  name: string;
  nameEs: string;
  agency: string;
  responsible: string;
  status: PermitStatus;
  processingTime: string;
  processingTimeEs: string;
  notes: string;
  notesEs: string;
}

const PERMITS: Permit[] = [
  {
    id: "perm-1",
    name: "Structural Engineering Stamp",
    nameEs: "Sello de Ingeniería Estructural",
    agency: "CIAPR",
    responsible: "Andrea Camacho",
    status: "approved",
    processingTime: "2–4 weeks",
    processingTimeEs: "2–4 semanas",
    notes: "Licensed PE stamp on structural drawings approved.",
    notesEs: "Sello PE licenciado en planos estructurales aprobado.",
  },
  {
    id: "perm-2",
    name: "ARPE Use Permit (Uso Conforme)",
    nameEs: "Permiso de Uso ARPE (Uso Conforme)",
    agency: "ARPE",
    responsible: "Andrea Camacho",
    status: "approved",
    processingTime: "4–8 weeks",
    processingTimeEs: "4–8 semanas",
    notes: "Land use conformity approved by ARPE for residential use.",
    notesEs: "Conformidad de uso de suelo aprobada por ARPE para uso residencial.",
  },
  {
    id: "perm-3",
    name: "Building Permit (Permiso de Construcción)",
    nameEs: "Permiso de Construcción",
    agency: "OGPE / Municipio",
    responsible: "Andrea Camacho",
    status: "approved",
    processingTime: "6–12 weeks",
    processingTimeEs: "6–12 semanas",
    notes: "Main construction permit issued by OGPE.",
    notesEs: "Permiso principal de construcción emitido por OGPE.",
  },
  {
    id: "perm-4",
    name: "Electrical Inspection Permit",
    nameEs: "Permiso de Inspección Eléctrica",
    agency: "AELEC / LUMA",
    responsible: "Jorge Rosa",
    status: "approved",
    processingTime: "1–3 weeks",
    processingTimeEs: "1–3 semanas",
    notes: "Electrical system inspection completed and approved.",
    notesEs: "Inspección del sistema eléctrico completada y aprobada.",
  },
  {
    id: "perm-5",
    name: "Plumbing Inspection Permit",
    nameEs: "Permiso de Inspección de Plomería",
    agency: "Junta de Calidad Ambiental",
    responsible: "Jorge Rosa",
    status: "approved",
    processingTime: "1–2 weeks",
    processingTimeEs: "1–2 semanas",
    notes: "Potable water and sewage systems approved.",
    notesEs: "Sistemas de agua potable y alcantarillado aprobados.",
  },
  {
    id: "perm-6",
    name: "Fire & Safety Certificate",
    nameEs: "Certificado de Bomberos",
    agency: "Cuerpo de Bomberos PR",
    responsible: "Jorge Rosa",
    status: "approved",
    processingTime: "2–4 weeks",
    processingTimeEs: "2–4 semanas",
    notes: "Fire suppression and egress plan approved.",
    notesEs: "Plan de supresión de incendios y salidas de emergencia aprobado.",
  },
  {
    id: "perm-7",
    name: "Environmental Clearance (DIA)",
    nameEs: "Autorización Ambiental (DIA)",
    agency: "Junta de Calidad Ambiental",
    responsible: "Andrea Camacho",
    status: "approved",
    processingTime: "8–16 weeks",
    processingTimeEs: "8–16 semanas",
    notes: "Environmental impact assessment completed for coastal proximity.",
    notesEs: "Evaluación de impacto ambiental completada por proximidad costera.",
  },
  {
    id: "perm-8",
    name: "Occupancy Certificate (Certificado de Habitabilidad)",
    nameEs: "Certificado de Habitabilidad",
    agency: "OGPE / Municipio",
    responsible: "Carla Gautier",
    status: "pending",
    processingTime: "2–4 weeks after completion",
    processingTimeEs: "2–4 semanas tras completar",
    notes: "Pending construction completion and final inspection.",
    notesEs: "Pendiente a la finalización de construcción e inspección final.",
  },
  {
    id: "perm-9",
    name: "AASIF Solar / Energy Storage",
    nameEs: "AASIF Solar / Almacenamiento de Energía",
    agency: "PREB / AASIF",
    responsible: "Andrea Camacho",
    status: "submitted",
    processingTime: "4–6 weeks",
    processingTimeEs: "4–6 semanas",
    notes: "Solar panel interconnection application submitted to LUMA.",
    notesEs: "Solicitud de interconexión solar enviada a LUMA.",
  },
  {
    id: "perm-10",
    name: "CRIM Property Registration",
    nameEs: "Registro de Propiedad CRIM",
    agency: "CRIM",
    responsible: "Carla Gautier",
    status: "na",
    processingTime: "After occupancy",
    processingTimeEs: "Después de habitabilidad",
    notes: "Property tax registration — post-occupancy.",
    notesEs: "Registro de contribución de propiedad — tras habitabilidad.",
  },
];

const STATUS_CONFIG: Record<PermitStatus, { label: string; labelEs: string; icon: React.ReactNode; classes: string }> = {
  approved: {
    label: "Approved",
    labelEs: "Aprobado",
    icon: <CheckCircle className="w-3.5 h-3.5" />,
    classes: "bg-green-100 text-green-700 border-green-200",
  },
  submitted: {
    label: "Submitted",
    labelEs: "Sometido",
    icon: <Clock className="w-3.5 h-3.5" />,
    classes: "bg-amber-100 text-amber-700 border-amber-200",
  },
  pending: {
    label: "Pending",
    labelEs: "Pendiente",
    icon: <AlertCircle className="w-3.5 h-3.5" />,
    classes: "bg-gray-100 text-gray-600 border-gray-200",
  },
  na: {
    label: "N/A",
    labelEs: "N/A",
    icon: <Minus className="w-3.5 h-3.5" />,
    classes: "bg-slate-100 text-slate-500 border-slate-200",
  },
};

const SUMMARY_COUNTS = PERMITS.reduce<Record<PermitStatus, number>>(
  (acc, p) => { acc[p.status]++; return acc; },
  { approved: 0, submitted: 0, pending: 0, na: 0 }
);

export default function PermitsPage() {
  const { t, lang } = useLang();

  return (
    <RequireAuth>
      <AppLayout>
        <div className="space-y-6" data-testid="permits-page">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <FileCheck className="w-6 h-6 text-konti-olive" />
              {t("Permit Checklist", "Lista de Permisos")}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {t(
                "OGPE Phase 4 permit tracking — Puerto Rico building code requirements.",
                "Seguimiento de permisos OGPE Fase 4 — Requisitos del código de construcción de Puerto Rico."
              )}
            </p>
          </div>

          {/* Summary chips */}
          <div className="flex flex-wrap gap-3">
            {(["approved", "submitted", "pending", "na"] as PermitStatus[]).map((status) => {
              const cfg = STATUS_CONFIG[status];
              return (
                <div key={status} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${cfg.classes}`}>
                  {cfg.icon}
                  <span>{lang === "es" ? cfg.labelEs : cfg.label}</span>
                  <span className="font-bold">{SUMMARY_COUNTS[status]}</span>
                </div>
              );
            })}
          </div>

          {/* Permits table */}
          <div className="bg-card rounded-xl border border-card-border shadow-sm overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]" data-testid="permits-table">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">{t("Permit", "Permiso")}</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell">{t("Agency", "Agencia")}</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden lg:table-cell">{t("Responsible", "Responsable")}</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">{t("Status", "Estado")}</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden lg:table-cell">{t("Est. Time", "Tiempo Est.")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {PERMITS.map((permit) => {
                  const cfg = STATUS_CONFIG[permit.status];
                  return (
                    <tr key={permit.id} data-testid={`permit-row-${permit.id}`} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{lang === "es" ? permit.nameEs : permit.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{lang === "es" ? permit.notesEs : permit.notes}</p>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{permit.agency}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{permit.responsible}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${cfg.classes}`}>
                          {cfg.icon}
                          {lang === "es" ? cfg.labelEs : cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground hidden lg:table-cell">
                        {lang === "es" ? permit.processingTimeEs : permit.processingTime}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-muted-foreground">
            {t(
              "Based on Residencia Martínez Ocasio (Phase 5 — Construction). All permits reflect current project status.",
              "Basado en Residencia Martínez Ocasio (Fase 5 — Construcción). Todos los permisos reflejan el estado actual del proyecto."
            )}
          </p>
        </div>
      </AppLayout>
    </RequireAuth>
  );
}
