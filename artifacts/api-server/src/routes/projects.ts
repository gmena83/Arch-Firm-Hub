import { Router, type IRouter } from "express";
import {
  PROJECTS,
  PROJECT_TASKS,
  WEATHER_DATA,
  DOCUMENTS,
  CALCULATOR_ENTRIES,
  MATERIALS,
  PRE_DESIGN_CHECKLISTS,
  PROJECT_ACTIVITIES,
  PROJECT_STRUCTURED_VARS,
  PROJECT_ASSISTED_BUDGETS,
  WEEKLY_REPORTS,
  PHASE_ORDER,
  appendActivity,
  computeAssistedBudget,
  PROJECT_DESIGN_STATE,
  DESIGN_SUB_PHASE_ORDER,
  DESIGN_SUB_PHASE_LABELS,
  PROJECT_PROPOSALS,
  PROJECT_CHANGE_ORDERS,
  PROJECT_PERMIT_AUTHORIZATIONS,
  PROJECT_REQUIRED_SIGNATURES,
  PROJECT_PERMIT_ITEMS,
  PERMIT_ITEM_STATE_ORDER,
  PROJECT_COST_PLUS,
  PROJECT_INVOICES,
  PROJECT_CONTRACTOR_MONITORING,
  PROJECT_INSPECTIONS,
  STRUCTURAL_ENGINEERS,
  PROJECT_MILESTONES,
  type Inspection,
  type InspectionType,
  type InspectionStatus,
  type Milestone,
  type MilestoneStatus,
  type ChecklistStatus,
  type DesignSubPhase,
  type DesignDeliverableStatus,
  type ChangeOrder,
  type PermitItemState,
  PROJECT_PUNCHLIST,
  punchlistKey,
  getPunchlistForPhase,
  countOpenPunchlistItems,
  PUNCHLIST_STATUSES,
  type PunchlistItem,
  type PunchlistItemStatus,
} from "../data/seed";
import { savePunchlist } from "../data/punchlist-store";
import { requireRole } from "../middlewares/require-role";
import { getManagedSecret } from "../lib/managed-secrets";
import { EXTRA_MATERIALS, PROJECT_REPORT_TEMPLATE, PROJECT_CONTRACTOR_ESTIMATE, type ContractorEstimateLine, type ReportTemplate } from "./estimating";
import { getAsanaConfig, isAsanaEnabled, isDriveEnabled } from "../lib/integrations-config";
import { listTasksForProject, AsanaNotConnectedError, AsanaApiError } from "../lib/asana-client";
import {
  uploadDocumentToDrive,
  deleteDocumentFromDrive,
  applyVisibilityToDrive,
} from "../lib/drive-sync";

const router: IRouter = Router();

// Phase labels for UI sync — mirrors PHASE_LABELS_MAP in seed.ts
import { PHASE_LABELS_MAP } from "../data/seed";
import { rollupRecordByBucket } from "@workspace/report-categories";
const PHASE_LABELS = PHASE_LABELS_MAP;

const VALID_CHECKLIST_STATUS: ChecklistStatus[] = ["pending", "in_progress", "done"];
const VALID_PROJECT_TYPES = ["residencial", "comercial", "mixto", "contenedor"] as const;
const VALID_ZONING = /^[A-Z]{1,3}-[0-9]{1,2}$/;

// Shared ownership gate. Implementation lives in
// middlewares/client-ownership.ts so estimating.ts can reuse it without
// creating a circular import with this routes file. Re-exported here so
// callers that previously imported from this module keep working.
import { enforceClientOwnership } from "../middlewares/client-ownership";
export { enforceClientOwnership };

