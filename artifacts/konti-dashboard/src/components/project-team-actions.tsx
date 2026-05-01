import { useState } from "react";
import { MapPinned, MessageCircle, Link2, X, Loader2, CheckCircle2 } from "lucide-react";
import {
  useLogProjectSiteVisit,
  useLogProjectClientInteraction,
  useListProjectAsanaCandidates,
  useLinkProjectToAsanaTask,
  useGetAsanaStatus,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLang } from "@/hooks/use-lang";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

/**
 * Task #127 — Three quick-action buttons exposed to team users on the Project
 * Detail page:
 *
 *   1. "Log site visit"        → POST /projects/:id/site-visits
 *   2. "Log client interaction" → POST /projects/:id/client-interactions
 *   3. "Link to Asana task"     → GET candidates + POST /asana-link
 *
 * Each button opens an inline modal. We invalidate the project & activity
 * query keys after success so the activity feed picks up the new entry.
 */
export function ProjectTeamActions({
  projectId,
  actor,
  asanaGid,
}: {
  projectId: string;
  actor: string;
  asanaGid?: string | null | undefined;
}) {
  const { t } = useLang();
  const [open, setOpen] = useState<"visit" | "interaction" | "link" | null>(null);

  const status = useGetAsanaStatus({
    query: { queryKey: ["/api/integrations/asana/status"], refetchOnWindowFocus: false, staleTime: 60_000 },
  });
  const asanaConfigured = status.data?.configured === true;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2" data-testid="project-team-actions">
        <Button
          size="sm"
          variant="outline"
          onClick={() => setOpen("visit")}
          data-testid="btn-log-site-visit"
        >
          <MapPinned className="w-3.5 h-3.5 mr-1" />
          {t("Log site visit", "Registrar visita al sitio")}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setOpen("interaction")}
          data-testid="btn-log-client-interaction"
        >
          <MessageCircle className="w-3.5 h-3.5 mr-1" />
          {t("Log client contact", "Registrar contacto cliente")}
        </Button>
        {asanaConfigured && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setOpen("link")}
            data-testid="btn-link-asana"
          >
            <Link2 className="w-3.5 h-3.5 mr-1" />
            {asanaGid ? t("Re-link Asana task", "Re-vincular tarea Asana") : t("Link Asana task", "Vincular tarea Asana")}
          </Button>
        )}
      </div>

      {open === "visit" && (
        <SiteVisitModal projectId={projectId} actor={actor} onClose={() => setOpen(null)} />
      )}
      {open === "interaction" && (
        <ClientInteractionModal projectId={projectId} actor={actor} onClose={() => setOpen(null)} />
      )}
      {open === "link" && (
        <AsanaLinkModal projectId={projectId} onClose={() => setOpen(null)} currentGid={asanaGid ?? null} />
      )}
    </>
  );
}

