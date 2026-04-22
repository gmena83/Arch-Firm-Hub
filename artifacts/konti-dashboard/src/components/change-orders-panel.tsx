import { useEffect, useState, useCallback } from "react";
import { customFetch } from "@workspace/api-client-react";
import { useLang } from "@/hooks/use-lang";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { ClipboardList, Plus, X, CheckCircle, XCircle, Clock, ChevronDown, ChevronUp } from "lucide-react";

type COStatus = "pending" | "approved" | "rejected";

interface ChangeOrder {
  id: string;
  projectId: string;
  number: string;
  title: string;
  titleEs: string;
  description: string;
  descriptionEs: string;
  amountDelta: number;
  scheduleImpactDays: number;
  reason: string;
  reasonEs: string;
  requestedBy: string;
  requestedAt: string;
  status: COStatus;
  decidedBy?: string;
  decidedAt?: string;
  decisionNote?: string;
}

interface COResponse {
  projectId: string;
  changeOrders: ChangeOrder[];
  totals: { approvedDelta: number; pendingDelta: number; approvedDays: number };
}

const STATUS_BADGE: Record<COStatus, { bg: string; label: { en: string; es: string }; icon: React.ReactNode }> = {
  pending: { bg: "bg-amber-100 text-amber-800 border-amber-200", label: { en: "Pending", es: "Pendiente" }, icon: <Clock className="w-3 h-3" /> },
  approved: { bg: "bg-emerald-100 text-emerald-800 border-emerald-200", label: { en: "Approved", es: "Aprobada" }, icon: <CheckCircle className="w-3 h-3" /> },
  rejected: { bg: "bg-red-100 text-red-800 border-red-200", label: { en: "Rejected", es: "Rechazada" }, icon: <XCircle className="w-3 h-3" /> },
};