// HTML escaping for any value that ends up inside the PDF report template
// to keep saved template strings (header/footer/columns) and project fields
// from breaking the markup or injecting tags.
function escapeHtml(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Render a cost-report table for the PDF using the template's column list
// against the saved contractor estimate (if any). Unknown column names render
// as empty cells so KONTi can use any header text without crashing the export.
function renderTemplateCostReport(
  template: ReportTemplate,
  estimate: { lines: ContractorEstimateLine[]; grandTotal: number } | undefined,
): string {
  if (!estimate || template.columns.length === 0) return "";
  const lookups: Record<string, (l: ContractorEstimateLine) => string> = {
    category: (l) => l.category,
    item: (l) => l.description,
    description: (l) => l.description,
    qty: (l) => String(l.quantity),
    quantity: (l) => String(l.quantity),
    unit: (l) => l.unit,
    "unit price": (l) => `$${l.unitPrice.toFixed(2)}`,
    price: (l) => `$${l.unitPrice.toFixed(2)}`,
    total: (l) => `$${l.lineTotal.toFixed(2)}`,
    "line total": (l) => `$${l.lineTotal.toFixed(2)}`,
  };
  const headerCells = template.columns
    .map((c) => `<th align="left" style="padding:4px 8px;border-bottom:1px solid #ccc;">${escapeHtml(c)}</th>`)
    .join("");
  const bodyRows = estimate.lines
    .map((line) => {
      const cells = template.columns
        .map((col) => {
          const fn = lookups[col.toLowerCase()];
          return `<td style="padding:4px 8px;border-bottom:1px solid #eee;">${escapeHtml(fn ? fn(line) : "")}</td>`;
        })
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");
  const grandTotalRow =
    `<tr><td colspan="${template.columns.length}" style="padding:6px 8px;text-align:right;font-weight:600;border-top:1px solid #999;">` +
    `Grand Total: $${estimate.grandTotal.toFixed(2)}</td></tr>`;
  return (
    `<h2>${escapeHtml(template.name)}</h2>` +
    `<table><thead><tr>${headerCells}</tr></thead>` +
    `<tbody>${bodyRows || `<tr><td colspan="${template.columns.length}" style="padding:8px;color:#888;">No estimate lines.</td></tr>`}${bodyRows ? grandTotalRow : ""}</tbody></table>`
  );
}

// Local helper retained for the PDF route at the bottom of this file.
function clientCanAccessProject(userId: string, projectId: string): boolean {
  const project = PROJECTS.find((p) => p.id === projectId) as { clientUserId?: string } | undefined;
  if (!project || !project.clientUserId) return false;
  return project.clientUserId === userId;
}

router.get("/projects", requireRole(["team", "admin", "superadmin", "architect", "client"]), (req, res) => {
  const user = (req as { user?: { id: string; role: string } }).user;
  if (user?.role === "client") {
    return res.json(PROJECTS.filter((p) => (p as { clientUserId?: string }).clientUserId === user.id));
  }
  return res.json(PROJECTS);
});

router.post("/projects", requireRole(["team", "admin", "superadmin"]), (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;

  const name = typeof body["name"] === "string" ? body["name"].trim() : "";
  const clientName = typeof body["clientName"] === "string" ? body["clientName"].trim() : "";
  const location = typeof body["location"] === "string" ? body["location"].trim() : "";
  const description = typeof body["description"] === "string" ? body["description"].trim() : "";
  const budgetAllocatedRaw = body["budgetAllocated"];
  const budgetAllocated = typeof budgetAllocatedRaw === "number" ? budgetAllocatedRaw : 0;
  const clientUserIdRaw = body["clientUserId"];
  const clientUserId = typeof clientUserIdRaw === "string" && clientUserIdRaw.length > 0 ? clientUserIdRaw : undefined;

  const fieldErrors: Record<string, string> = {};
  if (!name) fieldErrors["name"] = "required";
  if (!clientName) fieldErrors["clientName"] = "required";
  if (!location) fieldErrors["location"] = "required";
  if (typeof budgetAllocatedRaw !== "number" || !isFinite(budgetAllocated) || budgetAllocated < 0) {
    fieldErrors["budgetAllocated"] = "must be a non-negative number";
  }
  if (Object.keys(fieldErrors).length > 0) {
    return res.status(400).json({
      error: "invalid_payload",
      message: "Missing or invalid fields",
      messageEs: "Faltan campos requeridos o son inválidos",
      fields: fieldErrors,
    });
  }

  // Default new projects to "discovery" phase, mirroring the lead → project synthesis path.
  const phase = "discovery" as const;
  const labels = PHASE_LABELS[phase];
  const projectId = `proj-${Date.now()}`;
  const today = new Date().toISOString().slice(0, 10);
  const oneYearOut = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const newProject = {
    id: projectId,
    name,
    nameEs: name,
    clientName,
    location,
    city: location.split(",")[0]?.trim() ?? location,
    phase,
    phaseLabel: labels.en,
    phaseLabelEs: labels.es,
    phaseNumber: 1,
    progressPercent: 0,
    budgetAllocated,
    budgetUsed: 0,
    startDate: today,
    estimatedEndDate: oneYearOut,
    description: description || `New project for ${clientName}.`,
    coverImage: "https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=800&auto=format&fit=crop",
    asanaGid: `auto-${Date.now()}`,
    gammaReportUrl: `/projects/${projectId}/report`,
    teamMembers: [(req as { user?: { name?: string } }).user?.name ?? "Team"],
    status: "active" as const,
    ...(clientUserId ? { clientUserId } : {}),
    // B-05: project metadata defaults — team can refine on Project Detail.
    squareMeters: 0,
    bathrooms: 0,
    kitchens: 0,
    projectType: "residencial" as "residencial" | "comercial" | "mixto" | "contenedor",
    contingencyPercent: 8,
  };

  (PROJECTS as Array<typeof newProject>).push(newProject);

  appendActivity(projectId, {
    type: "phase_change",
    actor: (req as { user?: { name?: string } }).user?.name ?? "Team",
    description: `Project "${name}" created in Discovery phase`,
    descriptionEs: `Proyecto "${name}" creado en fase Descubrimiento`,
  });

  return res.status(201).json(newProject);
});

router.get("/projects/:projectId", requireRole(["team", "admin", "superadmin", "architect", "client"]), (req, res) => {
  const project = PROJECTS.find((p) => p.id === req.params["projectId"]);
  if (!project) {
    res.status(404).json({ error: "not_found", message: "Project not found" });
    return;
  }
  if (!enforceClientOwnership(req, res, req.params["projectId"] as string)) return;
  return res.json(project);
});

router.get("/projects/:projectId/tasks", requireRole(["team", "admin", "superadmin", "architect", "client"]), (req, res) => {
  if (!enforceClientOwnership(req, res, req.params["projectId"] as string)) return;
  const tasks = PROJECT_TASKS[req.params["projectId"] as keyof typeof PROJECT_TASKS] ?? [];
  return res.json(tasks);
});

router.get("/projects/:projectId/weather", (req, res) => {
  const weather = WEATHER_DATA[req.params["projectId"] as keyof typeof WEATHER_DATA];
  if (!weather) {
    res.status(404).json({ error: "not_found", message: "Weather data not found for project" });
    return;
  }
  return res.json({ ...weather, lastUpdated: new Date().toISOString() });
});

// Records document metadata for an upload. When Drive is connected and the
// caller supplies `fileBase64`, the bytes are streamed to the project's Drive
// sub-folder and only the Drive ID + viewer link are stored on the document
// record (no in-memory binary). Falls back to metadata-only when Drive is off
// or no payload was supplied so the demo stays usable disconnected.
router.post("/projects/:projectId/documents", requireRole(["team", "admin", "superadmin", "client"]), async (req, res) => {
  const projectId = req.params["projectId"] as string;
  const project = PROJECTS.find((p) => p.id === projectId);
  if (!project) {
    return res.status(404).json({ error: "not_found", message: "Project not found" });
  }
  // Clients may only upload to projects they own.
  if (!enforceClientOwnership(req, res, projectId)) return;
  const role = (req as { user?: { role?: string } }).user?.role;
  const isClient = role === "client";
  const body = (req.body ?? {}) as {
    name?: string; type?: string; category?: string; isClientVisible?: boolean;
    fileSize?: string; description?: string; mimeType?: string;
    photoCategory?: string; caption?: string; imageUrl?: string;
    /** Optional base64 payload (raw or data: URL) — when present and Drive is
     *  enabled, the bytes are streamed to Drive instead of held in memory. */
    fileBase64?: string;
  };
  if (typeof body.name !== "string" || body.name.length === 0 || body.name.length > 200) {
    return res.status(400).json({ error: "bad_request", message: "name required" });
  }
  const ALLOWED_CATEGORIES = [
    "client_review", "internal", "permits", "construction", "design",
    "contratos", "acuerdos_compra", "otros",
  ] as const;
  // Clients are locked to "client_review" + always client-visible.
  if (isClient) {
    body.category = "client_review";
    body.isClientVisible = true;
  }
  if (
    typeof body.category !== "string" ||
    !(ALLOWED_CATEGORIES as readonly string[]).includes(body.category)
  ) {
    return res.status(400).json({ error: "bad_request", message: "category required" });
  }
  // Normalize `type` to the Document.type enum (jpg/png → photo).
  const ALLOWED_TYPES = ["pdf", "excel", "pptx", "photo", "other"] as const;
  const ext = (body.name.split(".").pop() ?? "").toLowerCase();
  const inferTypeFromExt = (e: string): typeof ALLOWED_TYPES[number] => {
    if (e === "pdf") return "pdf";
    if (e === "xls" || e === "xlsx") return "excel";
    if (e === "ppt" || e === "pptx") return "pptx";
    if (e === "jpg" || e === "jpeg" || e === "png" || e === "gif" || e === "webp") return "photo";
    return "other";
  };
  const requestedType = typeof body.type === "string" ? body.type.toLowerCase() : "";
  const normalizedType: typeof ALLOWED_TYPES[number] =
    (ALLOWED_TYPES as readonly string[]).includes(requestedType)
      ? (requestedType as typeof ALLOWED_TYPES[number])
      : inferTypeFromExt(ext);
  // Photo-only fields (#105): require a photoCategory for image uploads so the
  // gallery has a stable bucket to file the photo under. caption/imageUrl are
  // both optional with a soft 500-char cap on caption to mirror the OpenAPI
  // contract and keep storage tidy.
  const PHOTO_CATEGORIES = [
    "site_conditions", "construction_progress", "punchlist_evidence", "final",
  ] as const;
  let photoCategory: typeof PHOTO_CATEGORIES[number] | undefined;
  if (normalizedType === "photo") {
    if (typeof body.photoCategory !== "string" || !(PHOTO_CATEGORIES as readonly string[]).includes(body.photoCategory)) {
      return res.status(400).json({ error: "bad_request", message: "photoCategory required for photo uploads" });
    }
    photoCategory = body.photoCategory as typeof PHOTO_CATEGORIES[number];
  }
  const caption = typeof body.caption === "string" ? body.caption.slice(0, 500) : undefined;
  // Restrict imageUrl to schemes the gallery actually renders (data: URLs from
  // the client uploader, or http(s) seed URLs). This prevents a malformed
  // payload from landing on the client as a broken <img src> or a javascript:
  // URL on a stricter renderer.
  let imageUrl: string | undefined;
  if (typeof body.imageUrl === "string" && body.imageUrl.length > 0) {
    if (/^data:image\//i.test(body.imageUrl) || /^https?:\/\//i.test(body.imageUrl)) {
      imageUrl = body.imageUrl;
    } else {
      return res.status(400).json({ error: "bad_request", message: "imageUrl must be a data:image/* or http(s) URL" });
    }
  }

  const list = (DOCUMENTS as Record<string, unknown[]>)[projectId] ?? [];
  const documentId = `doc-${projectId}-${list.length + 1}-${Date.now()}`;
  const isClientVisible = body.isClientVisible ?? true;

  // Drive upload (Task #128). Triggered when (a) the integration is on and
  // (b) we actually have bytes — either the caller's explicit fileBase64
  // field or the photo dropzone's data:URL imageUrl. Decoded once so the
  // body fragment we ship to Drive matches what the dashboard would render.
  const inboundBase64 =
    typeof body.fileBase64 === "string" && body.fileBase64.length > 0
      ? body.fileBase64
      : (imageUrl && /^data:[^;]+;base64,/.test(imageUrl) ? imageUrl : "");
  let driveFileId: string | undefined;
  let driveFolderId: string | undefined;
  let driveWebViewLink: string | undefined;
  let driveWebContentLink: string | undefined;
  let driveThumbnailLink: string | undefined;
  let storedImageUrl = imageUrl;
  if (isDriveEnabled() && inboundBase64) {
    // Strip the optional data:URL prefix to recover the raw base64 payload.
    const m = inboundBase64.match(/^data:([^;]+);base64,(.+)$/);
    const inferredMime = m ? m[1] : (body.mimeType || "application/octet-stream");
    const rawBase64 = m ? (m[2] ?? "") : inboundBase64;
    let buf: Buffer;
    try {
      buf = Buffer.from(rawBase64, "base64");
    } catch {
      return res.status(400).json({ error: "bad_request", message: "fileBase64 is not valid base64" });
    }
    if (buf.length === 0) {
      return res.status(400).json({ error: "bad_request", message: "fileBase64 decoded to empty payload" });
    }
    // Photos always live in the canonical `Site Photos` Drive folder (Task
     // #128 storage contract), regardless of which dashboard `category` the
     // upload was filed under. For non-photo documents the dashboard category
     // is preserved so admins can still slice by Permits / Contracts / etc.
    const driveCategory = normalizedType === "photo" ? "site_photos" : body.category;
    try {
      const result = await uploadDocumentToDrive({
        projectId,
        projectName: project.name,
        documentId,
        documentName: body.name,
        category: driveCategory,
        mimeType: inferredMime ?? "application/octet-stream",
        data: buf,
        isClientVisible,
      });
      driveFileId = result.driveFileId;
      driveFolderId = result.driveFolderId;
      driveWebViewLink = result.driveWebViewLink ?? undefined;
      driveWebContentLink = result.driveWebContentLink ?? undefined;
      driveThumbnailLink = result.driveThumbnailLink ?? undefined;
      // Once the file is in Drive we don't need the inline base64 — the
      // gallery prefers the Drive thumbnailLink and the lightbox uses the
      // webContentLink. Strip the heavy data:URL to keep the API response
      // (and persisted memory) small.
      if (storedImageUrl && /^data:/.test(storedImageUrl)) storedImageUrl = undefined;
    } catch (err) {
      // Hard failure on the Drive upload: do NOT half-record metadata. The
      // task acceptance criteria is "either the file is in Drive and metadata
      // is saved, or neither" — we surface a 502 and let the client retry.
      const status = err instanceof Error && (err as { status?: number }).status === 404 ? 404 : 502;
      return res.status(status).json({
        error: "drive_upload_failed",
        message: (err as Error).message ?? "Drive upload failed",
      });
    }
  }

  // Surface a proxied download URL (Task #128 step 6) so the dashboard
  // never needs to hand the browser a raw Drive `webContentLink`. The proxy
  // re-checks role + visibility on every request, which means revoking
  // client visibility instantly cuts off file access without waiting for
  // Drive's permission cache to roll over.
  const driveDownloadProxyUrl = driveFileId
    ? `/api/integrations/drive/files/${driveFileId}/download`
    : undefined;
  const doc = {
    id: documentId,
    projectId,
    name: body.name,
    type: normalizedType,
    category: body.category,
    isClientVisible,
    uploadedBy: (req as { user?: { id?: string } }).user?.id ?? "system",
    uploadedAt: new Date().toISOString(),
    fileSize: body.fileSize ?? "0 KB",
    mimeType: body.mimeType ?? "",
    description: body.description ?? "",
    ...(photoCategory ? { photoCategory } : {}),
    ...(caption ? { caption } : {}),
    ...(storedImageUrl ? { imageUrl: storedImageUrl } : {}),
    ...(driveFileId ? { driveFileId } : {}),
    ...(driveFolderId ? { driveFolderId } : {}),
    ...(driveWebViewLink ? { driveWebViewLink } : {}),
    ...(driveWebContentLink ? { driveWebContentLink } : {}),
    ...(driveThumbnailLink ? { driveThumbnailLink } : {}),
    ...(driveDownloadProxyUrl ? { driveDownloadProxyUrl } : {}),
  };
  (DOCUMENTS as Record<string, unknown[]>)[projectId] = [...list, doc];
  // Surface upload in the project timeline. Use a dedicated audit type when
  // the uploader is a client so the team's audit log can highlight it.
  const actor = (req as { user?: { name?: string } }).user?.name ?? (isClient ? "Client" : "Team");
  appendActivity(projectId, {
    type: isClient ? "client_upload" : "receipts_upload",
    actor,
    description: `Document "${doc.name}" uploaded to ${body.category}`,
    descriptionEs: `Documento "${doc.name}" subido a ${body.category}`,
  });
  return res.status(201).json(doc);
});

// Team-only: toggle document visibility (and other safe metadata fields).
router.patch(
  "/projects/:projectId/documents/:documentId",
  requireRole(["team", "admin", "superadmin"]),
  async (req, res) => {
    const projectId = req.params["projectId"] as string;
    const documentId = req.params["documentId"] as string;
    const project = PROJECTS.find((p) => p.id === projectId);
    if (!project) {
      return res.status(404).json({ error: "not_found", message: "Project not found" });
    }
    const list = (DOCUMENTS as Record<string, Array<{
      id: string; name: string; isClientVisible: boolean; driveFileId?: string;
    }>>)[projectId] ?? [];
    const doc = list.find((d) => d.id === documentId);
    if (!doc) return res.status(404).json({ error: "not_found", message: "Document not found" });
    const body = (req.body ?? {}) as { isClientVisible?: boolean };
    if (typeof body.isClientVisible !== "boolean") {
      return res.status(400).json({ error: "bad_request", message: "isClientVisible (boolean) required" });
    }
    const previous = doc.isClientVisible;
    const next = body.isClientVisible;
    let driveWarning: { en: string; es: string } | undefined;
    if (previous !== next) {
      doc.isClientVisible = next;
      const actor = (req as { user?: { name?: string } }).user?.name ?? "Team";
      const visEn = next ? "visible to client" : "hidden from client";
      const visEs = next ? "visible al cliente" : "oculto al cliente";
      appendActivity(projectId, {
        type: "document_visibility_change",
        actor,
        description: `Document "${doc.name}" marked ${visEn}`,
        descriptionEs: `Documento "${doc.name}" marcado ${visEs}`,
      });
      // Drive sharing propagation (Task #128) — non-blocking per spec step 7.
      // If the Drive call fails the dashboard's own visibility flag still
      // sticks; the user sees a warning and the failure is recorded in the
      // Drive sync log so an admin can resync later.
      if (doc.driveFileId && isDriveEnabled()) {
        const ok = await applyVisibilityToDrive({
          projectId,
          projectName: project.name,
          documentId: doc.id,
          documentName: doc.name,
          driveFileId: doc.driveFileId,
          isClientVisible: next,
        });
        if (!ok) {
          driveWarning = {
            en: "Visibility was updated in the dashboard but the Google Drive sharing change did not go through. Open the Drive integration sync log to retry.",
            es: "La visibilidad se actualizó en el panel pero el cambio de compartido en Google Drive no se aplicó. Abre el registro de sincronización de Drive para reintentar.",
          };
        }
      }
    }
    return res.json(driveWarning ? { ...doc, driveWarning } : doc);
  },
);

// Delete a single document. Team/admin/superadmin can remove any document; a
// client may only remove documents they uploaded themselves (matched on
// `uploadedBy === req.user.id`). Returns 204 on success and writes a
// `document_removed` activity entry so the timeline mirrors the upload event.
router.delete(
  "/projects/:projectId/documents/:documentId",
  requireRole(["team", "admin", "superadmin", "client"]),
  async (req, res) => {
    const projectId = req.params["projectId"] as string;
    const documentId = req.params["documentId"] as string;
    const project = PROJECTS.find((p) => p.id === projectId);
    if (!project) {
      return res.status(404).json({ error: "not_found", message: "Project not found" });
    }
    if (!enforceClientOwnership(req, res, projectId)) return;
    const list = (DOCUMENTS as Record<string, Array<{
      id: string; name: string; category: string; uploadedBy: string; driveFileId?: string;
    }>>)[projectId] ?? [];
    const idx = list.findIndex((d) => d.id === documentId);
    if (idx < 0) {
      return res.status(404).json({ error: "not_found", message: "Document not found" });
    }
    const doc = list[idx]!;
    const user = (req as { user?: { id?: string; role?: string; name?: string } }).user;
    const role = user?.role;
    const isClient = role === "client";
    if (isClient && doc.uploadedBy !== user?.id) {
      return res.status(403).json({
        error: "forbidden",
        message: "Clients can only delete documents they uploaded themselves",
      });
    }
    // Drive delete (Task #128) — non-blocking per spec step 5. We always
    // remove the dashboard's own metadata so the user's intent succeeds; if
    // the Drive-side delete fails we add a warning header so the UI can
    // surface the residue, and the failure is recorded in the Drive sync log.
    let driveWarning: { en: string; es: string } | undefined;
    if (doc.driveFileId && isDriveEnabled()) {
      const ok = await deleteDocumentFromDrive({
        projectId,
        projectName: project.name,
        documentId: doc.id,
        documentName: doc.name,
        driveFileId: doc.driveFileId,
      });
      if (!ok) {
        driveWarning = {
          en: "Document removed from the dashboard but the Google Drive copy could not be deleted. Open the Drive integration sync log to retry.",
          es: "El documento se eliminó del panel pero la copia en Google Drive no pudo eliminarse. Abre el registro de sincronización de Drive para reintentar.",
        };
      }
    }
    list.splice(idx, 1);
    (DOCUMENTS as Record<string, unknown[]>)[projectId] = list;
    const actor = user?.name ?? (isClient ? "Client" : "Team");
    appendActivity(projectId, {
      type: "document_removed",
      actor,
      description: `Document "${doc.name}" removed from ${doc.category}`,
      descriptionEs: `Documento "${doc.name}" eliminado de ${doc.category}`,
    });
    // 200 + warning body when Drive lagged so the UI can surface a toast;
    // otherwise the legacy 204 No Content (clients that already handle 204
    // continue to work).
    if (driveWarning) return res.status(200).json({ deleted: true, driveWarning });
    return res.status(204).end();
  },
);

// Documents listing — gated by role + ownership. Clients are server-side
// restricted to docs flagged isClientVisible so internal documents never
// leave the API even if the dashboard's filter is bypassed.
router.get(
  "/projects/:projectId/documents",
  requireRole(["team", "admin", "superadmin", "architect", "client"]),
  (req, res) => {
    const projectId = req.params["projectId"] as string;
    if (!enforceClientOwnership(req, res, projectId)) return;
    const role = (req as { user?: { role?: string } }).user?.role;
    const clientVisible = req.query["clientVisible"];
    let docs = (DOCUMENTS[projectId as keyof typeof DOCUMENTS] ?? []) as Array<{
      id: string; projectId: string; name: string; type: string; category: string;
      isClientVisible: boolean; uploadedBy: string; uploadedAt: string; fileSize: string; description: string;
    }>;

    if (role === "client") {
      // Hard guarantee: clients never see internal docs from this endpoint.
      docs = docs.filter((d) => d.isClientVisible);
    } else if (clientVisible === "true") {
      docs = docs.filter((d) => d.isClientVisible);
    } else if (clientVisible === "false") {
      docs = docs.filter((d) => !d.isClientVisible);
    }

    // Backfill `driveDownloadProxyUrl` (Task #128 step 6) for any document
    // that has a `driveFileId` but pre-dates the proxy. This keeps the
    // frontend rendering logic uniform across documents uploaded before and
    // after the proxy shipped.
    //
    // For client role we additionally STRIP the raw Drive URLs
    // (`driveWebViewLink`/`driveWebContentLink`/`driveThumbnailLink`) so the
    // browser never sees a link that bypasses the dashboard's proxy. Team /
    // admin / superadmin / architect still see the "Open in Drive" link
    // because it's helpful for their workflow.
    const decorated = docs.map((d) => {
      const record = d as Record<string, unknown>;
      const fileId = record["driveFileId"];
      let next: Record<string, unknown> = { ...record };
      if (typeof fileId === "string" && fileId.length > 0 && !record["driveDownloadProxyUrl"]) {
        next["driveDownloadProxyUrl"] = `/api/integrations/drive/files/${fileId}/download`;
      }
      if (role === "client") {
        delete next["driveWebViewLink"];
        delete next["driveWebContentLink"];
        delete next["driveThumbnailLink"];
      }
      return next;
    });

    return res.json(decorated);
  },
);

router.get("/projects/:projectId/calculations", requireRole(["team", "admin", "superadmin", "architect"]), (req, res) => {
  const projectId = req.params["projectId"];
  const entries = CALCULATOR_ENTRIES[projectId as keyof typeof CALCULATOR_ENTRIES] ?? [];

  const subtotalByCategory: Record<string, number> = {};
  let grandTotal = 0;

  for (const entry of entries) {
    subtotalByCategory[entry.category] = (subtotalByCategory[entry.category] ?? 0) + entry.lineTotal;
    grandTotal += entry.lineTotal;
  }

  // Roll the trade-level subtotals into the team's five canonical buckets so
  // the project report matches the PROJECT ESTIMATE spreadsheet structure.
  // All five keys are always returned (zero for empty buckets) so the client
  // can render the structure even before any line items are recorded.
  const bucketRollup = rollupRecordByBucket(subtotalByCategory);
  const subtotalByBucket: Record<string, number> = {};
  for (const row of bucketRollup) subtotalByBucket[row.key] = row.total;

  return res.json({
    projectId,
    entries,
    subtotalByCategory,
    subtotalByBucket,
    bucketRollup,
    grandTotal,
  });
});

// Client-safe rollup of the same calculations data. Returns ONLY the five
// canonical buckets (with optional trade-level sub-lines) and the grand
// total — never raw BOM line items, costs per material, or contractor
// margin. This is the read used by the project report so client viewers can
// see the same five-bucket structure the team emails them, without exposing
// internal estimate detail.
router.get(
  "/projects/:projectId/report-rollup",
  requireRole(["team", "admin", "superadmin", "architect", "client"]),
  (req, res) => {
    const projectId = req.params["projectId"] as string;
    if (!enforceClientOwnership(req, res, projectId)) return;
    const entries = CALCULATOR_ENTRIES[projectId as keyof typeof CALCULATOR_ENTRIES] ?? [];

    const subtotalByCategory: Record<string, number> = {};
    let grandTotal = 0;
    for (const entry of entries) {
      subtotalByCategory[entry.category] = (subtotalByCategory[entry.category] ?? 0) + entry.lineTotal;
      grandTotal += entry.lineTotal;
    }

    const bucketRollup = rollupRecordByBucket(subtotalByCategory);
    const subtotalByBucket: Record<string, number> = {};
    for (const row of bucketRollup) subtotalByBucket[row.key] = row.total;

    return res.json({
      projectId,
      subtotalByBucket,
      bucketRollup,
      grandTotal,
    });
  },
);

// Inline-edit a calculator line (quantity, base price, manual override).
// Recomputes effectivePrice and lineTotal server-side so the report rollup
// always sees consistent values.
router.patch(
  "/projects/:projectId/calculations/:lineId",
  requireRole(["team", "admin", "superadmin", "architect"]),
  (req, res) => {
    const projectId = req.params["projectId"] as string;
    const lineId = req.params["lineId"] as string;
    const list = CALCULATOR_ENTRIES[projectId as keyof typeof CALCULATOR_ENTRIES] as
      | Array<Record<string, unknown>>
      | undefined;
    if (!list) return res.status(404).json({ error: "project_not_found" });
    const entry = list.find((e) => (e["id"] as string) === lineId);
    if (!entry) return res.status(404).json({ error: "line_not_found" });

    const body = (req.body ?? {}) as {
      quantity?: number | string;
      basePrice?: number | string;
      manualPriceOverride?: number | string | null;
    };

    const toNum = (v: unknown): number | null => {
      if (v === null || v === undefined || v === "") return null;
      const n = typeof v === "number" ? v : Number(v);
      return Number.isFinite(n) ? n : null;
    };

    if (body.quantity !== undefined) {
      const q = toNum(body.quantity);
      if (q === null || q < 0) return res.status(400).json({ error: "invalid_quantity" });
      entry["quantity"] = q;
    }
    if (body.basePrice !== undefined) {
      const bp = toNum(body.basePrice);
      if (bp === null || bp < 0) return res.status(400).json({ error: "invalid_base_price" });
      entry["basePrice"] = bp;
    }
    if (body.manualPriceOverride !== undefined) {
      if (body.manualPriceOverride === null || body.manualPriceOverride === "") {
        entry["manualPriceOverride"] = null;
      } else {
        const ov = toNum(body.manualPriceOverride);
        if (ov === null || ov < 0) return res.status(400).json({ error: "invalid_override" });
        entry["manualPriceOverride"] = ov;
      }
    }

    const basePrice = (entry["basePrice"] as number) ?? 0;
    const override = entry["manualPriceOverride"] as number | null;
    const quantity = (entry["quantity"] as number) ?? 0;
    const effective = override !== null && override !== undefined ? override : basePrice;
    entry["effectivePrice"] = effective;
    entry["lineTotal"] = Math.round(effective * quantity * 100) / 100;

    appendActivity(projectId, {
      type: "calculator_line_updated",
      actor: (req as { user?: { name?: string } }).user?.name ?? "Team",
      description: `Calculator line "${entry["materialName"] ?? lineId}" updated`,
      descriptionEs: `Línea de calculadora "${entry["materialNameEs"] ?? entry["materialName"] ?? lineId}" actualizada`,
    });

    return res.json({ entry });
  },
);

router.get("/materials", (req, res) => {
  const category = req.query["category"] as string | undefined;
  const all = [...MATERIALS, ...EXTRA_MATERIALS];
  const materials = category ? all.filter((m) => m.category === category) : all;
  return res.json(materials);
});

let cachedPrices: { prices: Array<{ id: string; item: string; suggestedPrice: number; source: string }>; refreshedAt: string; source: string; cached: boolean } | null = null;
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 30 * 60 * 1000;

router.post("/materials/prices/refresh", requireRole(["team", "admin", "superadmin", "architect"]), async (req, res) => {
  const perplexityKey = process.env["PERPLEXITY_API_KEY"];
  if (!perplexityKey) {
    res.status(501).json({ error: "perplexity_not_configured", message: "Perplexity API key not configured" });
    return;
  }

  const category = req.query["category"] as string | undefined;

  if (!category && cachedPrices && Date.now() < cacheExpiresAt) {
    res.json({ ...cachedPrices, cached: true });
    return;
  }

  const filteredMaterials = category
    ? MATERIALS.filter((m) => m.category === category)
    : MATERIALS;

  const materialList = filteredMaterials
    .map((m) => `- ${m.id}: ${m.item} (unit: ${m.unit})`)
    .join("\n");

  const prompt = `You are a construction materials pricing assistant for Puerto Rico. Look up current retail prices from Home Depot (USA/Puerto Rico) for each of the following construction materials. Return a JSON array only, no markdown, no explanation.

For each material, return an object with:
- "id": the exact ID provided
- "item": the material name
- "suggestedPrice": a realistic current retail price (number, in USD)
- "source": "Home Depot (estimated)"

Materials to price:
${materialList}

Respond with ONLY a valid JSON array. No code fences. No extra text.`;

  try {
    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${perplexityKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          { role: "system", content: "You are a construction materials pricing assistant. Always respond with valid JSON arrays only." },
          { role: "user", content: prompt },
        ],
        max_tokens: 2000,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      req.log.error({ status: response.status, errText }, "Perplexity API error");
      res.status(502).json({ error: "perplexity_error", message: "Perplexity API request failed" });
      return;
    }

    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content ?? "";

    let rawPrices: unknown[] = [];
    try {
      const cleaned = content.replace(/```json|```/g, "").trim();
      rawPrices = JSON.parse(cleaned);
      if (!Array.isArray(rawPrices)) throw new Error("Not an array");
    } catch {
      req.log.error({ content }, "Failed to parse Perplexity response as JSON");
      res.status(502).json({ error: "parse_error", message: "Could not parse pricing data from AI response" });
      return;
    }

    const knownIds = new Set(filteredMaterials.map((m) => m.id));
    const prices: Array<{ id: string; item: string; suggestedPrice: number; source: string }> = [];
    for (const entry of rawPrices) {
      if (
        typeof entry !== "object" || entry === null ||
        typeof (entry as Record<string, unknown>)["id"] !== "string" ||
        typeof (entry as Record<string, unknown>)["item"] !== "string" ||
        typeof (entry as Record<string, unknown>)["suggestedPrice"] !== "number" ||
        !isFinite((entry as Record<string, unknown>)["suggestedPrice"] as number) ||
        (entry as Record<string, unknown>)["suggestedPrice"] as number <= 0 ||
        !knownIds.has((entry as Record<string, unknown>)["id"] as string)
      ) {
        req.log.warn({ entry }, "Skipping invalid price entry from Perplexity");
        continue;
      }
      prices.push({
        id: (entry as Record<string, unknown>)["id"] as string,
        item: (entry as Record<string, unknown>)["item"] as string,
        suggestedPrice: (entry as Record<string, unknown>)["suggestedPrice"] as number,
        source: typeof (entry as Record<string, unknown>)["source"] === "string"
          ? (entry as Record<string, unknown>)["source"] as string
          : "Home Depot (estimated)",
      });
    }

    if (prices.length === 0) {
      req.log.error({ content }, "No valid prices returned from Perplexity");
      res.status(502).json({ error: "parse_error", message: "No valid prices returned from AI" });
      return;
    }

    const result = {
      prices,
      refreshedAt: new Date().toISOString(),
      source: "Home Depot via Perplexity AI (sonar) · Prices sourced from public listings",
      cached: false,
    };

    if (!category) {
      cachedPrices = result;
      cacheExpiresAt = Date.now() + CACHE_TTL_MS;
    }

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Perplexity fetch error");
    res.status(502).json({ error: "perplexity_error", message: "Failed to reach Perplexity API" });
  }
});

router.post("/projects/:id/pdf", requireRole(["team", "admin", "superadmin", "architect", "client"]), async (req, res) => {
  const project = PROJECTS.find((p) => p.id === req.params["id"]);
  if (!project) {
    res.status(404).json({ error: "not_found", message: "Project not found" });
    return;
  }

  if (!enforceClientOwnership(req, res, project.id)) return;

  const pdfApiKey = getManagedSecret("PDF_CO_API_KEY");
  if (!pdfApiKey) {
    res.status(501).json({ error: "pdf_not_configured", message: "PDF export not configured" });
    return;
  }

  // Render the status report HTML server-side so the PDF renderer doesn't
  // depend on an authenticated SPA load (the previous URL-based path would
  // have pdf.co fetch the dashboard unauthenticated and rasterize the login
  // screen). HTML contains: project name, phase, location, generated date,
  // status summary, signature block.
  const rawTasks = (PROJECT_TASKS[project.id as keyof typeof PROJECT_TASKS] ?? []) as ReadonlyArray<Record<string, unknown>>;
  const tasks: Array<{ title: string; status: string; phase?: string; assignee?: string }> =
    rawTasks.map((t) => ({
      title: String(t["title"] ?? ""),
      status: String(t["status"] ?? (t["completed"] ? "done" : "open")),
      phase: typeof t["phase"] === "string" ? (t["phase"] as string) : undefined,
      assignee: typeof t["assignee"] === "string" ? (t["assignee"] as string) : undefined,
    }));
  const docs = ((DOCUMENTS as Record<string, unknown[]>)[project.id] ?? []) as Array<{
    name: string; category: string; uploadedAt: string;
  }>;
  const phaseLabel = String(project.phase ?? "discovery").replace(/_/g, " ").toUpperCase();
  // Honor a client-supplied report date (#C-10) when present and shaped as
  // yyyy-mm-dd so the PDF matches what the team configured in the in-app
  // report header. Fall back to "now" in PR time otherwise.
  const requestedDate = (req.body && typeof req.body === "object")
    ? (req.body as Record<string, unknown>)["reportDate"]
    : undefined;
  let generatedAt: string;
  if (typeof requestedDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) {
    // Parse as PR-local midnight so the displayed date matches the picker.
    const d = new Date(`${requestedDate}T12:00:00-04:00`);
    generatedAt = isNaN(d.getTime())
      ? new Date().toLocaleString("en-US", { timeZone: "America/Puerto_Rico" })
      : d.toLocaleDateString("en-US", { timeZone: "America/Puerto_Rico", year: "numeric", month: "long", day: "numeric" });
  } else {
    generatedAt = new Date().toLocaleString("en-US", { timeZone: "America/Puerto_Rico" });
  }
  const taskRows = tasks.slice(0, 12).map((t) =>
    `<tr><td style="padding:4px 8px;border-bottom:1px solid #eee;">${escapeHtml(t.title)}</td>` +
    `<td style="padding:4px 8px;border-bottom:1px solid #eee;color:#666;">${escapeHtml(t.phase ?? "")}</td>` +
    `<td style="padding:4px 8px;border-bottom:1px solid #eee;">${escapeHtml(t.status)}</td></tr>`).join("");
  const docRows = docs.slice(0, 20).map((d) =>
    `<tr><td style="padding:4px 8px;border-bottom:1px solid #eee;">${escapeHtml(d.name)}</td>` +
    `<td style="padding:4px 8px;border-bottom:1px solid #eee;color:#666;">${escapeHtml(d.category)}</td></tr>`).join("");

  // Saved report template (if any) overrides the default header/footer and
  // adds a Cost Report table built from the saved contractor estimate using
  // the template's column list. When no template exists, fall back to the
  // hard-coded default layout.
  const template: ReportTemplate | undefined = PROJECT_REPORT_TEMPLATE[project.id];
  const estimate = PROJECT_CONTRACTOR_ESTIMATE[project.id];

  const defaultHeaderHtml =
    `<h1>KONTi Project Status Report</h1>` +
    `<div class="meta"><b>Project:</b> ${escapeHtml(project.name)}<br>` +
    `<b>Location:</b> ${escapeHtml(project.location ?? "—")}<br>` +
    `<b>Phase:</b> ${escapeHtml(phaseLabel)}<br>` +
    `<b>Date:</b> ${escapeHtml(generatedAt)}</div>`;
  const defaultFooterHtml =
    `<div class="sig"><b>Authorized Signature</b><br>KONTi Project Lead</div>`;

  let headerHtml = defaultHeaderHtml;
  let footerHtml = defaultFooterHtml;
  let costReportHtml = "";

  if (template) {
    const [titleLine, ...metaLines] = template.headerLines.length > 0
      ? template.headerLines
      : ["KONTi Project Status Report"];
    const metaHtml = [
      ...metaLines.map((l) => escapeHtml(l)),
      `<b>Phase:</b> ${escapeHtml(phaseLabel)}`,
      `<b>Date:</b> ${escapeHtml(generatedAt)}`,
    ].join("<br>");
    headerHtml =
      `<h1>${escapeHtml(titleLine ?? project.name)}</h1>` +
      `<div class="meta">${metaHtml}</div>`;
    footerHtml = `<div class="footer">${escapeHtml(template.footer)}</div>`;
    costReportHtml = renderTemplateCostReport(template, estimate);
  }

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>KONTi Status Report — ${escapeHtml(project.name)}</title>` +
    `<style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#222;margin:32px;}` +
    `h1{color:#4F5E2A;margin:0 0 4px;}h2{font-size:14px;margin:24px 0 8px;color:#333;border-bottom:1px solid #ddd;padding-bottom:4px;}` +
    `.meta{color:#555;font-size:12px;margin:8px 0 16px;}.meta b{color:#222;}` +
    `table{width:100%;border-collapse:collapse;font-size:12px;}` +
    `.sig{margin-top:48px;border-top:1px solid #999;padding-top:8px;width:300px;font-size:12px;color:#444;}` +
    `.footer{margin-top:48px;border-top:1px solid #999;padding-top:8px;font-size:11px;color:#444;text-align:center;}</style></head><body>` +
    headerHtml +
    `<h2>Open Tasks (${tasks.length} total)</h2>` +
    `<table><thead><tr><th align="left" style="padding:4px 8px;border-bottom:1px solid #ccc;">Task</th>` +
    `<th align="left" style="padding:4px 8px;border-bottom:1px solid #ccc;">Phase</th>` +
    `<th align="left" style="padding:4px 8px;border-bottom:1px solid #ccc;">Status</th></tr></thead>` +
    `<tbody>${taskRows || '<tr><td colspan=3 style="padding:8px;color:#888;">No tasks recorded.</td></tr>'}</tbody></table>` +
    `<h2>Documents on file (${docs.length})</h2>` +
    `<table><thead><tr><th align="left" style="padding:4px 8px;border-bottom:1px solid #ccc;">Name</th>` +
    `<th align="left" style="padding:4px 8px;border-bottom:1px solid #ccc;">Category</th></tr></thead>` +
    `<tbody>${docRows || '<tr><td colspan=2 style="padding:8px;color:#888;">No documents on file.</td></tr>'}</tbody></table>` +
    costReportHtml +
    footerHtml +
    `</body></html>`;

  try {
    const pdfResponse = await fetch("https://api.pdf.co/v1/pdf/convert/from/html", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": pdfApiKey,
      },
      body: JSON.stringify({
        html,
        name: `KONTi-Report-${project.name.replace(/\s+/g, "-")}.pdf`,
        async: false,
        printBackground: true,
        landscape: false,
        paperSize: "Letter",
      }),
    });

    if (!pdfResponse.ok) {
      req.log.error({ status: pdfResponse.status }, "PDF.co API request failed");
      res.status(500).json({ error: "pdf_error", message: "PDF generation failed" });
      return;
    }

    const pdfData = await pdfResponse.json() as { url?: string; error?: boolean; message?: string };

    if (!pdfData.url || pdfData.error) {
      req.log.error({ pdfData }, "PDF.co did not return a URL");
      res.status(500).json({ error: "pdf_error", message: "PDF generation failed" });
      return;
    }

    const fileResponse = await fetch(pdfData.url);
    if (!fileResponse.ok || !fileResponse.body) {
      res.status(500).json({ error: "pdf_download_error", message: "Failed to fetch generated PDF" });
      return;
    }

    const safeName = project.name.replace(/[^a-zA-Z0-9\-_]/g, "-");
    // Buffer the rendered PDF so we can ship it to the user and also archive
    // it to Drive. Reports are typically <1 MB so the memory cost is fine,
    // and buffering avoids tee-ing a Readable stream into two consumers.
    const pdfBytes = Buffer.from(await fileResponse.arrayBuffer());
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="KONTi-Report-${safeName}.pdf"`);
    res.send(pdfBytes);

    // Drive archive copy (Task #128 step 6) — fire-and-forget so the
    // response to the user is not delayed by the Drive round-trip. Failures
    // are intentionally swallowed; the Drive sync log is the ledger of
    // record so admins can re-run reports if a copy was missed.
    if (isDriveEnabled()) {
      const reportName = `KONTi-Report-${safeName}-${generatedAt.replace(/[/,:\s]/g, "-")}.pdf`;
      void uploadDocumentToDrive({
        projectId: project.id,
        projectName: project.name,
        documentId: `report-${Date.now()}`,
        documentName: reportName,
        category: "reports",
        mimeType: "application/pdf",
        data: pdfBytes,
        isClientVisible: false,
      }).catch(() => {
        /* logged inside drive-sync */
      });
    }
  } catch (err) {
    req.log.error({ err }, "PDF export error");
    res.status(500).json({ error: "pdf_error", message: "PDF generation failed" });
  }
});

// ---------------------------------------------------------------------------
// Phase 2 — Pre-Design & Viability endpoints
// ---------------------------------------------------------------------------

router.get("/projects/:id/pre-design", requireRole(["team", "client"]), (req, res) => {
  const project = PROJECTS.find((p) => p.id === req.params["id"]);
  if (!project) return res.status(404).json({ error: "not_found" });
  const user = (req as { user?: { id: string; role: string } }).user;
  if (user?.role === "client" && !clientCanAccessProject(user.id, project.id)) {
    return res.status(403).json({ error: "forbidden", message: "Client cannot access this project" });
  }
  return res.json({
    projectId: project.id,
    checklist: PRE_DESIGN_CHECKLISTS[project.id] ?? [],
    structuredVariables: PROJECT_STRUCTURED_VARS[project.id] ?? null,
    assistedBudgetRange: PROJECT_ASSISTED_BUDGETS[project.id] ?? null,
    weeklyReports: WEEKLY_REPORTS[project.id] ?? [],
    activities: PROJECT_ACTIVITIES[project.id] ?? [],
  });
});

router.post("/projects/:id/checklist-toggle", requireRole(["team", "admin", "superadmin"]), (req, res) => {
  const { itemId, status } = req.body ?? {};
  if (typeof itemId !== "string" || !VALID_CHECKLIST_STATUS.includes(status)) {
    return res.status(400).json({ error: "invalid_payload", message: "itemId (string) and status (pending|in_progress|done) required" });
  }
  const project = PROJECTS.find((p) => p.id === req.params["id"]);
  if (!project) return res.status(404).json({ error: "not_found" });
  const list = PRE_DESIGN_CHECKLISTS[project.id];
  if (!list) return res.status(404).json({ error: "no_checklist" });
  const item = list.find((c) => c.id === itemId);
  if (!item) return res.status(404).json({ error: "item_not_found" });
  item.status = status;
  item.completedAt = status === "done" ? new Date().toISOString() : undefined;
  appendActivity(project.id, {
    type: "checklist_toggle",
    actor: (req as { user?: { name?: string } }).user?.name ?? "Team",
    description: `Checklist item "${item.label}" → ${status}`,
    descriptionEs: `Tarea "${item.labelEs}" → ${status}`,
  });
  return res.json({ projectId: project.id, item });
});

router.post("/projects/:id/structured-variables", requireRole(["admin", "superadmin"]), (req, res) => {
  const { squareMeters, zoningCode, projectType } = req.body ?? {};
  if (typeof squareMeters !== "number" || squareMeters <= 0 || squareMeters > 100000) {
    return res.status(400).json({ error: "invalid_square_meters" });
  }
  if (typeof zoningCode !== "string" || !VALID_ZONING.test(zoningCode)) {
    return res.status(400).json({ error: "invalid_zoning_code", message: "Format: R-3, C-2, etc." });
  }
  if (!VALID_PROJECT_TYPES.includes(projectType)) {
    return res.status(400).json({ error: "invalid_project_type" });
  }
  const project = PROJECTS.find((p) => p.id === req.params["id"]);
  if (!project) return res.status(404).json({ error: "not_found" });

  const actor = (req as { user?: { name?: string } }).user?.name ?? "Team";
  const vars = {
    squareMeters,
    zoningCode,
    projectType,
    submittedAt: new Date().toISOString(),
    submittedBy: actor,
  };
  PROJECT_STRUCTURED_VARS[project.id] = vars;
  const budget = computeAssistedBudget(vars);
  PROJECT_ASSISTED_BUDGETS[project.id] = budget;
  appendActivity(project.id, {
    type: "structured_variables",
    actor,
    description: `Structured variables saved: ${squareMeters} m², ${zoningCode}, ${projectType}`,
    descriptionEs: `Variables estructuradas guardadas: ${squareMeters} m², ${zoningCode}, ${projectType}`,
  });
  return res.json({ projectId: project.id, structuredVariables: vars, assistedBudgetRange: budget });
});

router.post("/projects/:id/advance-phase", requireRole(["team", "client"]), (req, res) => {
  const project = PROJECTS.find((p) => p.id === req.params["id"]);
  if (!project) return res.status(404).json({ error: "not_found" });
  const user = (req as { user?: { id: string; name?: string; role?: string } }).user;
  const isClient = user?.role === "client";

  // Ownership gate first — non-owning clients should get 403 regardless of
  // project state, so we don't leak phase information to unauthorized callers.
  if (!enforceClientOwnership(req, res, project.id)) return;

  const idx = PHASE_ORDER.indexOf(project.phase);
  if (idx === -1 || idx >= PHASE_ORDER.length - 1) {
    return res.status(400).json({ error: "cannot_advance", message: "Project is already in final phase" });
  }

  // Client gate: clients may only approve the consultation → pre_design transition.
  if (isClient && project.phase !== "consultation") {
    return res.status(400).json({ error: "client_gate_invalid", message: "Clients may only approve the consultation gate" });
  }

  // Punchlist gate: refuse if any non-done, non-waived items remain in the
  // current phase. Returns a structured payload so the UI can render the
  // bilingual reason and link to the open items.
  const openItems = getPunchlistForPhase(project.id, project.phase).filter(
    (i) => i.status !== "done" && i.status !== "waived",
  );
  if (openItems.length > 0) {
    return res.status(400).json({
      error: "punchlist_open",
      message: `Phase has ${openItems.length} open punchlist item(s). Complete or waive them first.`,
      messageEs: `La fase tiene ${openItems.length} ítem(s) de punchlist abiertos. Compleétalos o renúncialos primero.`,
      openCount: openItems.length,
      openItems: openItems.map((i) => ({ id: i.id, label: i.label, labelEs: i.labelEs, status: i.status })),
    });
  }

  const nextPhase = PHASE_ORDER[idx + 1];
  const labels = PHASE_LABELS[nextPhase];
  (project as { phase: typeof nextPhase }).phase = nextPhase;
  (project as { phaseLabel: string }).phaseLabel = labels.en;
  (project as { phaseLabelEs: string }).phaseLabelEs = labels.es;
  (project as { phaseNumber: number }).phaseNumber = idx + 2;

  const actor = user?.name ?? "Client";
  appendActivity(project.id, {
    type: "phase_change",
    actor,
    description: `Phase advanced to ${labels.en}${isClient ? " (client decision)" : ""}`,
    descriptionEs: `Fase avanzada a ${labels.es}${isClient ? " (decisión del cliente)" : ""}`,
  });

  // Simulate the automated comms that follow a client-approved consultation
  if (isClient) {
    appendActivity(project.id, {
      type: "email_sent",
      actor: "System",
      description: "Pre-Design kickoff email sent to client and team",
      descriptionEs: "Correo de inicio de Pre-Diseño enviado al cliente y al equipo",
    });
    appendActivity(project.id, {
      type: "invoice_sent",
      actor: "System",
      description: "Pre-Design & Viability Study invoice issued",
      descriptionEs: "Factura del Estudio de Pre-Diseño y Viabilidad emitida",
    });
  }

  return res.json({ project, advancedTo: nextPhase });
});

router.post("/projects/:id/decline-phase", requireRole(["client"]), (req, res) => {
  const project = PROJECTS.find((p) => p.id === req.params["id"]);
  if (!project) return res.status(404).json({ error: "not_found" });
  const { reason } = req.body ?? {};
  const user = (req as { user?: { id: string; name?: string } }).user;
  if (!enforceClientOwnership(req, res, project.id)) return;
  if (project.phase !== "consultation") {
    return res.status(400).json({ error: "client_gate_invalid", message: "Decline only available at the consultation gate" });
  }
  const note = typeof reason === "string" && reason.trim().length > 0 ? `: ${reason.trim().slice(0, 200)}` : "";
  appendActivity(project.id, {
    type: "phase_change",
    actor: user?.name ?? "Client",
    description: `Client declined to advance to Pre-Design${note}`,
    descriptionEs: `El cliente no aprobó avanzar a Pre-Diseño${note}`,
  });
  appendActivity(project.id, {
    type: "email_sent",
    actor: "System",
    description: "Internal team notified of client decline",
    descriptionEs: "Equipo interno notificado del rechazo del cliente",
  });
  return res.json({ project, declinedAt: new Date().toISOString() });
});

// ---------------------------------------------------------------------------
// Phase Punchlist — phase advancement gate
// ---------------------------------------------------------------------------

router.get("/projects/:id/punchlist", requireRole(["team", "client"]), (req, res) => {
  const project = PROJECTS.find((p) => p.id === req.params["id"]);
  if (!project) return res.status(404).json({ error: "not_found" });
  if (!enforceClientOwnership(req, res, project.id)) return;
  const phaseFilter = typeof req.query["phase"] === "string" ? (req.query["phase"] as string) : project.phase;
  const items = getPunchlistForPhase(project.id, phaseFilter);
  const openCount = items.filter((i) => i.status !== "done" && i.status !== "waived").length;
  return res.json({
    projectId: project.id,
    phase: phaseFilter,
    items,
    openCount,
    totalCount: items.length,
    doneCount: items.filter((i) => i.status === "done").length,
    waivedCount: items.filter((i) => i.status === "waived").length,
  });
});

router.post("/projects/:id/punchlist", requireRole(["team", "admin", "superadmin"]), (req, res) => {
  const project = PROJECTS.find((p) => p.id === req.params["id"]);
  if (!project) return res.status(404).json({ error: "not_found" });
  if (!enforceClientOwnership(req, res, project.id)) return;
  const { label, labelEs, owner, dueDate, phase } = req.body ?? {};
  if (typeof label !== "string" || label.trim().length === 0 || typeof labelEs !== "string" || labelEs.trim().length === 0) {
    return res.status(400).json({ error: "invalid_payload", message: "label and labelEs are required" });
  }
  if (typeof owner !== "string" || owner.trim().length === 0) {
    return res.status(400).json({ error: "invalid_payload", message: "owner is required" });
  }
  const targetPhase = typeof phase === "string" && phase.length > 0 ? phase : project.phase;
  const key = punchlistKey(project.id, targetPhase);
  const list = PROJECT_PUNCHLIST[key] ?? (PROJECT_PUNCHLIST[key] = []);
  const item: PunchlistItem = {
    id: `pl-${project.id}-${Date.now()}`,
    projectId: project.id,
    phase: targetPhase as PunchlistItem["phase"],
    label: label.trim().slice(0, 200),
    labelEs: labelEs.trim().slice(0, 200),
    owner: owner.trim().slice(0, 100),
    dueDate: typeof dueDate === "string" && dueDate.length > 0 ? dueDate : undefined,
    status: "open",
    updatedAt: new Date().toISOString(),
  };
  list.push(item);
  savePunchlist(PROJECT_PUNCHLIST);
  const actor = (req as { user?: { name?: string } }).user?.name ?? "Team";
  appendActivity(project.id, {
    type: "punchlist_change",
    actor,
    description: `Punchlist item added: "${item.label}"`,
    descriptionEs: `Ítem de punchlist agregado: "${item.labelEs}"`,
  });
  return res.status(201).json({ projectId: project.id, item });
});

router.patch("/projects/:id/punchlist/:itemId", requireRole(["team", "admin", "superadmin"]), (req, res) => {
  const project = PROJECTS.find((p) => p.id === req.params["id"]);
  if (!project) return res.status(404).json({ error: "not_found" });
  if (!enforceClientOwnership(req, res, project.id)) return;
  const itemId = req.params["itemId"];
  let found: PunchlistItem | undefined;
  for (const list of Object.values(PROJECT_PUNCHLIST)) {
    found = list.find((i) => i.id === itemId && i.projectId === project.id);
    if (found) break;
  }
  if (!found) return res.status(404).json({ error: "item_not_found" });
  const { label, labelEs, owner, dueDate } = req.body ?? {};
  if (typeof label === "string" && label.trim().length > 0) found.label = label.trim().slice(0, 200);
  if (typeof labelEs === "string" && labelEs.trim().length > 0) found.labelEs = labelEs.trim().slice(0, 200);
  if (typeof owner === "string" && owner.trim().length > 0) found.owner = owner.trim().slice(0, 100);
  if (typeof dueDate === "string") found.dueDate = dueDate.length > 0 ? dueDate : undefined;
  found.updatedAt = new Date().toISOString();
  savePunchlist(PROJECT_PUNCHLIST);
  const actor = (req as { user?: { name?: string } }).user?.name ?? "Team";
  appendActivity(project.id, {
    type: "punchlist_change",
    actor,
    description: `Punchlist item edited: "${found.label}"`,
    descriptionEs: `Ítem de punchlist editado: "${found.labelEs}"`,
  });
  return res.json({ projectId: project.id, item: found });
});

router.post("/projects/:id/punchlist/:itemId/status", requireRole(["team", "admin", "superadmin"]), (req, res) => {
  const project = PROJECTS.find((p) => p.id === req.params["id"]);
  if (!project) return res.status(404).json({ error: "not_found" });
  if (!enforceClientOwnership(req, res, project.id)) return;
  const { status, waiverReason } = req.body ?? {};
  if (typeof status !== "string" || !PUNCHLIST_STATUSES.includes(status as PunchlistItemStatus)) {
    return res.status(400).json({ error: "invalid_payload", message: `status must be one of ${PUNCHLIST_STATUSES.join("|")}` });
  }
  if (status === "waived" && (typeof waiverReason !== "string" || waiverReason.trim().length < 3)) {
    return res.status(400).json({ error: "waiver_reason_required", message: "Waiving an item requires a justification (≥3 chars)" });
  }
  const itemId = req.params["itemId"];
  let found: PunchlistItem | undefined;
  for (const list of Object.values(PROJECT_PUNCHLIST)) {
    found = list.find((i) => i.id === itemId && i.projectId === project.id);
    if (found) break;
  }
  if (!found) return res.status(404).json({ error: "item_not_found" });
  const prev = found.status;
  found.status = status as PunchlistItemStatus;
  found.updatedAt = new Date().toISOString();
  if (status === "done") found.completedAt = new Date().toISOString();
  else if (status !== "done") found.completedAt = undefined;
  if (status === "waived") found.waiverReason = (waiverReason as string).trim().slice(0, 300);
  else found.waiverReason = undefined;
  savePunchlist(PROJECT_PUNCHLIST);
  const actor = (req as { user?: { name?: string } }).user?.name ?? "Team";
  const justSuffix = status === "waived" ? `: ${found.waiverReason}` : "";
  appendActivity(project.id, {
    type: "punchlist_change",
    actor,
    description: `Punchlist "${found.label}" → ${status} (was ${prev})${justSuffix}`,
    descriptionEs: `Punchlist "${found.labelEs}" → ${status} (antes ${prev})${justSuffix}`,
  });
  return res.json({ projectId: project.id, item: found });
});

router.delete("/projects/:id/punchlist/:itemId", requireRole(["team", "admin", "superadmin"]), (req, res) => {
  const project = PROJECTS.find((p) => p.id === req.params["id"]);
  if (!project) return res.status(404).json({ error: "not_found" });
  if (!enforceClientOwnership(req, res, project.id)) return;
  const itemId = req.params["itemId"];
  for (const [key, list] of Object.entries(PROJECT_PUNCHLIST)) {
    const idx = list.findIndex((i) => i.id === itemId && i.projectId === project.id);
    if (idx !== -1) {
      const [removed] = list.splice(idx, 1);
      if (list.length === 0) delete PROJECT_PUNCHLIST[key];
      savePunchlist(PROJECT_PUNCHLIST);
      const actor = (req as { user?: { name?: string } }).user?.name ?? "Team";
      appendActivity(project.id, {
        type: "punchlist_change",
        actor,
        description: `Punchlist item removed: "${removed!.label}"`,
        descriptionEs: `Ítem de punchlist eliminado: "${removed!.labelEs}"`,
      });
      return res.json({ projectId: project.id, removedId: itemId });
    }
  }
  return res.status(404).json({ error: "item_not_found" });
});

router.post("/projects/:id/gamma-report", requireRole(["team"]), (req, res) => {
  const project = PROJECTS.find((p) => p.id === req.params["id"]);
  if (!project) return res.status(404).json({ error: "not_found" });
  const actor = (req as { user?: { name?: string } }).user?.name ?? "Team";
  const reportId = `gamma-${project.id}-${Date.now()}`;
  const url = `https://gamma.app/docs/konti-${project.id}-${reportId}`;
  (project as { gammaReportUrl?: string }).gammaReportUrl = url;
  appendActivity(project.id, {
    type: "gamma_generated",
    actor: `${actor} via GAMMA`,
    description: "GAMMA presentation generated for client review",
    descriptionEs: "Presentación GAMMA generada para revisión del cliente",
  });
  return res.json({
    projectId: project.id,
    reportId,
    gammaReportUrl: url,
    url,
    generatedAt: new Date().toISOString(),
    generatedBy: "GAMMA",
    pages: 12,
  });
});

// ---------------------------------------------------------------------------
// Phase 3 — Design sub-phases, Proposals & Change Orders
// ---------------------------------------------------------------------------

const VALID_DELIVERABLE_STATUS: DesignDeliverableStatus[] = ["pending", "in_progress", "done"];

function getProjectOr404(id: string, res: import("express").Response) {
  const project = PROJECTS.find((p) => p.id === id);
  if (!project) {
    res.status(404).json({ error: "not_found" });
    return null;
  }
  return project;
}

// Backwards-compatible alias — read endpoints still use this name. New code
// should call enforceClientOwnership directly.
const clientCanReadOrForbid = enforceClientOwnership;

router.get("/projects/:id/design", requireRole(["team", "client"]), (req, res) => {
  const project = getProjectOr404(String(req.params["id"]), res);
  if (!project) return;
  if (!clientCanReadOrForbid(req, res, project.id)) return;
  const state = PROJECT_DESIGN_STATE[project.id];
  // Derive current sub-phase from canonical project phase
  let derivedCurrent: DesignSubPhase | "complete" | null = null;
  if (DESIGN_SUB_PHASE_ORDER.includes(project.phase as DesignSubPhase)) {
    derivedCurrent = project.phase as DesignSubPhase;
  } else if (PHASE_ORDER.indexOf(project.phase) > PHASE_ORDER.indexOf("construction_documents")) {
    derivedCurrent = "complete";
  }
  const inDesign = derivedCurrent !== null;
  const stateOut = state && derivedCurrent !== null ? { ...state, currentSubPhase: derivedCurrent } : state;
  return res.json({
    projectId: project.id,
    available: !!state,
    isProjectInDesign: inDesign,
    state: stateOut ?? null,
    subPhaseOrder: DESIGN_SUB_PHASE_ORDER,
    subPhaseLabels: DESIGN_SUB_PHASE_LABELS,
    docVersionCadence: {
      schematic_design: { maxVersions: 3, label: "SD up to V3" },
      design_development: { maxVersions: 3, label: "DD up to V3" },
      construction_documents: { maxVersions: 2, label: "CD up to V2" },
    },
  });
});

router.post("/projects/:id/design/deliverable", requireRole(["team", "admin", "superadmin"]), (req, res) => {
  const project = getProjectOr404(String(req.params["id"]), res);
  if (!project) return;
  const { subPhase, deliverableId, status } = req.body ?? {};
  if (!DESIGN_SUB_PHASE_ORDER.includes(subPhase)) return res.status(400).json({ error: "invalid_sub_phase" });
  if (!VALID_DELIVERABLE_STATUS.includes(status)) return res.status(400).json({ error: "invalid_status" });
  const state = PROJECT_DESIGN_STATE[project.id];
  if (!state) return res.status(404).json({ error: "no_design_state" });
  const sp = state.subPhases[subPhase as DesignSubPhase];
  const item = sp.deliverables.find((d) => d.id === deliverableId);
  if (!item) return res.status(404).json({ error: "deliverable_not_found" });
  item.status = status;
  item.completedAt = status === "done" ? new Date().toISOString() : undefined;
  return res.json({ projectId: project.id, subPhase, item });
});

router.post("/projects/:id/design/advance-sub-phase", requireRole(["team", "admin", "superadmin"]), (req, res) => {
  const project = getProjectOr404(String(req.params["id"]), res);
  if (!project) return;
  const state = PROJECT_DESIGN_STATE[project.id];
  if (!state) return res.status(404).json({ error: "no_design_state" });
  // Resolve current sub-phase from canonical project phase
  if (!DESIGN_SUB_PHASE_ORDER.includes(project.phase as DesignSubPhase)) {
    return res.status(400).json({ error: "not_in_design", message: "Project is not currently in a design sub-phase" });
  }
  const currentSub = project.phase as DesignSubPhase;
  const idx = DESIGN_SUB_PHASE_ORDER.indexOf(currentSub);
  const current = state.subPhases[currentSub];
  const allDone = current.deliverables.every((d) => d.status === "done");
  if (!allDone) {
    return res.status(400).json({ error: "deliverables_incomplete", message: "All deliverables must be marked done before advancing" });
  }
  const now = new Date().toISOString();
  current.completedAt = now;
  const completedLabel = DESIGN_SUB_PHASE_LABELS[currentSub];
  let nextPhase: typeof project.phase;
  if (idx === DESIGN_SUB_PHASE_ORDER.length - 1) {
    state.currentSubPhase = "complete";
    nextPhase = "permits";
    appendActivity(project.id, {
      type: "sub_phase_advanced",
      actor: (req as { user?: { name?: string } }).user?.name ?? "Team",
      description: `Design complete — ${completedLabel.en} signed off, advanced to Permits`,
      descriptionEs: `Diseño completo — ${completedLabel.es} aprobado, avanzado a Permisos`,
    });
  } else {
    const next = DESIGN_SUB_PHASE_ORDER[idx + 1];
    state.currentSubPhase = next;
    state.subPhases[next].startedAt = now;
    nextPhase = next;
    const nextLabel = DESIGN_SUB_PHASE_LABELS[next];
    appendActivity(project.id, {
      type: "sub_phase_advanced",
      actor: (req as { user?: { name?: string } }).user?.name ?? "Team",
      description: `Advanced to ${nextLabel.en} (${completedLabel.en} complete)`,
      descriptionEs: `Avanzado a ${nextLabel.es} (${completedLabel.es} completado)`,
    });
  }
  // Sync canonical project phase
  const labels = PHASE_LABELS[nextPhase];
  (project as { phase: typeof nextPhase }).phase = nextPhase;
  (project as { phaseLabel: string }).phaseLabel = labels.en;
  (project as { phaseLabelEs: string }).phaseLabelEs = labels.es;
  (project as { phaseNumber: number }).phaseNumber = PHASE_ORDER.indexOf(nextPhase) + 1;
  return res.json({ projectId: project.id, state, project });
});

router.get("/projects/:id/proposals", requireRole(["team", "client"]), (req, res) => {
  const project = getProjectOr404(String(req.params["id"]), res);
  if (!project) return;
  if (!clientCanReadOrForbid(req, res, project.id)) return;
  return res.json({ projectId: project.id, proposals: PROJECT_PROPOSALS[project.id] ?? [] });
});

router.post("/projects/:id/proposals/:proposalId/approve", requireRole(["client"]), (req, res) => {
  const project = getProjectOr404(String(req.params["id"]), res);
  if (!project) return;
  if (!enforceClientOwnership(req, res, project.id)) return;
  const user = (req as { user?: { id: string; name?: string } }).user;
  const list = PROJECT_PROPOSALS[project.id] ?? [];
  const target = list.find((p) => p.id === String(req.params["proposalId"]));
  if (!target) return res.status(404).json({ error: "proposal_not_found" });
  if (list.some((p) => p.status === "approved")) {
    return res.status(400).json({ error: "already_approved", message: "A proposal has already been approved for this project" });
  }
  // Phase gate: only approvable while the project is still in pre-design or schematic design (i.e. before permits)
  const allowedPhases = ["pre_design", "schematic_design"];
  if (!allowedPhases.includes(project.phase)) {
    return res.status(400).json({
      error: "invalid_phase",
      message: `Proposal approval is only allowed during ${allowedPhases.join(" or ")} (current: ${project.phase})`,
    });
  }
  const now = new Date().toISOString();
  for (const p of list) {
    if (p.id === target.id) {
      p.status = "approved";
      p.decidedAt = now;
      p.decidedBy = user?.name ?? "Client";
    } else if (p.status === "pending") {
      p.status = "rejected";
      p.decidedAt = now;
      p.decidedBy = user?.name ?? "Client";
    }
  }
  appendActivity(project.id, {
    type: "proposal_decision",
    actor: user?.name ?? "Client",
    description: `Client approved "${target.title}" ($${target.totalCost.toLocaleString()})`,
    descriptionEs: `Cliente aprobó "${target.titleEs}" ($${target.totalCost.toLocaleString()})`,
  });
  appendActivity(project.id, {
    type: "email_sent",
    actor: "System",
    description: "Proposal acceptance receipt and contract draft sent",
    descriptionEs: "Recibo de aceptación de propuesta y borrador de contrato enviados",
  });
  // Approving a proposal commits the contract — auto-advance the project to Permits
  const labels = PHASE_LABELS["permits"];
  (project as { phase: "permits" }).phase = "permits";
  (project as { phaseLabel: string }).phaseLabel = labels.en;
  (project as { phaseLabelEs: string }).phaseLabelEs = labels.es;
  (project as { phaseNumber: number }).phaseNumber = PHASE_ORDER.indexOf("permits") + 1;
  appendActivity(project.id, {
    type: "phase_change",
    actor: "System",
    description: `Phase advanced to ${labels.en} (proposal approved)`,
    descriptionEs: `Fase avanzada a ${labels.es} (propuesta aprobada)`,
  });
  return res.json({ projectId: project.id, proposals: list, approved: target, project });
});

router.get("/projects/:id/change-orders", requireRole(["team", "client"]), (req, res) => {
  const project = getProjectOr404(String(req.params["id"]), res);
  if (!project) return;
  if (!clientCanReadOrForbid(req, res, project.id)) return;
  const orders = PROJECT_CHANGE_ORDERS[project.id] ?? [];
  const totals = {
    approvedDelta: orders.filter((o) => o.status === "approved").reduce((s, o) => s + o.amountDelta, 0),
    pendingDelta: orders.filter((o) => o.status === "pending").reduce((s, o) => s + o.amountDelta, 0),
    approvedDays: orders.filter((o) => o.status === "approved").reduce((s, o) => s + o.scheduleImpactDays, 0),
  };
  return res.json({ projectId: project.id, changeOrders: orders, totals });
});

router.post("/projects/:id/change-orders", requireRole(["team", "admin", "superadmin"]), (req, res) => {
  const project = getProjectOr404(String(req.params["id"]), res);
  if (!project) return;
  const { title, titleEs, description, descriptionEs, amountDelta, scheduleImpactDays, reason, reasonEs, outsideOfScope } = req.body ?? {};
  if (typeof title !== "string" || title.trim().length < 3) return res.status(400).json({ error: "invalid_title" });
  if (typeof amountDelta !== "number" || !isFinite(amountDelta)) return res.status(400).json({ error: "invalid_amount" });
  if (typeof scheduleImpactDays !== "number" || !isFinite(scheduleImpactDays) || scheduleImpactDays < 0) {
    return res.status(400).json({ error: "invalid_schedule" });
  }
  const list = PROJECT_CHANGE_ORDERS[project.id] ?? (PROJECT_CHANGE_ORDERS[project.id] = []);
  const number = `CO-${String(list.length + 1).padStart(3, "0")}`;
  const actor = (req as { user?: { name?: string } }).user?.name ?? "Team";
  const co: ChangeOrder = {
    id: `co-${project.id}-${Date.now()}`,
    projectId: project.id,
    number,
    title: title.trim(),
    titleEs: typeof titleEs === "string" && titleEs.trim() ? titleEs.trim() : title.trim(),
    description: typeof description === "string" ? description : "",
    descriptionEs: typeof descriptionEs === "string" ? descriptionEs : (typeof description === "string" ? description : ""),
    amountDelta,
    scheduleImpactDays,
    reason: typeof reason === "string" ? reason : "",
    reasonEs: typeof reasonEs === "string" ? reasonEs : (typeof reason === "string" ? reason : ""),
    requestedBy: actor,
    requestedAt: new Date().toISOString(),
    status: "pending",
    outsideOfScope: typeof outsideOfScope === "boolean" ? outsideOfScope : false,
  };
  list.push(co);
  appendActivity(project.id, {
    type: "change_order_created",
    actor,
    description: `${number} created: ${co.title} (${amountDelta >= 0 ? "+" : "−"}$${Math.abs(amountDelta).toLocaleString()})`,
    descriptionEs: `${number} creada: ${co.titleEs} (${amountDelta >= 0 ? "+" : "−"}$${Math.abs(amountDelta).toLocaleString()})`,
  });
  return res.status(201).json({ projectId: project.id, changeOrder: co });
});

router.patch("/projects/:id/change-orders/:coId", requireRole(["team", "admin", "superadmin"]), (req, res) => {
  const project = getProjectOr404(String(req.params["id"]), res);
  if (!project) return;
  const list = PROJECT_CHANGE_ORDERS[project.id] ?? [];
  const co = list.find((o) => o.id === String(req.params["coId"]));
  if (!co) return res.status(404).json({ error: "change_order_not_found" });
  if (co.status !== "pending") {
    return res.status(400).json({ error: "cannot_edit_decided", message: "Only pending change orders can be edited" });
  }
  const body = (req.body ?? {}) as Partial<ChangeOrder>;
  const changes: string[] = [];
  if (typeof body.title === "string" && body.title.trim().length >= 3 && body.title.trim() !== co.title) {
    co.title = body.title.trim(); changes.push("title");
  }
  if (typeof body.titleEs === "string" && body.titleEs.trim() && body.titleEs.trim() !== co.titleEs) {
    co.titleEs = body.titleEs.trim(); changes.push("titleEs");
  }
  if (typeof body.description === "string" && body.description !== co.description) {
    co.description = body.description; changes.push("description");
  }
  if (typeof body.descriptionEs === "string" && body.descriptionEs !== co.descriptionEs) {
    co.descriptionEs = body.descriptionEs; changes.push("descriptionEs");
  }
  if (typeof body.reason === "string" && body.reason !== co.reason) {
    co.reason = body.reason; changes.push("reason");
  }
  if (typeof body.reasonEs === "string" && body.reasonEs !== co.reasonEs) {
    co.reasonEs = body.reasonEs; changes.push("reasonEs");
  }
  if (typeof body.amountDelta === "number" && isFinite(body.amountDelta) && body.amountDelta !== co.amountDelta) {
    co.amountDelta = body.amountDelta; changes.push("amount");
  }
  if (typeof body.scheduleImpactDays === "number" && isFinite(body.scheduleImpactDays) && body.scheduleImpactDays >= 0 && body.scheduleImpactDays !== co.scheduleImpactDays) {
    co.scheduleImpactDays = body.scheduleImpactDays; changes.push("schedule");
  }
  if (typeof body.outsideOfScope === "boolean" && body.outsideOfScope !== co.outsideOfScope) {
    co.outsideOfScope = body.outsideOfScope; changes.push("outsideOfScope");
  }
  if (changes.length === 0) {
    return res.status(400).json({ error: "no_changes" });
  }
  const actor = (req as { user?: { name?: string } }).user?.name ?? "Team";
  appendActivity(project.id, {
    type: "change_order_created",
    actor,
    description: `${co.number} edited (${changes.join(", ")})`,
    descriptionEs: `${co.number} editada (${changes.join(", ")})`,
  });
  return res.json({ projectId: project.id, changeOrder: co });
});

router.delete("/projects/:id/change-orders/:coId", requireRole(["team", "admin", "superadmin"]), (req, res) => {
  const project = getProjectOr404(String(req.params["id"]), res);
  if (!project) return;
  const list = PROJECT_CHANGE_ORDERS[project.id] ?? [];
  const idx = list.findIndex((o) => o.id === String(req.params["coId"]));
  if (idx === -1) return res.status(404).json({ error: "change_order_not_found" });
  const co = list[idx];
  if (co.status !== "pending") {
    return res.status(400).json({ error: "cannot_delete_decided", message: "Only pending change orders can be deleted" });
  }
  list.splice(idx, 1);
  appendActivity(project.id, {
    type: "change_order_decision",
    actor: (req as { user?: { name?: string } }).user?.name ?? "Team",
    description: `${co.number} withdrawn before decision`,
    descriptionEs: `${co.number} retirada antes de la decisión`,
  });
  return res.json({ projectId: project.id, deleted: co.id });
});

// Change-order status is admin/architect-only per spec — clients have read-only access.
router.post("/projects/:id/change-orders/:coId/status", requireRole(["team", "admin", "superadmin"]), (req, res) => {
  const project = getProjectOr404(String(req.params["id"]), res);
  if (!project) return;
  const user = (req as { user?: { id: string; name?: string } }).user;
  const { status, note } = req.body ?? {};
  if (status !== "approved" && status !== "rejected" && status !== "pending") {
    return res.status(400).json({ error: "invalid_status" });
  }
  const list = PROJECT_CHANGE_ORDERS[project.id] ?? [];
  const co = list.find((o) => o.id === String(req.params["coId"]));
  if (!co) return res.status(404).json({ error: "change_order_not_found" });
  co.status = status;
  if (status === "pending") {
    co.decidedAt = undefined;
    co.decidedBy = undefined;
    co.decisionNote = undefined;
  } else {
    co.decidedAt = new Date().toISOString();
    co.decidedBy = user?.name ?? "Team";
    if (typeof note === "string" && note.trim()) co.decisionNote = note.trim().slice(0, 300);
  }
  appendActivity(project.id, {
    type: "change_order_decision",
    actor: user?.name ?? "Team",
    description: `${co.number} marked ${status}${co.decisionNote ? `: ${co.decisionNote}` : ""}`,
    descriptionEs: `${co.number} marcada ${status === "approved" ? "aprobada" : status === "rejected" ? "rechazada" : "pendiente"}${co.decisionNote ? `: ${co.decisionNote}` : ""}`,
  });
  return res.json({ projectId: project.id, changeOrder: co });
});

// ---------------------------------------------------------------------------
// Phase 4 — Permits Authorization Workflow
// ---------------------------------------------------------------------------

function computePermitMilestones(projectId: string) {
  const auth = PROJECT_PERMIT_AUTHORIZATIONS[projectId] ?? { status: "none" as const, summaryAccepted: false };
  const sigs = PROJECT_REQUIRED_SIGNATURES[projectId] ?? [];
  const items = PROJECT_PERMIT_ITEMS[projectId] ?? [];
  const allSigned = sigs.length > 0 && sigs.filter((s) => s.required).every((s) => !!s.signedAt);
  const anySubmitted = items.some((i) => i.state !== "not_submitted");
  const anyInReviewLike = items.some((i) => i.state === "in_review" || i.state === "approved" || i.state === "revision_requested");
  const allApproved = items.length > 0 && items.every((i) => i.state === "approved");
  return {
    auth, sigs, items, allSigned, anySubmitted, anyInReviewLike, allApproved,
    milestones: {
      authorization: auth.status === "authorized",
      signatures: allSigned,
      submission: anySubmitted,
      review: anyInReviewLike,
      approval: allApproved,
    },
  };
}

router.get("/projects/:id/permits", requireRole(["team", "client"]), (req, res) => {
  const project = getProjectOr404(String(req.params["id"]), res);
  if (!project) return;
  if (!clientCanReadOrForbid(req, res, project.id)) return;
  const m = computePermitMilestones(project.id);
  return res.json({
    projectId: project.id,
    authorization: m.auth,
    requiredSignatures: m.sigs,
    permitItems: m.items,
    milestones: m.milestones,
    canSubmitToOgpe: m.auth.status === "authorized" && m.allSigned && m.items.some((i) => i.state === "not_submitted"),
    stateOrder: PERMIT_ITEM_STATE_ORDER,
  });
});

router.post("/projects/:id/authorize-permits", requireRole(["client"]), (req, res) => {
  const project = getProjectOr404(String(req.params["id"]), res);
  if (!project) return;
  if (!enforceClientOwnership(req, res, project.id)) return;
  const user = (req as { user?: { id: string; name?: string } }).user;
  if (project.phase !== "permits") {
    return res.status(400).json({ error: "invalid_phase", message: "Project is not in the permits phase" });
  }
  const auth = PROJECT_PERMIT_AUTHORIZATIONS[project.id] ?? (PROJECT_PERMIT_AUTHORIZATIONS[project.id] = { status: "none", summaryAccepted: false });
  if (auth.status === "authorized") {
    return res.status(400).json({ error: "already_authorized" });
  }
  auth.status = "authorized";
  auth.authorizedBy = user?.name ?? "Client";
  auth.authorizedAt = new Date().toISOString();
  auth.summaryAccepted = true;
  // Capture client IP for the audit trail. Demo data is in-memory, so we
  // accept the proxied request IP and fall back to a mock placeholder.
  const fwd = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim();
  auth.authorizedIpMock = fwd || req.ip || req.socket?.remoteAddress || "127.0.0.1 (mock)";
  appendActivity(project.id, {
    type: "permit_authorization",
    actor: user?.name ?? "Client",
    description: "Client authorized OGPE submission packet",
    descriptionEs: "Cliente autorizó el paquete de sometimiento a OGPE",
  });
  return res.json({ projectId: project.id, authorization: auth });
});

router.post("/projects/:id/sign/:signatureId", requireRole(["client"]), (req, res) => {
  const project = getProjectOr404(String(req.params["id"]), res);
  if (!project) return;
  if (!enforceClientOwnership(req, res, project.id)) return;
  if (project.phase !== "permits") {
    return res.status(400).json({ error: "invalid_phase", message: "Signatures only accepted during the permits phase" });
  }
  // Sequencing: client must authorize the OGPE packet before signing forms.
  const auth = PROJECT_PERMIT_AUTHORIZATIONS[project.id];
  if (!auth || auth.status !== "authorized") {
    return res.status(400).json({ error: "not_authorized", message: "Authorize the OGPE submission packet before signing forms" });
  }
  const { signatureName } = req.body ?? {};
  if (typeof signatureName !== "string" || signatureName.trim().length < 2) {
    return res.status(400).json({ error: "invalid_signature_name", message: "Signature name must be at least 2 characters" });
  }
  const sigs = PROJECT_REQUIRED_SIGNATURES[project.id] ?? [];
  const sig = sigs.find((s) => s.id === String(req.params["signatureId"]));
  if (!sig) return res.status(404).json({ error: "signature_not_found" });
  if (sig.signedAt) return res.status(400).json({ error: "already_signed" });
  sig.signedBy = signatureName.trim().slice(0, 100);
  sig.signedAt = new Date().toISOString();
  appendActivity(project.id, {
    type: "permit_signature",
    actor: sig.signedBy,
    description: `Signed: ${sig.formName}`,
    descriptionEs: `Firmado: ${sig.formNameEs}`,
  });
  return res.json({ projectId: project.id, signature: sig });
});

router.post("/projects/:id/permit-items/submit-to-ogpe", requireRole(["admin", "architect", "superadmin"]), (req, res) => {
  const project = getProjectOr404(String(req.params["id"]), res);
  if (!project) return;
  const auth = PROJECT_PERMIT_AUTHORIZATIONS[project.id];
  const sigs = PROJECT_REQUIRED_SIGNATURES[project.id] ?? [];
  const items = PROJECT_PERMIT_ITEMS[project.id] ?? [];
  if (!auth || auth.status !== "authorized") {
    return res.status(400).json({ error: "not_authorized", message: "Client authorization required before submitting" });
  }
  if (!sigs.filter((s) => s.required).every((s) => !!s.signedAt)) {
    return res.status(400).json({ error: "signatures_incomplete", message: "All required signatures must be collected first" });
  }
  const now = new Date().toISOString();
  let count = 0;
  for (const it of items) {
    if (it.state === "not_submitted") {
      it.state = "submitted";
      it.lastUpdatedAt = now;
      count++;
    }
  }
  if (count === 0) {
    return res.status(400).json({ error: "nothing_to_submit", message: "All permit items have already been submitted" });
  }
  const actor = (req as { user?: { name?: string } }).user?.name ?? "Team";
  appendActivity(project.id, {
    type: "permit_submitted",
    actor,
    description: `Submitted ${count} permit item${count === 1 ? "" : "s"} to OGPE`,
    descriptionEs: `Enviados ${count} ítem${count === 1 ? "" : "s"} de permiso a OGPE`,
  });
  return res.json({ projectId: project.id, permitItems: items, submittedCount: count });
});

router.post("/projects/:id/permit-items/:itemId/state", requireRole(["admin", "architect", "superadmin"]), (req, res) => {
  const project = getProjectOr404(String(req.params["id"]), res);
  if (!project) return;
  const { state, revisionNote, revisionNoteEs } = req.body ?? {};
  if (!PERMIT_ITEM_STATE_ORDER.includes(state)) {
    return res.status(400).json({ error: "invalid_state" });
  }
  const items = PROJECT_PERMIT_ITEMS[project.id] ?? [];
  const item = items.find((i) => i.id === String(req.params["itemId"]));
  if (!item) return res.status(404).json({ error: "permit_item_not_found" });
  const targetState: PermitItemState = state;
  item.state = targetState;
  item.lastUpdatedAt = new Date().toISOString();
  if (targetState === "revision_requested") {
    if (typeof revisionNote === "string" && revisionNote.trim()) item.revisionNote = revisionNote.trim().slice(0, 300);
    if (typeof revisionNoteEs === "string" && revisionNoteEs.trim()) item.revisionNoteEs = revisionNoteEs.trim().slice(0, 300);
  } else if (targetState === "approved" || targetState === "submitted" || targetState === "in_review") {
    item.revisionNote = undefined;
    item.revisionNoteEs = undefined;
  }
  const actor = (req as { user?: { name?: string } }).user?.name ?? "Team";
  appendActivity(project.id, {
    type: "permit_state_change",
    actor,
    description: `${item.name} → ${targetState}`,
    descriptionEs: `${item.nameEs} → ${targetState}`,
  });
  // Auto-advance to construction when all permit items are approved
  let advanced = false;
  if (project.phase === "permits" && items.length > 0 && items.every((i) => i.state === "approved")) {
    const labels = PHASE_LABELS["construction"];
    (project as { phase: "construction" }).phase = "construction";
    (project as { phaseLabel: string }).phaseLabel = labels.en;
    (project as { phaseLabelEs: string }).phaseLabelEs = labels.es;
    (project as { phaseNumber: number }).phaseNumber = PHASE_ORDER.indexOf("construction") + 1;
    appendActivity(project.id, {
      type: "phase_change",
      actor: "System",
      description: "All permits approved — advanced to Construction",
      descriptionEs: "Todos los permisos aprobados — avanzado a Construcción",
    });
    advanced = true;
  }
  return res.json({ projectId: project.id, permitItem: item, project, advancedToConstruction: advanced });
});

// ---------------------------------------------------------------------------
// Phase 5 — Construction: Cost-Plus, Inspections, Milestones, Engineers
// ---------------------------------------------------------------------------

const VALID_INSPECTION_TYPES: InspectionType[] = ["foundation", "framing", "electrical", "plumbing", "final"];
const VALID_INSPECTION_STATUS: InspectionStatus[] = ["scheduled", "passed", "failed", "re_inspect"];
const VALID_MILESTONE_STATUS: MilestoneStatus[] = ["completed", "in_progress", "upcoming"];

router.get("/structural-engineers", requireRole(["admin", "architect", "superadmin"]), (_req, res) => {
  res.json(STRUCTURAL_ENGINEERS);
});

router.get("/projects/:id/cost-plus", requireRole(["team", "client"]), (req, res) => {
  const project = PROJECTS.find((p) => p.id === req.params["id"]);
  if (!project) return res.status(404).json({ error: "not_found", message: "Project not found" });
  if (!enforceClientOwnership(req, res, project.id)) return;
  const cp = PROJECT_COST_PLUS[project.id];
  if (!cp) return res.status(404).json({ error: "not_found", message: "Cost-plus budget not configured" });
  return res.json(cp);
});

router.get("/projects/:id/invoices", requireRole(["team", "client"]), (req, res) => {
  const project = PROJECTS.find((p) => p.id === req.params["id"]);
  if (!project) return res.status(404).json({ error: "not_found", message: "Project not found" });
  if (!enforceClientOwnership(req, res, project.id)) return;
  const invoices = PROJECT_INVOICES[project.id] ?? [];
  return res.json({ projectId: project.id, invoices });
});

router.get("/projects/:id/contractor-monitoring", requireRole(["team", "client"]), (req, res) => {
  const project = PROJECTS.find((p) => p.id === req.params["id"]);
  if (!project) return res.status(404).json({ error: "not_found", message: "Project not found" });
  if (!enforceClientOwnership(req, res, project.id)) return;
  const rows = PROJECT_CONTRACTOR_MONITORING[project.id] ?? [];
  return res.json({ projectId: project.id, rows });
});

// Last-100 client-facing activity feed. Team consumes this on the project page;
// `?clientOnly=true` narrows to entries triggered by client behaviour. Clients
// may only fetch the audit log for projects they own (enforceClientOwnership).
router.get("/projects/:id/audit-log", requireRole(["team", "client", "admin", "superadmin"]), (req, res) => {
  const project = PROJECTS.find((p) => p.id === req.params["id"]);
  if (!project) return res.status(404).json({ error: "not_found", message: "Project not found" });
  if (!enforceClientOwnership(req, res, project.id)) return;
  const clientOnly = String(req.query["clientOnly"] ?? "").toLowerCase() === "true";
  const CLIENT_TYPES = new Set([
    "client_view",
    "document_download",
    "client_upload",
    "profile_update",
    "document_visibility_change",
    "proposal_decision",
    "change_order_decision",
  ]);
  const all = PROJECT_ACTIVITIES[project.id] ?? [];
  const filtered = clientOnly ? all.filter((a) => CLIENT_TYPES.has(a.type)) : all;
  // Most recent first, capped at 100 to keep payload small.
  const sorted = [...filtered].sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1)).slice(0, 100);
  return res.json({ projectId: project.id, entries: sorted });
});