// -----------------------------------------------------------------------------
// Modal shell
// -----------------------------------------------------------------------------
function ModalShell({
  title,
  onClose,
  children,
  testId,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  testId: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" data-testid={testId}>
      <div className="bg-card rounded-xl border border-card-border shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} data-testid={`${testId}-close`}>
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Site visit
// -----------------------------------------------------------------------------
function SiteVisitModal({
  projectId,
  actor,
  onClose,
}: {
  projectId: string;
  actor: string;
  onClose: () => void;
}) {
  const { t } = useLang();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [notesEn, setNotesEn] = useState("");
  const [notesEs, setNotesEs] = useState("");
  const [duration, setDuration] = useState<number>(60);
  const log = useLogProjectSiteVisit();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notesEn.trim()) return;
    try {
      await log.mutateAsync({
        projectId,
        data: {
          actor,
          notes: notesEn.trim(),
          ...(notesEs.trim() ? { notesEs: notesEs.trim() } : {}),
          ...(duration > 0 ? { durationMinutes: duration } : {}),
        },
      });
      await qc.invalidateQueries({ queryKey: [`/api/projects/${projectId}/pre-design`] });
      await qc.invalidateQueries({ queryKey: [`/api/projects/${projectId}`] });
      toast({
        title: t("Site visit logged", "Visita registrada"),
        description: t("Activity recorded for this project.", "Actividad registrada para este proyecto."),
      });
      onClose();
    } catch {
      toast({ title: t("Could not log visit", "No se pudo registrar"), variant: "destructive" });
    }
  };

  return (
    <ModalShell title={t("Log site visit", "Registrar visita al sitio")} onClose={onClose} testId="site-visit-modal">
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <Label htmlFor="sv-notes" className="text-xs">
            {t("Notes (English)", "Notas (Inglés)")} *
          </Label>
          <textarea
            id="sv-notes"
            data-testid="site-visit-notes"
            required
            rows={3}
            value={notesEn}
            onChange={(e) => setNotesEn(e.target.value)}
            className="mt-1 w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
          />
        </div>
        <div>
          <Label htmlFor="sv-notes-es" className="text-xs">
            {t("Notes (Spanish — optional)", "Notas (Español — opcional)")}
          </Label>
          <textarea
            id="sv-notes-es"
            data-testid="site-visit-notes-es"
            rows={2}
            value={notesEs}
            onChange={(e) => setNotesEs(e.target.value)}
            className="mt-1 w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
          />
        </div>
        <div>
          <Label htmlFor="sv-duration" className="text-xs">
            {t("Duration (minutes)", "Duración (minutos)")}
          </Label>
          <Input
            id="sv-duration"
            type="number"
            min={0}
            step={5}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            data-testid="site-visit-duration"
            className="mt-1"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("Cancel", "Cancelar")}
          </Button>
          <Button type="submit" disabled={log.isPending} data-testid="site-visit-submit">
            {log.isPending ? t("Saving…", "Guardando…") : t("Save", "Guardar")}
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}

// -----------------------------------------------------------------------------
// Client interaction
// -----------------------------------------------------------------------------
function ClientInteractionModal({
  projectId,
  actor,
  onClose,
}: {
  projectId: string;
  actor: string;
  onClose: () => void;
}) {
  const { t } = useLang();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [channel, setChannel] = useState<"phone" | "email" | "in_person" | "whatsapp" | "video_call">("phone");
  const [notesEn, setNotesEn] = useState("");
  const [notesEs, setNotesEs] = useState("");
  const log = useLogProjectClientInteraction();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notesEn.trim()) return;
    try {
      await log.mutateAsync({
        projectId,
        data: {
          actor,
          channel,
          notes: notesEn.trim(),
          ...(notesEs.trim() ? { notesEs: notesEs.trim() } : {}),
        },
      });
      await qc.invalidateQueries({ queryKey: [`/api/projects/${projectId}/pre-design`] });
      await qc.invalidateQueries({ queryKey: [`/api/projects/${projectId}`] });
      toast({
        title: t("Interaction logged", "Interacción registrada"),
      });
      onClose();
    } catch {
      toast({ title: t("Could not log interaction", "No se pudo registrar"), variant: "destructive" });
    }
  };

  return (
    <ModalShell
      title={t("Log client contact", "Registrar contacto con cliente")}
      onClose={onClose}
      testId="client-interaction-modal"
    >
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <Label htmlFor="ci-channel" className="text-xs">
            {t("Channel", "Canal")}
          </Label>
          <select
            id="ci-channel"
            value={channel}
            onChange={(e) => setChannel(e.target.value as typeof channel)}
            data-testid="client-interaction-channel"
            className="mt-1 w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
          >
            <option value="phone">{t("Phone", "Teléfono")}</option>
            <option value="email">{t("Email", "Correo")}</option>
            <option value="in_person">{t("In person", "En persona")}</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="video_call">{t("Video call", "Videollamada")}</option>
          </select>
        </div>
        <div>
          <Label htmlFor="ci-notes" className="text-xs">
            {t("Notes (English)", "Notas (Inglés)")} *
          </Label>
          <textarea
            id="ci-notes"
            required
            rows={3}
            value={notesEn}
            onChange={(e) => setNotesEn(e.target.value)}
            data-testid="client-interaction-notes"
            className="mt-1 w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
          />
        </div>
        <div>
          <Label htmlFor="ci-notes-es" className="text-xs">
            {t("Notes (Spanish — optional)", "Notas (Español — opcional)")}
          </Label>
          <textarea
            id="ci-notes-es"
            rows={2}
            value={notesEs}
            onChange={(e) => setNotesEs(e.target.value)}
            data-testid="client-interaction-notes-es"
            className="mt-1 w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("Cancel", "Cancelar")}
          </Button>
          <Button type="submit" disabled={log.isPending} data-testid="client-interaction-submit">
            {log.isPending ? t("Saving…", "Guardando…") : t("Save", "Guardar")}
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}

