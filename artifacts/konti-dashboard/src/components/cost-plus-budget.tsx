import { useGetProjectCostPlus, getGetProjectCostPlusQueryKey } from "@workspace/api-client-react";
import { useLang } from "@/hooks/use-lang";
import { Sparkles } from "lucide-react";

export function CostPlusBudget({ projectId, isClientView = false }: { projectId: string; isClientView?: boolean }) {
  const { t, lang } = useLang();
  const { data: cp } = useGetProjectCostPlus(projectId, {
    query: { enabled: !!projectId, queryKey: getGetProjectCostPlusQueryKey(projectId) },
  });

  if (!cp) return null;

  const fmt = (n: number) => `$${n.toLocaleString()}`;
  const lines = [
    { label: t("Materials", "Materiales"), value: cp.materialsCost },
    { label: t("Labor", "Mano de Obra"), value: cp.laborCost },
    { label: t("Subcontractors", "Subcontratistas"), value: cp.subcontractorCost },
  ];

  return (
    <div className="bg-card rounded-xl border border-card-border p-5 shadow-sm" data-testid="cost-plus-budget">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold text-foreground">{t("Cost-Plus Budget", "Presupuesto Cost-Plus")}</h2>
        <span className="text-xs px-2 py-0.5 rounded-full bg-konti-olive/15 text-konti-olive border border-konti-olive/30 font-semibold">
          {t("Cost-Plus", "Cost-Plus")}
        </span>
      </div>

      {isClientView ? (
        <div className="space-y-2 text-sm">
          {lines.map((l) => (
            <div key={l.label} className="flex justify-between text-xs">
              <span className="text-muted-foreground">{l.label}</span>
              <span className="font-medium text-foreground">{fmt(l.value)}</span>
            </div>
          ))}
          <div className="flex justify-between border-t border-border pt-1.5 mt-1.5">
            <span className="text-muted-foreground font-medium">{t("Direct Costs Subtotal", "Subtotal Costos Directos")}</span>
            <span className="font-semibold text-foreground">{fmt(cp.subtotal)}</span>
          </div>
          <div className="flex justify-between bg-konti-olive/10 border border-konti-olive/30 rounded-md px-3 py-2 my-2">
            <span className="font-semibold text-konti-olive flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              {t("Plus Management Fee", "Cargo de Administración Plus")} ({cp.plusFeePercent}%)
            </span>
            <span className="font-bold text-konti-olive">{fmt(cp.plusFeeAmount)}</span>
          </div>
          <div className="flex justify-between border-t border-border pt-2 mt-1">
            <span className="font-bold text-foreground">{t("Final Total", "Total Final")}</span>
            <span className="font-bold text-foreground text-lg">{fmt(cp.finalTotal)}</span>
          </div>
        </div>
      ) : (
        <div className="space-y-1.5 text-sm">
          {lines.map((l) => (
            <div key={l.label} className="flex justify-between text-xs">
              <span className="text-muted-foreground">{l.label}</span>
              <span className="font-medium text-foreground">{fmt(l.value)}</span>
            </div>
          ))}
          <div className="flex justify-between text-xs border-t border-border pt-1.5 mt-1.5">
            <span className="text-muted-foreground font-medium">{t("Subtotal", "Subtotal")}</span>
            <span className="font-semibold text-foreground">{fmt(cp.subtotal)}</span>
          </div>
          <div
            data-testid="plus-fee-row"
            className="flex justify-between bg-konti-olive/10 border border-konti-olive/30 rounded-md px-2.5 py-1.5 my-1.5 text-xs"
          >
            <span className="font-semibold text-konti-olive flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              {t("Plus Fee", "Cargo Plus")} ({cp.plusFeePercent}%)
            </span>
            <span className="font-bold text-konti-olive">{fmt(cp.plusFeeAmount)}</span>
          </div>
          <div className="flex justify-between border-t border-border pt-1.5 mt-1.5">
            <span className="font-bold text-foreground text-sm">{t("Final Total", "Total Final")}</span>
            <span className="font-bold text-foreground text-base">{fmt(cp.finalTotal)}</span>
          </div>
          {(lang === "es" ? cp.notesEs : cp.notes) && (
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{lang === "es" ? cp.notesEs : cp.notes}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default CostPlusBudget;