router.get("/projects/:id/inspections", requireRole(["team", "admin", "superadmin", "architect", "client"]), (req, res) => {
  const project = PROJECTS.find((p) => p.id === req.params["id"]);
  if (!project) return res.status(404).json({ error: "not_found", message: "Project not found" });
  if (!enforceClientOwnership(req, res, project.id)) return;
  const list = PROJECT_INSPECTIONS[project.id] ?? [];
  return res.json({ projectId: project.id, inspections: list });
});

router.get("/projects/:id/inspections/:insId", requireRole(["team", "admin", "superadmin", "architect", "client"]), (req, res) => {
  const project = PROJECTS.find((p) => p.id === req.params["id"]);
  if (!project) return res.status(404).json({ error: "not_found", message: "Project not found" });
  if (!enforceClientOwnership(req, res, project.id)) return;
  const insp = (PROJECT_INSPECTIONS[project.id] ?? []).find((i) => i.id === req.params["insId"]);
  if (!insp) return res.status(404).json({ error: "not_found", message: "Inspection not found" });
  return res.json({ projectId: project.id, inspection: insp });
});

router.post("/projects/:id/inspections", requireRole(["admin", "architect", "superadmin"]), (req, res) => {
  const project = PROJECTS.find((p) => p.id === req.params["id"]);
  if (!project) return res.status(404).json({ error: "not_found", message: "Project not found" });
  const body = (req.body ?? {}) as Partial<Inspection>;
  if (!body.type || !VALID_INSPECTION_TYPES.includes(body.type)) {
    return res.status(400).json({ error: "validation", message: "type required" });
  }
  if (!body.title || !body.titleEs || !body.inspector || !body.scheduledDate) {
    return res.status(400).json({ error: "validation", message: "title, titleEs, inspector, scheduledDate required" });
  }
  const status: InspectionStatus = body.status && VALID_INSPECTION_STATUS.includes(body.status) ? body.status : "scheduled";
  const list = PROJECT_INSPECTIONS[project.id] ?? (PROJECT_INSPECTIONS[project.id] = []);
  const inspection: Inspection = {
    id: `ins-${project.id}-${Date.now()}`,
    projectId: project.id,
    type: body.type,
    title: body.title,
    titleEs: body.titleEs,
    inspector: body.inspector,
    scheduledDate: body.scheduledDate,
    status,
    ...(body.completedDate ? { completedDate: body.completedDate } : {}),
    ...(body.notes ? { notes: body.notes } : {}),
    ...(body.notesEs ? { notesEs: body.notesEs } : {}),
  };
  list.push(inspection);
  const actor = (req as { user?: { name?: string } }).user?.name ?? "Team";
  appendActivity(project.id, {
    type: "inspection_scheduled",
    actor,
    description: `Inspection scheduled: ${inspection.title} (${inspection.scheduledDate})`,
    descriptionEs: `Inspección programada: ${inspection.titleEs} (${inspection.scheduledDate})`,
  });
  return res.status(201).json({ projectId: project.id, inspection });
});