function CreateCOModal({ projectId, onClose, onCreated }: { projectId: string; onClose: () => void; onCreated: () => void }) {
  const { t } = useLang();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [days, setDays] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!title.trim() || !amount.trim()) return;
    const amt = Number(amount);
    const d = Number(days || "0");
    if (!isFinite(amt)) {
      toast({ title: t("Invalid amount", "Monto inválido"), variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      await customFetch(`/api/projects/${projectId}/change-orders`, {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          titleEs: title.trim(),
          description: reason.trim(),
          descriptionEs: reason.trim(),
          amountDelta: amt,
          scheduleImpactDays: d,
          reason: reason.trim(),
          reasonEs: reason.trim(),
        }),
      });
      toast({ title: t("Change order created", "Orden de cambio creada") });
      onCreated();
      onClose();
    } catch {
      toast({ title: t("Could not create", "No se pudo crear"), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" data-testid="co-create-modal">
      <div className="bg-card rounded-xl border border-card-border shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">{t("New Change Order", "Nueva Orden de Cambio")}</h2>
          <button onClick={onClose} data-testid="btn-close-co-create"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-muted-foreground">{t("Title", "Título")}</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              data-testid="input-co-title"
              className="w-full mt-1 px-3 py-2 border border-border rounded-md text-sm bg-background"
              placeholder={t("e.g. Upgrade roofing material", "p.ej. Mejora del material del techo")}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground">{t("Amount Δ ($)", "Monto Δ ($)")}</label>
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                data-testid="input-co-amount"
                type="number"
                className="w-full mt-1 px-3 py-2 border border-border rounded-md text-sm bg-background"
                placeholder="3500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">{t("Days impact", "Días de impacto")}</label>
              <input
                value={days}
                onChange={(e) => setDays(e.target.value)}
                data-testid="input-co-days"
                type="number"
                min="0"
                className="w-full mt-1 px-3 py-2 border border-border rounded-md text-sm bg-background"
                placeholder="3"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">{t("Reason", "Razón")}</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              data-testid="input-co-reason"
              rows={3}
              className="w-full mt-1 px-3 py-2 border border-border rounded-md text-sm bg-background"
              placeholder={t("Brief justification…", "Justificación breve…")}
            />
          </div>
          <button
            onClick={submit}
            disabled={busy || !title.trim() || !amount.trim()}
            data-testid="btn-submit-co"
            className="w-full py-2.5 bg-konti-olive hover:bg-konti-olive/90 disabled:opacity-50 text-white text-sm font-semibold rounded-md transition-colors"
          >
            {t("Submit Change Order", "Enviar Orden de Cambio")}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ChangeOrdersPanel({ projectId, isClientView, currentPhase }: { projectId: string; isClientView: boolean; currentPhase: string }) {
  const { t, lang } = useLang();
  const { user } = useAuth();
  const { toast } = useToast();
  const [data, setData] = useState<COResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const d = await customFetch<COResponse>(`/api/projects/${projectId}/change-orders`);
      setData(d);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { void refresh(); }, [refresh]);

  if (loading) return null;
  if (!data) return null;

  // Show panel from design phase onward (CO's are most relevant once a contract exists)
  const visiblePhases = ["design", "permits", "construction", "completed"];
  if (!visiblePhases.includes(currentPhase) && data.changeOrders.length === 0) return null;

  const isClient = user?.role === "client" && isClientView;
  const isTeamUser = user?.role !== "client";
  const canCreate = isTeamUser && !isClientView;

  const decide = async (coId: string, decision: "approved" | "rejected") => {
    if (!isClient || busy) return;
    setBusy(true);
    try {
      await customFetch(`/api/projects/${projectId}/change-orders/${coId}/decision`, {
        method: "POST",
        body: JSON.stringify({ decision }),
      });
      toast({ title: decision === "approved" ? t("Change order approved", "Orden aprobada") : t("Change order rejected", "Orden rechazada") });
      await refresh();
    } catch {
      toast({ title: t("Action failed", "Acción fallida"), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-card rounded-xl border border-card-border p-5 shadow-sm" data-testid="change-orders-panel">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold text-foreground flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-konti-olive" />
          {t("Change Orders", "Órdenes de Cambio")}
        </h2>
        {canCreate && (
          <button
            onClick={() => setShowCreate(true)}
            data-testid="btn-create-co"
            className="flex items-center gap-1 text-xs font-semibold text-konti-olive hover:text-konti-olive/80"
          >
            <Plus className="w-3.5 h-3.5" /> {t("New", "Nueva")}
          </button>
        )}
      </div>

      {/* Totals strip */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2 text-center">
          <p className="text-[11px] text-emerald-700 font-medium">{t("Approved Δ", "Aprobado Δ")}</p>
          <p className="text-sm font-bold text-emerald-800">{data.totals.approvedDelta >= 0 ? "+" : "−"}${Math.abs(data.totals.approvedDelta).toLocaleString()}</p>
        </div>
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-2 text-center">
          <p className="text-[11px] text-amber-700 font-medium">{t("Pending Δ", "Pendiente Δ")}</p>
          <p className="text-sm font-bold text-amber-800">{data.totals.pendingDelta >= 0 ? "+" : "−"}${Math.abs(data.totals.pendingDelta).toLocaleString()}</p>
        </div>
        <div className="rounded-lg bg-slate-50 border border-slate-200 p-2 text-center">
          <p className="text-[11px] text-slate-700 font-medium">{t("Schedule Δ", "Plazo Δ")}</p>
          <p className="text-sm font-bold text-slate-800">+{data.totals.approvedDays}d</p>
        </div>
      </div>

      {data.changeOrders.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">{t("No change orders yet.", "Aún no hay órdenes de cambio.")}</p>
      ) : (
        <div className="space-y-2">
          {data.changeOrders.map((co) => {
            const title = lang === "es" ? co.titleEs : co.title;
            const reason = lang === "es" ? co.reasonEs : co.reason;
            const badge = STATUS_BADGE[co.status];
            const expanded = expandedId === co.id;
            return (
              <div key={co.id} data-testid={`co-${co.id}`} className="border border-border rounded-lg">
                <button
                  onClick={() => setExpandedId(expanded ? null : co.id)}
                  className="w-full flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors text-left"
                  data-testid={`btn-toggle-co-${co.number}`}
                >
                  <span className="text-xs font-bold text-konti-olive shrink-0">{co.number}</span>
                  <span className="flex-1 text-sm font-medium truncate">{title}</span>
                  <span className={`text-xs font-semibold ${co.amountDelta >= 0 ? "text-foreground" : "text-emerald-700"}`}>
                    {co.amountDelta >= 0 ? "+" : "−"}${Math.abs(co.amountDelta).toLocaleString()}
                  </span>
                  <span className={`text-[11px] px-1.5 py-0.5 rounded border font-semibold flex items-center gap-1 ${badge.bg}`}>
                    {badge.icon} {lang === "es" ? badge.label.es : badge.label.en}
                  </span>
                  {expanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                </button>
                {expanded && (
                  <div className="border-t border-border px-3 py-3 space-y-2 bg-muted/10">
                    {reason && <p className="text-xs text-foreground"><span className="font-semibold">{t("Reason", "Razón")}:</span> {reason}</p>}
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span>{t("Schedule impact", "Impacto en plazo")}: <strong className="text-foreground">+{co.scheduleImpactDays}d</strong></span>
                      <span>{t("Requested by", "Solicitado por")}: <strong className="text-foreground">{co.requestedBy}</strong></span>
                      <span>{new Date(co.requestedAt).toLocaleDateString(lang === "es" ? "es-PR" : "en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                    </div>
                    {co.decidedAt && co.decidedBy && (
                      <p className="text-xs text-muted-foreground">
                        {co.status === "approved" ? t("Approved by", "Aprobada por") : t("Rejected by", "Rechazada por")} <strong className="text-foreground">{co.decidedBy}</strong> · {new Date(co.decidedAt).toLocaleDateString(lang === "es" ? "es-PR" : "en-US", { month: "short", day: "numeric" })}
                        {co.decisionNote && <> — “{co.decisionNote}”</>}
                      </p>
                    )}
                    {isClient && co.status === "pending" && (
                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={() => decide(co.id, "approved")}
                          disabled={busy}
                          data-testid={`btn-approve-co-${co.number}`}
                          className="flex-1 py-2 px-3 bg-konti-olive hover:bg-konti-olive/90 disabled:opacity-50 text-white text-xs font-semibold rounded-md"
                        >
                          {t("Approve", "Aprobar")}
                        </button>
                        <button
                          onClick={() => decide(co.id, "rejected")}
                          disabled={busy}
                          data-testid={`btn-reject-co-${co.number}`}
                          className="flex-1 py-2 px-3 border border-border hover:bg-muted text-foreground disabled:opacity-50 text-xs font-semibold rounded-md"
                        >
                          {t("Reject", "Rechazar")}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showCreate && <CreateCOModal projectId={projectId} onClose={() => setShowCreate(false)} onCreated={refresh} />}
    </div>
  );
}