// -----------------------------------------------------------------------------
// Asana task picker
// -----------------------------------------------------------------------------
function AsanaLinkModal({
  projectId,
  currentGid,
  onClose,
}: {
  projectId: string;
  currentGid: string | null;
  onClose: () => void;
}) {
  const { t } = useLang();
  const { toast } = useToast();
  const qc = useQueryClient();
  const candidates = useListProjectAsanaCandidates(projectId, {
    query: { queryKey: [`/api/projects/${projectId}/asana-candidates`] },
  });
  const link = useLinkProjectToAsanaTask();
  const [manualGid, setManualGid] = useState<string>(currentGid ?? "");

  const submit = async (gid: string) => {
    if (!gid.trim()) return;
    try {
      await link.mutateAsync({ projectId, data: { asanaGid: gid.trim() } });
      await qc.invalidateQueries({ queryKey: [`/api/projects/${projectId}`] });
      await qc.invalidateQueries({ queryKey: [`/api/projects/${projectId}/pre-design`] });
      toast({ title: t("Linked", "Vinculado") });
      onClose();
    } catch {
      toast({ title: t("Could not link", "No se pudo vincular"), variant: "destructive" });
    }
  };

  return (
    <ModalShell title={t("Link to Asana task", "Vincular tarea Asana")} onClose={onClose} testId="asana-link-modal">
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          {t(
            "Pick a candidate from your board, or paste a task gid manually.",
            "Selecciona un candidato del tablero o pega el gid manualmente.",
          )}
        </p>

        <div className="border border-border rounded-md max-h-56 overflow-y-auto" data-testid="asana-candidates">
          {candidates.isLoading && (
            <div className="px-3 py-3 text-xs text-muted-foreground flex items-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin" />
              {t("Loading candidates…", "Cargando candidatos…")}
            </div>
          )}
          {!candidates.isLoading && (candidates.data?.candidates?.length ?? 0) === 0 && (
            <div className="px-3 py-3 text-xs text-muted-foreground">
              {t("No matching tasks found.", "No se encontraron tareas coincidentes.")}
            </div>
          )}
          {(candidates.data?.candidates ?? []).map((c) => (
            <button
              key={c.gid}
              type="button"
              onClick={() => void submit(c.gid)}
              disabled={link.isPending}
              data-testid={`asana-candidate-${c.gid}`}
              className="w-full text-left px-3 py-2 text-sm border-b border-border last:border-0 hover:bg-muted flex items-center justify-between gap-2"
            >
              <span className="truncate">{c.name}</span>
              <span className="text-[10px] text-muted-foreground shrink-0">{c.gid}</span>
              {currentGid === c.gid && <CheckCircle2 className="w-3.5 h-3.5 text-konti-olive shrink-0" />}
            </button>
          ))}
        </div>

        <div>
          <Label htmlFor="asana-manual-gid" className="text-xs">
            {t("Or paste a task gid", "O pega el gid de una tarea")}
          </Label>
          <div className="mt-1 flex gap-2">
            <Input
              id="asana-manual-gid"
              value={manualGid}
              onChange={(e) => setManualGid(e.target.value)}
              placeholder="1209876543210"
              data-testid="asana-manual-gid"
              className="flex-1"
            />
            <Button
              type="button"
              onClick={() => void submit(manualGid)}
              disabled={link.isPending || !manualGid.trim()}
              data-testid="asana-manual-link-submit"
            >
              {t("Link", "Vincular")}
            </Button>
          </div>
        </div>
      </div>
    </ModalShell>
  );
}