router.patch("/projects/:id/inspections/:insId", requireRole(["admin", "architect", "superadmin"]), (req, res) => {
  const project = PROJECTS.find((p) => p.id === req.params["id"]);
  if (!project) return res.status(404).json({ error: "not_found", message: "Project not found" });
  const list = PROJECT_INSPECTIONS[project.id] ?? [];
  const insp = list.find((i) => i.id === req.params["insId"]);
  if (!insp) return res.status(404).json({ error: "not_found", message: "Inspection not found" });
  const body = (req.body ?? {}) as Partial<Inspection>;
  const prevStatus = insp.status;
  if (body.status !== undefined) {
    if (!VALID_INSPECTION_STATUS.includes(body.status)) {
      return res.status(400).json({ error: "validation", message: "invalid status" });
    }
    insp.status = body.status;
    if ((body.status === "passed" || body.status === "failed") && !insp.completedDate) {
      insp.completedDate = body.completedDate ?? new Date().toISOString().slice(0, 10);
    }
  }
  if (body.scheduledDate !== undefined) insp.scheduledDate = body.scheduledDate;
  if (body.completedDate !== undefined) insp.completedDate = body.completedDate;
  if (body.inspector !== undefined) insp.inspector = body.inspector;
  if (body.notes !== undefined) insp.notes = body.notes;
  if (body.notesEs !== undefined) insp.notesEs = body.notesEs;
  if (body.title !== undefined) insp.title = body.title;
  if (body.titleEs !== undefined) insp.titleEs = body.titleEs;
  if (body.reportDocumentUrl !== undefined) insp.reportDocumentUrl = body.reportDocumentUrl;
  if (body.reportDocumentName !== undefined) insp.reportDocumentName = body.reportDocumentName;
  const actor = (req as { user?: { name?: string } }).user?.name ?? "Team";
  if (body.status !== undefined && body.status !== prevStatus) {
    appendActivity(project.id, {
      type: "inspection_status_change",
      actor,
      description: `${insp.title}: ${prevStatus} → ${insp.status}`,
      descriptionEs: `${insp.titleEs}: ${prevStatus} → ${insp.status}`,
    });
  }
  return res.json({ projectId: project.id, inspection: insp });
});

