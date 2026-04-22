import { useState, useEffect, useCallback } from "react";
import { customFetch } from "@workspace/api-client-react";
import { useLang } from "@/hooks/use-lang";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { ListChecks, Plus, X, Check, Clock, AlertCircle, ShieldOff, Trash2, ArrowRight, Loader2 } from "lucide-react";

type PunchlistStatus = "open" | "in_progress" | "done" | "waived";

interface PunchlistItem {
  id: string;
  projectId: string;
  phase: string;
  label: string;
  labelEs: string;
  owner: string;
  dueDate?: string;
  status: PunchlistStatus;
  waiverReason?: string;
  completedAt?: string;
  updatedAt: string;
}

interface PunchlistResponse {
  projectId: string;
  phase: string;
  items: PunchlistItem[];
  openCount: number;
  totalCount: number;
  doneCount: number;
  waivedCount: number;
}

function StatusPill({ status }: { status: PunchlistStatus }) {
  const { t } = useLang();
  const config: Record<PunchlistStatus, { bg: string; text: string; icon: React.ReactNode; label: string }> = {
    open: { bg: "bg-amber-100", text: "text-amber-800", icon: <AlertCircle className="w-3 h-3" />, label: t("Open", "Abierto") },
    in_progress: { bg: "bg-sky-100", text: "text-sky-800", icon: <Clock className="w-3 h-3" />, label: t("In Progress", "En Progreso") },
    done: { bg: "bg-emerald-100", text: "text-emerald-800", icon: <Check className="w-3 h-3" />, label: t("Done", "Listo") },
    waived: { bg: "bg-slate-200", text: "text-slate-700", icon: <ShieldOff className="w-3 h-3" />, label: t("Waived", "Renunciado") },
  };
  const c = config[status];
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold inline-flex items-center gap-1 ${c.bg} ${c.text}`} data-testid={`punchlist-status-${status}`}>
      {c.icon} {c.label}
    </span>
  );
}

function AddItemDialog({ projectId, phase, onClose, onCreated }: { projectId: string; phase: string; onClose: () => void; onCreated: () => void }) {
  const { t } = useLang();
  const { toast } = useToast();
  const [label, setLabel] = useState("");
  const [labelEs, setLabelEs] = useState("");
  const [owner, setOwner] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!label.trim() || !labelEs.trim() || !owner.trim()) {
      toast({ title: t("Label (EN/ES) and owner required", "Etiqueta (EN/ES) y responsable requeridos"), variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      await customFetch(`/api/projects/${projectId}/punchlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, labelEs, owner, dueDate: dueDate || undefined, phase }),
      });
      toast({ title: t("Punchlist item added", "Ítem de punchlist agregado") });
      onCreated();
      onClose();
    } catch {
      toast({ title: t("Failed to add item", "Error al agregar ítem"), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" data-testid="punchlist-add-dialog">
      <div className="bg-card rounded-xl border border-card-border shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold">{t("Add Punchlist Item", "Agregar Ítem de Punchlist")}</h3>
          <button onClick={onClose} data-testid="btn-close-punchlist-add"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">{t("Label (English)", "Etiqueta (Inglés)")}</label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              data-testid="input-punchlist-label-en"
              className="w-full px-3 py-2 text-sm rounded-md border border-border bg-background"
              placeholder="Re-seal master shower silicone"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">{t("Label (Spanish)", "Etiqueta (Español)")}</label>
            <input
              value={labelEs}
              onChange={(e) => setLabelEs(e.target.value)}
              data-testid="input-punchlist-label-es"
              className="w-full px-3 py-2 text-sm rounded-md border border-border bg-background"
              placeholder="Resellar silicona de la ducha principal"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">{t("Owner", "Responsable")}</label>
            <input
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              data-testid="input-punchlist-owner"
              className="w-full px-3 py-2 text-sm rounded-md border border-border bg-background"
              placeholder="Jorge Rosa"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">{t("Due Date (optional)", "Fecha límite (opcional)")}</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              data-testid="input-punchlist-due"
              className="w-full px-3 py-2 text-sm rounded-md border border-border bg-background"
            />
          </div>
          <button
            onClick={submit}
            disabled={busy}
            data-testid="btn-submit-punchlist"
            className="w-full py-2 bg-konti-olive hover:bg-konti-olive/90 text-white text-sm font-semibold rounded-md transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {t("Add Item", "Agregar Ítem")}
          </button>
        </div>
      </div>
    </div>
  );
}

export function PunchlistPanel({
  projectId,
  currentPhase,
  isClientView,
  onAdvanced,
}: {
  projectId: string;
  currentPhase: string;
  isClientView: boolean;
  onAdvanced?: () => void;
}) {
  const { t, lang } = useLang();
  const { user } = useAuth();
  const { toast } = useToast();
  const [data, setData] = useState<PunchlistResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [advancing, setAdvancing] = useState(false);

  const canEdit = !isClientView && user?.role !== "client";

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const d = await customFetch<PunchlistResponse>(`/api/projects/${projectId}/punchlist?phase=${encodeURIComponent(currentPhase)}`);
      setData(d);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [projectId, currentPhase]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function setStatus(item: PunchlistItem, status: PunchlistStatus) {
    let waiverReason: string | undefined;
    if (status === "waived") {
      const reason = window.prompt(
        t("Justification for waiving this item (required, ≥3 chars):", "Justificación para renunciar a este ítem (requerido, ≥3 caracteres):") ?? "",
        "",
      );
      if (reason === null) return;
      if (reason.trim().length < 3) {
        toast({ title: t("Justification too short", "Justificación demasiado corta"), variant: "destructive" });
        return;
      }
      waiverReason = reason.trim();
    }
    setBusyItemId(item.id);
    try {
      await customFetch(`/api/projects/${projectId}/punchlist/${item.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, waiverReason }),
      });
      toast({ title: t("Item updated", "Ítem actualizado") });
      await refresh();
    } catch {
      toast({ title: t("Update failed", "Actualización falló"), variant: "destructive" });
    } finally {
      setBusyItemId(null);
    }
  }

  async function deleteItem(item: PunchlistItem) {
    if (!window.confirm(t(`Delete "${item.label}"?`, `¿Eliminar "${item.labelEs}"?`))) return;
    setBusyItemId(item.id);
    try {
      await customFetch(`/api/projects/${projectId}/punchlist/${item.id}`, { method: "DELETE" });
      await refresh();
    } catch {
      toast({ title: t("Delete failed", "Eliminación falló"), variant: "destructive" });
    } finally {
      setBusyItemId(null);
    }
  }

  async function advancePhase() {
    setAdvancing(true);
    try {
      await customFetch(`/api/projects/${projectId}/advance-phase`, { method: "POST" });
      toast({ title: t("Phase advanced", "Fase avanzada") });
      onAdvanced?.();
      window.location.reload();
    } catch (err) {
      const e = err as { status?: number; data?: { error?: string; message?: string; messageEs?: string; openCount?: number } };
      const msg = lang === "es" ? e?.data?.messageEs : e?.data?.message;
      toast({
        title: t("Cannot advance phase", "No se puede avanzar la fase"),
        description: msg ?? t("Unknown error", "Error desconocido"),
        variant: "destructive",
      });
    } finally {
      setAdvancing(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-card rounded-xl border border-card-border p-5 shadow-sm" data-testid="punchlist-panel-loading">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> {t("Loading punchlist…", "Cargando punchlist…")}
        </div>
      </div>
    );
  }

  if (!data || data.totalCount === 0) {
    if (!canEdit) return null; // hide for clients when empty
    return (
      <div className="bg-card rounded-xl border border-card-border p-5 shadow-sm" data-testid="punchlist-panel">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold flex items-center gap-2">
            <ListChecks className="w-5 h-5 text-konti-olive" />
            {t("Phase Punchlist", "Punchlist de la Fase")}
          </h2>
          <button
            onClick={() => setShowAdd(true)}
            data-testid="btn-add-punchlist-empty"
            className="text-xs px-3 py-1.5 rounded-md border border-konti-olive text-konti-olive hover:bg-konti-olive/10 inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> {t("Add Item", "Agregar Ítem")}
          </button>
        </div>
        <p className="text-sm text-muted-foreground">{t("No punchlist items for this phase yet.", "Aún no hay ítems de punchlist para esta fase.")}</p>
        {showAdd && <AddItemDialog projectId={projectId} phase={currentPhase} onClose={() => setShowAdd(false)} onCreated={refresh} />}
      </div>
    );
  }

  const { items, openCount, doneCount, waivedCount, totalCount } = data;
  const completedOrWaived = doneCount + waivedCount;
  const progressPct = totalCount > 0 ? Math.round((completedOrWaived / totalCount) * 100) : 0;
  const blocked = openCount > 0;
  const isFinalPhase = currentPhase === "completed";

  return (
    <div className="bg-card rounded-xl border border-card-border p-5 shadow-sm" data-testid="punchlist-panel">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold flex items-center gap-2">
          <ListChecks className="w-5 h-5 text-konti-olive" />
          {t("Phase Punchlist", "Punchlist de la Fase")}
          <span className="text-xs font-normal text-muted-foreground">
            ({completedOrWaived} {t("of", "de")} {totalCount} {t("complete", "completos")})
          </span>
        </h2>
        {canEdit && (
          <button
            onClick={() => setShowAdd(true)}
            data-testid="btn-add-punchlist"
            className="text-xs px-3 py-1.5 rounded-md border border-konti-olive text-konti-olive hover:bg-konti-olive/10 inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> {t("Add", "Agregar")}
          </button>
        )}
      </div>

      <div className="mb-4">
        <div className="h-2 bg-muted rounded-full overflow-hidden" data-testid="punchlist-progress-bar">
          <div
            className={`h-full transition-all ${blocked ? "bg-amber-500" : "bg-emerald-500"}`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-1.5 text-xs text-muted-foreground">
          <span data-testid="punchlist-summary">
            {openCount} {t("open", "abiertos")} · {doneCount} {t("done", "listos")} · {waivedCount} {t("waived", "renunciados")}
          </span>
          <span>{progressPct}%</span>
        </div>
      </div>

      <div className="space-y-2 mb-4">
        {items.map((item) => (
          <div
            key={item.id}
            data-testid={`punchlist-item-${item.id}`}
            className="rounded-lg border border-border bg-muted/20 p-3 flex items-start gap-3"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">
                {lang === "es" ? item.labelEs : item.label}
              </p>
              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                <StatusPill status={item.status} />
                <span>{item.owner}</span>
                {item.dueDate && <span>· {t("Due", "Vence")} {item.dueDate}</span>}
              </div>
              {item.status === "waived" && item.waiverReason && (
                <p className="text-xs italic text-slate-600 mt-1.5" data-testid={`punchlist-waiver-${item.id}`}>
                  <ShieldOff className="w-3 h-3 inline mr-1" />
                  {t("Waived:", "Renunciado:")} {item.waiverReason}
                </p>
              )}
            </div>
            {canEdit && (
              <div className="flex items-center gap-1 shrink-0">
                {item.status !== "in_progress" && item.status !== "done" && item.status !== "waived" && (
                  <button
                    onClick={() => setStatus(item, "in_progress")}
                    disabled={busyItemId === item.id}
                    data-testid={`btn-punchlist-start-${item.id}`}
                    title={t("Mark in progress", "Marcar en progreso")}
                    className="p-1.5 rounded-md text-sky-700 hover:bg-sky-100 disabled:opacity-50"
                  >
                    <Clock className="w-4 h-4" />
                  </button>
                )}
                {item.status !== "done" && (
                  <button
                    onClick={() => setStatus(item, "done")}
                    disabled={busyItemId === item.id}
                    data-testid={`btn-punchlist-done-${item.id}`}
                    title={t("Mark done", "Marcar como listo")}
                    className="p-1.5 rounded-md text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                )}
                {item.status !== "waived" && item.status !== "done" && (
                  <button
                    onClick={() => setStatus(item, "waived")}
                    disabled={busyItemId === item.id}
                    data-testid={`btn-punchlist-waive-${item.id}`}
                    title={t("Waive (requires justification)", "Renunciar (requiere justificación)")}
                    className="p-1.5 rounded-md text-slate-700 hover:bg-slate-200 disabled:opacity-50"
                  >
                    <ShieldOff className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => deleteItem(item)}
                  disabled={busyItemId === item.id}
                  data-testid={`btn-punchlist-delete-${item.id}`}
                  title={t("Delete", "Eliminar")}
                  className="p-1.5 rounded-md text-red-700 hover:bg-red-100 disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {canEdit && !isFinalPhase && (
        <div className="border-t border-border pt-4">
          {blocked && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mb-2 inline-flex items-start gap-1.5" data-testid="punchlist-block-reason">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>
                {t(
                  `${openCount} open item(s) must be completed or waived before advancing the phase.`,
                  `${openCount} ítem(s) abierto(s) deben completarse o renunciarse antes de avanzar la fase.`,
                )}
              </span>
            </p>
          )}
          <button
            onClick={advancePhase}
            disabled={blocked || advancing}
            data-testid="btn-advance-phase-from-punchlist"
            className="w-full py-2.5 bg-konti-olive hover:bg-konti-olive/90 text-white text-sm font-semibold rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
          >
            {advancing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
            {t("Advance Phase", "Avanzar Fase")}
          </button>
        </div>
      )}

      {showAdd && <AddItemDialog projectId={projectId} phase={currentPhase} onClose={() => setShowAdd(false)} onCreated={refresh} />}
    </div>
  );
}

export default PunchlistPanel;