router.delete("/projects/:id/inspections/:insId", requireRole(["admin", "architect", "superadmin"]), (req, res) => {
  const project = PROJECTS.find((p) => p.id === req.params["id"]);
  if (!project) return res.status(404).json({ error: "not_found", message: "Project not found" });
  const list = PROJECT_INSPECTIONS[project.id] ?? [];
  const idx = list.findIndex((i) => i.id === req.params["insId"]);
  if (idx === -1) return res.status(404).json({ error: "not_found", message: "Inspection not found" });
  const removed = list[idx]!;
  list.splice(idx, 1);
  const actor = (req as { user?: { name?: string } }).user?.name ?? "Team";
  appendActivity(project.id, {
    type: "inspection_removed",
    actor,
    description: `Inspection removed: ${removed.title} (${removed.scheduledDate})`,
    descriptionEs: `Inspección eliminada: ${removed.titleEs} (${removed.scheduledDate})`,
  });
  return res.json({ projectId: project.id, deleted: removed.id });
});

router.post("/projects/:id/inspections/:insId/send-report", requireRole(["admin", "architect", "superadmin"]), (req, res) => {
  const project = PROJECTS.find((p) => p.id === req.params["id"]);
  if (!project) return res.status(404).json({ error: "not_found", message: "Project not found" });
  const list = PROJECT_INSPECTIONS[project.id] ?? [];
  const insp = list.find((i) => i.id === req.params["insId"]);
  if (!insp) return res.status(404).json({ error: "not_found", message: "Inspection not found" });
  if (insp.status !== "passed" && insp.status !== "failed" && insp.status !== "re_inspect") {
    return res.status(400).json({ error: "validation", message: "Report can only be sent for completed inspections" });
  }
  const body = (req.body ?? {}) as { engineerId?: string; note?: string };
  const engineer = STRUCTURAL_ENGINEERS.find((e) => e.id === body.engineerId);
  if (!engineer) return res.status(400).json({ error: "validation", message: "engineerId required" });
  insp.reportSentTo = engineer.id;
  insp.reportSentToName = engineer.name;
  insp.reportSentAt = new Date().toISOString();
  if (body.note) insp.reportSentNote = body.note;
  const actor = (req as { user?: { name?: string } }).user?.name ?? "Team";
  appendActivity(project.id, {
    type: "inspection_report_sent",
    actor,
    description: `${insp.title} report sent to ${engineer.name} (${engineer.firm})`,
    descriptionEs: `Reporte de ${insp.titleEs} enviado a ${engineer.name} (${engineer.firm})`,
  });
  return res.json({ projectId: project.id, inspection: insp });
});

router.get("/projects/:id/milestones", requireRole(["team", "admin", "superadmin", "architect", "client"]), (req, res) => {
  const project = PROJECTS.find((p) => p.id === req.params["id"]);
  if (!project) return res.status(404).json({ error: "not_found", message: "Project not found" });
  if (!enforceClientOwnership(req, res, project.id)) return;
  const list = PROJECT_MILESTONES[project.id] ?? [];
  return res.json({ projectId: project.id, milestones: list });
});

router.patch("/projects/:id/milestones/:milestoneId", requireRole(["admin", "architect", "superadmin"]), (req, res) => {
  const project = PROJECTS.find((p) => p.id === req.params["id"]);
  if (!project) return res.status(404).json({ error: "not_found", message: "Project not found" });
  const list = PROJECT_MILESTONES[project.id] ?? [];
  const m = list.find((x) => x.id === req.params["milestoneId"]);
  if (!m) return res.status(404).json({ error: "not_found", message: "Milestone not found" });
  const body = (req.body ?? {}) as Partial<Milestone>;
  const prev = m.status;
  if (body.status !== undefined) {
    if (!VALID_MILESTONE_STATUS.includes(body.status)) {
      return res.status(400).json({ error: "validation", message: "invalid status" });
    }
    m.status = body.status;
  }
  if (body.startDate !== undefined) m.startDate = body.startDate;
  if (body.endDate !== undefined) m.endDate = body.endDate;
  const actor = (req as { user?: { name?: string } }).user?.name ?? "Team";
  if (body.status !== undefined && body.status !== prev) {
    appendActivity(project.id, {
      type: "milestone_status_change",
      actor,
      description: `Milestone ${m.title}: ${prev} → ${m.status}`,
      descriptionEs: `Hito ${m.titleEs}: ${prev} → ${m.status}`,
    });
  }
  return res.json({ projectId: project.id, milestone: m });
});

// PATCH client contact info on a project (phone, postal address, physical address).
// Lets team members maintain a per-project copy of the client's reach-out info
// without forcing the client to update their own profile (CSV item #20).
router.patch(
  "/projects/:projectId/client-contact",
  requireRole(["team", "admin", "superadmin"]),
  (req, res) => {
    const project = PROJECTS.find((p) => p.id === req.params["projectId"]);
    if (!project) return res.status(404).json({ error: "not_found", message: "Project not found" });
    const body = (req.body ?? {}) as Record<string, unknown>;
    const next = project as typeof project & {
      clientPhone?: string;
      clientPostalAddress?: string;
      clientPhysicalAddress?: string;
    };
    const apply = (key: "clientPhone" | "clientPostalAddress" | "clientPhysicalAddress") => {
      if (body[key] !== undefined) {
        const raw = body[key];
        next[key] = typeof raw === "string" ? raw.trim() : "";
      }
    };
    apply("clientPhone");
    apply("clientPostalAddress");
    apply("clientPhysicalAddress");
    appendActivity(project.id, {
      type: "client_contact_updated",
      actor: (req as { user?: { name?: string } }).user?.name ?? "Team",
      description: `Client contact info updated for ${project.clientName}.`,
      descriptionEs: `Información de contacto del cliente actualizada para ${project.clientName}.`,
    });
    return res.json({
      projectId: project.id,
      clientPhone: next.clientPhone ?? "",
      clientPostalAddress: next.clientPostalAddress ?? "",
      clientPhysicalAddress: next.clientPhysicalAddress ?? "",
    });
  },
);

// PATCH the plain-language "what's happening now" status sentence (EN + ES).
// Team members can keep this paragraph fresh from the project page so clients
// always see a friendly, current summary on their dashboard card.
router.patch(
  "/projects/:projectId/status-note",
  requireRole(["team", "admin", "superadmin"]),
  (req, res) => {
    const project = PROJECTS.find((p) => p.id === req.params["projectId"]);
    if (!project) return res.status(404).json({ error: "not_found", message: "Project not found" });
    const body = (req.body ?? {}) as Record<string, unknown>;
    const next = project as typeof project & {
      currentStatusNote?: string;
      currentStatusNoteEs?: string;
    };
    const apply = (key: "currentStatusNote" | "currentStatusNoteEs") => {
      if (body[key] !== undefined) {
        const raw = body[key];
        next[key] = typeof raw === "string" ? raw.trim() : "";
      }
    };
    apply("currentStatusNote");
    apply("currentStatusNoteEs");
    appendActivity(project.id, {
      type: "status_note_updated",
      actor: (req as { user?: { name?: string } }).user?.name ?? "Team",
      description: `Status note updated for ${project.clientName}.`,
      descriptionEs: `Nota de estado actualizada para ${project.clientName}.`,
    });
    return res.json({
      projectId: project.id,
      currentStatusNote: next.currentStatusNote ?? "",
      currentStatusNoteEs: next.currentStatusNoteEs ?? "",
    });
  },
);

// PATCH project-level metadata (B-05).
// Square meters / bathrooms / kitchens / project type / contingency % live on
// the Project record so the Contractor Calculator and other estimating tools
// can read them as a single source of truth instead of being re-typed each
// time an estimate is generated.
const PROJECT_TYPE_VALUES = ["residencial", "comercial", "mixto", "contenedor"] as const;
type ProjectType = (typeof PROJECT_TYPE_VALUES)[number];

router.patch(
  "/projects/:projectId/metadata",
  requireRole(["team", "admin", "superadmin"]),
  (req, res) => {
    const project = PROJECTS.find((p) => p.id === req.params["projectId"]);
    if (!project) return res.status(404).json({ error: "not_found", message: "Project not found" });
    const body = (req.body ?? {}) as Record<string, unknown>;
    const fieldErrors: Record<string, string> = {};

    const next = project as typeof project & {
      squareMeters?: number;
      bathrooms?: number;
      kitchens?: number;
      projectType?: ProjectType;
      contingencyPercent?: number;
    };

    if (body["squareMeters"] !== undefined) {
      const n = Number(body["squareMeters"]);
      if (!isFinite(n) || n <= 0) fieldErrors["squareMeters"] = "must be > 0";
      else next.squareMeters = n;
    }
    if (body["bathrooms"] !== undefined) {
      const n = Number(body["bathrooms"]);
      if (!isFinite(n) || n < 0 || !Number.isInteger(n)) fieldErrors["bathrooms"] = "must be a non-negative integer";
      else next.bathrooms = n;
    }
    if (body["kitchens"] !== undefined) {
      const n = Number(body["kitchens"]);
      if (!isFinite(n) || n < 0 || !Number.isInteger(n)) fieldErrors["kitchens"] = "must be a non-negative integer";
      else next.kitchens = n;
    }
    if (body["projectType"] !== undefined) {
      const v = String(body["projectType"]);
      if (!PROJECT_TYPE_VALUES.includes(v as ProjectType)) {
        fieldErrors["projectType"] = `must be one of ${PROJECT_TYPE_VALUES.join(", ")}`;
      } else {
        next.projectType = v as ProjectType;
      }
    }
    if (body["contingencyPercent"] !== undefined) {
      const n = Number(body["contingencyPercent"]);
      if (!isFinite(n) || n < 0 || n > 50) fieldErrors["contingencyPercent"] = "must be between 0 and 50";
      else next.contingencyPercent = n;
    }

    if (Object.keys(fieldErrors).length > 0) {
      return res.status(400).json({
        error: "invalid_payload",
        message: "Missing or invalid fields",
        messageEs: "Faltan campos requeridos o son inválidos",
        fields: fieldErrors,
      });
    }

    appendActivity(project.id, {
      type: "project_metadata_updated",
      actor: (req as { user?: { name?: string } }).user?.name ?? "Team",
      description: `Project metadata updated for ${project.name}.`,
      descriptionEs: `Metadatos del proyecto actualizados para ${project.name}.`,
    });

    return res.json({
      projectId: project.id,
      squareMeters: next.squareMeters ?? 0,
      bathrooms: next.bathrooms ?? 0,
      kitchens: next.kitchens ?? 0,
      projectType: next.projectType ?? "residencial",
      contingencyPercent: next.contingencyPercent ?? 0,
    });
  },
);

// ---------------------------------------------------------------------------
// Task #127 — Site visit + client interaction logs
// New manual log endpoints. Both write a single ProjectActivity which the
// Asana sync hook (when configured) mirrors into the linked Asana task.
// ---------------------------------------------------------------------------

type SiteVisitChannel = "site" | "remote";

router.post(
  "/projects/:projectId/site-visits",
  requireRole(["team", "admin", "superadmin", "architect"]),
  (req, res) => {
    const projectId = req.params["projectId"] as string;
    if (!PROJECTS.find((p) => p.id === projectId)) {
      return res.status(404).json({ error: "not_found", message: "Project not found" });
    }
    const body = (req.body ?? {}) as {
      visitDate?: string; visitor?: string; note?: string; channel?: SiteVisitChannel;
    };
    const visitor = typeof body.visitor === "string" ? body.visitor.trim() : "";
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 2000) : "";
    const visitDate = typeof body.visitDate === "string" ? body.visitDate.trim() : "";
    const channel: SiteVisitChannel = body.channel === "remote" ? "remote" : "site";
    if (!visitor || !visitDate) {
      return res.status(400).json({ error: "bad_request", message: "visitor and visitDate are required" });
    }
    if (Number.isNaN(Date.parse(visitDate))) {
      return res.status(400).json({ error: "bad_request", message: "visitDate must be ISO-8601" });
    }
    const actor = (req as { user?: { name?: string } }).user?.name ?? "Team";
    const channelEn = channel === "remote" ? "remote check" : "on-site visit";
    const channelEs = channel === "remote" ? "revisión remota" : "visita al sitio";
    const entry = appendActivity(projectId, {
      type: "site_visit_logged",
      actor,
      description: `${channelEn} on ${visitDate} by ${visitor}${note ? `: ${note}` : ""}`,
      descriptionEs: `${channelEs} el ${visitDate} por ${visitor}${note ? `: ${note}` : ""}`,
    });
    res.status(201).json(entry);
  },
);

type ClientChannel = "call" | "meeting" | "email" | "whatsapp";
const VALID_CHANNELS: ClientChannel[] = ["call", "meeting", "email", "whatsapp"];

router.post(
  "/projects/:projectId/client-interactions",
  requireRole(["team", "admin", "superadmin", "architect"]),
  (req, res) => {
    const projectId = req.params["projectId"] as string;
    if (!PROJECTS.find((p) => p.id === projectId)) {
      return res.status(404).json({ error: "not_found", message: "Project not found" });
    }
    const body = (req.body ?? {}) as {
      occurredAt?: string; channel?: ClientChannel; with?: string; note?: string;
    };
    const occurredAt = typeof body.occurredAt === "string" ? body.occurredAt.trim() : "";
    const channel = body.channel as ClientChannel;
    const withWhom = typeof body.with === "string" ? body.with.trim() : "";
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 2000) : "";
    if (!occurredAt || !channel || !withWhom) {
      return res.status(400).json({ error: "bad_request", message: "occurredAt, channel, with are required" });
    }
    if (!VALID_CHANNELS.includes(channel)) {
      return res.status(400).json({ error: "bad_request", message: "channel must be call|meeting|email|whatsapp" });
    }
    if (Number.isNaN(Date.parse(occurredAt))) {
      return res.status(400).json({ error: "bad_request", message: "occurredAt must be ISO-8601" });
    }
    const channelEn = { call: "Call", meeting: "Meeting", email: "Email", whatsapp: "WhatsApp" }[channel];
    const channelEs = { call: "Llamada", meeting: "Reunión", email: "Email", whatsapp: "WhatsApp" }[channel];
    const actor = (req as { user?: { name?: string } }).user?.name ?? "Team";
    const entry = appendActivity(projectId, {
      type: "client_interaction_logged",
      actor,
      description: `${channelEn} with ${withWhom} on ${occurredAt}${note ? `: ${note}` : ""}`,
      descriptionEs: `${channelEs} con ${withWhom} el ${occurredAt}${note ? `: ${note}` : ""}`,
    });
    res.status(201).json(entry);
  },
);

// ---------------------------------------------------------------------------
// Asana task picker for projects whose asanaGid is unset / stale.
// ---------------------------------------------------------------------------
router.get(
  "/projects/:projectId/asana-candidates",
  requireRole(["team", "admin", "superadmin"]),
  async (_req, res) => {
    if (!isAsanaEnabled()) {
      return res.status(412).json({ error: "not_configured", message: "Asana integration is not configured." });
    }
    const cfg = getAsanaConfig();
    try {
      const candidates = await listTasksForProject(cfg.boardGid as string, 100);
      res.json({ candidates });
    } catch (err) {
      if (err instanceof AsanaNotConnectedError) {
        return res.status(412).json({ error: "not_connected", message: err.message });
      }
      if (err instanceof AsanaApiError) {
        return res.status(502).json({ error: "asana_error", status: err.status, message: err.message });
      }
      return res.status(500).json({ error: "internal", message: (err as Error).message });
    }
  },
);

router.post(
  "/projects/:projectId/asana-link",
  requireRole(["team", "admin", "superadmin"]),
  (req, res) => {
    const projectId = req.params["projectId"] as string;
    const project = PROJECTS.find((p) => p.id === projectId) as { id: string; name: string; asanaGid?: string } | undefined;
    if (!project) {
      return res.status(404).json({ error: "not_found", message: "Project not found" });
    }
    const body = (req.body ?? {}) as { asanaGid?: unknown; asanaTaskName?: unknown };
    const gid = typeof body.asanaGid === "string" ? body.asanaGid.trim() : "";
    if (!gid) {
      return res.status(400).json({ error: "bad_request", message: "asanaGid required" });
    }
    project.asanaGid = gid;
    const taskName = typeof body.asanaTaskName === "string" ? body.asanaTaskName.trim() : "";
    appendActivity(projectId, {
      type: "asana_task_linked",
      actor: (req as { user?: { name?: string } }).user?.name ?? "Team",
      description: `Project linked to Asana task ${gid}${taskName ? ` ("${taskName}")` : ""}`,
      descriptionEs: `Proyecto vinculado a tarea Asana ${gid}${taskName ? ` ("${taskName}")` : ""}`,
    });
    res.json({ projectId, asanaGid: gid });
  },
);

export default router;
