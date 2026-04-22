import { Router, type IRouter } from "express";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { PROJECTS, PROJECT_TASKS, DOCUMENTS, WEATHER_DATA } from "../data/seed";
import { requireRole } from "../middlewares/require-role";

const router: IRouter = Router();

// In-memory per-project notes/questions/spec-events for the demo session.
interface ProjectNote { id: string; type: "voice_note" | "client_question" | "general"; text: string; lang: "en" | "es"; createdAt: string; createdBy: string; source: string; }
const PROJECT_NOTES: Record<string, ProjectNote[]> = {};

interface SpecEvent { id: string; projectId: string; kind: "added" | "resolved" | "opened"; title: string; createdAt: string; }
const SPEC_EVENTS: SpecEvent[] = [
  // Seed a demo timeline so the report is not empty.
  { id: "s1", projectId: "proj-1", kind: "added", title: "Bamboo decking spec",         createdAt: "2026-03-05T10:00:00Z" },
  { id: "s2", projectId: "proj-1", kind: "added", title: "Solar PV inverter sizing",    createdAt: "2026-03-12T11:00:00Z" },
  { id: "s3", projectId: "proj-1", kind: "opened",  title: "Question: roof slope",      createdAt: "2026-03-15T13:00:00Z" },
  { id: "s4", projectId: "proj-1", kind: "added", title: "Mineral wool R-30",           createdAt: "2026-03-22T09:00:00Z" },
  { id: "s5", projectId: "proj-1", kind: "resolved", title: "Question: roof slope",     createdAt: "2026-03-28T16:00:00Z" },
  { id: "s6", projectId: "proj-1", kind: "added", title: "Tempered glass railings",     createdAt: "2026-04-02T10:00:00Z" },
  { id: "s7", projectId: "proj-1", kind: "opened",  title: "Question: pool tile color", createdAt: "2026-04-05T11:00:00Z" },
  { id: "s8", projectId: "proj-1", kind: "added", title: "Stainless steel anchors",     createdAt: "2026-04-09T14:00:00Z" },
  { id: "s9", projectId: "proj-1", kind: "resolved", title: "Question: pool tile color",createdAt: "2026-04-14T10:00:00Z" },
  { id: "s10", projectId: "proj-1", kind: "opened", title: "Question: smart home",      createdAt: "2026-04-17T10:00:00Z" },
];

function detectClientQuestion(message: string): boolean {
  const trimmed = message.trim();
  if (trimmed.length < 6) return false;
  if (!trimmed.includes("?") && !trimmed.includes("¿")) return false;
  return true;
}

function looksLikeSpanish(message: string): "en" | "es" {
  return /[áéíóúñ¿¡]|cuándo|cuanto|por qué|cómo|dónde/i.test(message) ? "es" : "en";
}

const anthropic = process.env["ANTHROPIC_API_KEY"]
  ? new Anthropic({ apiKey: process.env["ANTHROPIC_API_KEY"] })
  : null;

const openai = process.env["OPENAI_API_KEY"]
  ? new OpenAI({ apiKey: process.env["OPENAI_API_KEY"] })
  : null;

const KONTI_CONTEXT = `KONTi Design | Build Studio is a sustainable architecture firm based in Puerto Rico, specializing in shipping container construction. Founded after Hurricane María. LEED-accredited team. Containers withstand 180 mph sustained wind per Puerto Rico Building Code. Cost-Plus construction model for full transparency.`;

function buildClientPrompt(projectId?: string): string {
  const project = projectId ? PROJECTS.find((p) => p.id === projectId) : null;

  const projectSection = project
    ? `PROJECT YOU ARE DISCUSSING:
- Name: ${project.name}
- Client: ${project.clientName}
- Location: ${project.location}
- Phase: ${project.phaseLabel} (Phase ${project.phaseNumber} of 9)
- Progress: ${project.progressPercent}% complete
- Budget Allocated: $${project.budgetAllocated.toLocaleString()}
- Timeline: ${project.startDate} → ${project.estimatedEndDate}
- Status: ${project.status}

CLIENT-VISIBLE UPCOMING TASKS:
${(PROJECT_TASKS[projectId as keyof typeof PROJECT_TASKS] ?? [])
  .filter((t) => !t.completed)
  .slice(0, 5)
  .map((t) => `- ${t.title} — Due: ${t.dueDate ?? "TBD"} (${t.priority} priority)`)
  .join("\n")}

SITE CONDITIONS:
${WEATHER_DATA[projectId as keyof typeof WEATHER_DATA]
  ? `- Weather: ${WEATHER_DATA[projectId as keyof typeof WEATHER_DATA].condition}, ${WEATHER_DATA[projectId as keyof typeof WEATHER_DATA].temperature}${WEATHER_DATA[projectId as keyof typeof WEATHER_DATA].temperatureUnit}
- Build Status: ${WEATHER_DATA[projectId as keyof typeof WEATHER_DATA].buildSuitabilityLabel}`
  : "Not available"}`
    : `No specific project selected. Answer general questions about KONTi's services and process.`;

  return `You are the KONTi Client Assistant — a professional, warm, and helpful AI assistant for KONTi Design | Build Studio.

You are speaking directly to the client. Be clear, reassuring, and professional. Answer in the same language the client uses (English or Spanish). Keep answers concise and helpful. Do not reveal internal budget details, contractor rates, or internal team communications.

FORMATTING — IMPORTANT:
- Reply in well-structured Markdown. Use **bold** for key terms, bullet or numbered lists for steps, headings (## / ###) for sections when the answer is long, and short paragraphs.
- When the user asks you to classify, tag, or organize photos or comments, do NOT execute the action. Instead respond with a Markdown summary of what you would do, then end your reply with a single line containing exactly:
  [PROPOSED_ACTION]{"action":"classify_photos","summary":"<one short EN sentence>","summaryEs":"<one short ES sentence>","items":[<up to 5 short labels you would classify>]}[/PROPOSED_ACTION]
- The UI will render that block as a confirm card and only run the action if the user clicks Confirm. Never invent items not requested by the user.

${projectSection}

COMPANY CONTEXT:
${KONTI_CONTEXT}

IMPORTANT: Only answer questions about this specific project and general KONTi company information. Do not discuss other clients or projects.`;
}

const INTERNAL_SYSTEM_PROMPT = `You are the KONTi Internal Spec Bot — a precise, technical AI assistant for the internal KONTi Design | Build Studio team. You have full access to all project data, documents, and specifications.

Answer in the same language the team member uses (English or Spanish). Be technical, precise, and thorough. Reference specific document names, quantities, and specifications when asked.

FORMATTING — IMPORTANT: Reply in well-structured Markdown. Use ## or ### headings for sections, bullet/numbered lists for steps and inventories, **bold** for spec names and quantities, and \`code\` blocks for SKU codes or measurements. When the user asks you to classify, tag, or organize photos or comments, do NOT execute the action — return a Markdown summary and end your reply with a single line containing exactly:
[PROPOSED_ACTION]{"action":"classify_photos","summary":"<one short EN sentence>","summaryEs":"<one short ES sentence>","items":[<up to 5 short labels>]}[/PROPOSED_ACTION]
The UI will turn that into a confirm card; nothing executes until the user clicks Confirm.

FULL PROJECT DATA:
${JSON.stringify(PROJECTS, null, 2)}

ALL TASKS:
${JSON.stringify(Object.values(PROJECT_TASKS).flat(), null, 2)}

ALL DOCUMENTS (including internal):
${JSON.stringify(Object.values(DOCUMENTS).flat(), null, 2)}

WEATHER DATA:
${JSON.stringify(Object.values(WEATHER_DATA), null, 2)}

MATERIALS LIBRARY: 24 items across steel, foundation, lumber, electrical, plumbing, finishes, and insulation categories.

TEAM:
- Carla Gautier — CEO and Founder
- Michelle Telon Sosa — Lead Designer
- Jorge Rosa — Chief Operations Officer
- Andrea Camacho — Environmental Construction Manager
- Miranda Klopf — Sales, Marketing and Design

DOCUMENT CATEGORIES: client_review (client-visible), internal, permits, construction, design

WORKFLOW PHASES:
1. Discovery & Pre-Design
2. Design Development
3. Construction Documents
4. Permits Phase (OGPE submission)
5. Construction (cost-plus model)
6. Completed`;

// GET project notes (voice notes + auto-collected client questions).
router.get("/projects/:id/notes", requireRole(["team", "admin", "superadmin", "architect", "client"]), (req, res) => {
  const id = req.params["id"] as string;
  res.json({ projectId: id, notes: PROJECT_NOTES[id] ?? [] });
});

// POST manual note (voice transcript "Save as note", or general note).
router.post("/projects/:id/notes", requireRole(["team", "admin", "superadmin", "architect", "client"]), (req, res) => {
  const id = req.params["id"] as string;
  if (!PROJECTS.find((p) => p.id === id)) { res.status(404).json({ error: "not_found" }); return; }
  const body = (req.body ?? {}) as { text?: string; type?: string; lang?: string; source?: string };
  const text = (body.text ?? "").trim();
  if (!text) { res.status(400).json({ error: "empty_note" }); return; }
  const note: ProjectNote = {
    id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: (body.type === "voice_note" || body.type === "client_question") ? body.type : "general",
    text,
    lang: body.lang === "es" ? "es" : "en",
    createdAt: new Date().toISOString(),
    createdBy: (req as { user?: { name?: string } }).user?.name ?? "User",
    source: body.source ?? "manual",
  };
  if (!PROJECT_NOTES[id]) PROJECT_NOTES[id] = [];
  PROJECT_NOTES[id].push(note);
  res.json(note);
});

// POST confirm a previously proposed classification (records as a spec event + activity-style log).
router.post("/ai/confirm-classification", requireRole(["team", "admin", "superadmin", "architect", "client"]), (req, res) => {
  const body = (req.body ?? {}) as { projectId?: string; action?: string; items?: string[] };
  const items = Array.isArray(body.items) ? body.items.slice(0, 20) : [];
  if (items.length === 0) { res.status(400).json({ error: "no_items" }); return; }
  const projectId = body.projectId ?? "proj-1";
  for (const it of items) {
    SPEC_EVENTS.push({ id: `s-${Date.now()}-${Math.random().toString(36).slice(2,5)}`, projectId, kind: "added", title: `Classified: ${it}`, createdAt: new Date().toISOString() });
  }
  res.json({ ok: true, classified: items.length, action: body.action ?? "classify_photos", at: new Date().toISOString() });
});

// GET spec updates report — chart-ready timeseries for the spec bot's "Updates Report".
router.get("/projects/:id/spec-updates-report", requireRole(["team", "admin", "superadmin", "architect", "client"]), (req, res) => {
  const id = req.params["id"] as string;
  if (!PROJECTS.find((p) => p.id === id)) { res.status(404).json({ error: "not_found" }); return; }
  const events = SPEC_EVENTS.filter((e) => e.projectId === id);
  // Bucket "added" by week (YYYY-Www).
  const week = (iso: string) => {
    const d = new Date(iso);
    const onejan = new Date(d.getFullYear(), 0, 1);
    const w = Math.ceil((((d.getTime() - onejan.getTime()) / 86400000) + onejan.getDay() + 1) / 7);
    return `${d.getFullYear()}-W${String(w).padStart(2, "0")}`;
  };
  const addedByWeekMap: Record<string, number> = {};
  for (const e of events) if (e.kind === "added") addedByWeekMap[week(e.createdAt)] = (addedByWeekMap[week(e.createdAt)] ?? 0) + 1;
  const addedByWeek = Object.entries(addedByWeekMap).sort(([a], [b]) => a.localeCompare(b)).map(([week, count]) => ({ week, count }));
  let opened = 0, resolved = 0;
  for (const e of events) { if (e.kind === "opened") opened++; else if (e.kind === "resolved") resolved++; }
  const openVsResolved = [
    { status: "Open", count: Math.max(opened - resolved, 0) },
    { status: "Resolved", count: resolved },
  ];
  const recent = [...events].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 10);
  res.json({ projectId: id, generatedAt: new Date().toISOString(), totals: { added: events.filter((e)=>e.kind==="added").length, opened, resolved }, addedByWeek, openVsResolved, recent });
});

router.post("/ai/chat", requireRole(["team", "admin", "superadmin", "architect", "client"]), async (req, res) => {
  const requestedMode = (req.body as { mode?: string } | undefined)?.mode;
  const userRole = (req as { user?: { role?: string } }).user?.role;
  if (requestedMode === "internal_spec_bot" && userRole === "client") {
    res.status(403).json({ error: "forbidden", message: "Internal spec bot is not available to clients" });
    return;
  }
  const {
    message,
    mode,
    projectId,
    conversationHistory = [],
  } = req.body as {
    message: string;
    mode: "client_assistant" | "internal_spec_bot";
    projectId?: string;
    conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
  };

  const systemPrompt =
    mode === "client_assistant"
      ? buildClientPrompt(projectId)
      : INTERNAL_SYSTEM_PROMPT;

  // Auto-collect: if the client asked a question, append it to the per-project Client Questions note list.
  if (mode === "client_assistant" && projectId && detectClientQuestion(message)) {
    if (!PROJECT_NOTES[projectId]) PROJECT_NOTES[projectId] = [];
    PROJECT_NOTES[projectId].push({
      id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: "client_question",
      text: message.trim().slice(0, 500),
      lang: looksLikeSpanish(message),
      createdAt: new Date().toISOString(),
      createdBy: (req as { user?: { name?: string } }).user?.name ?? "Client",
      source: "ai_chat",
    });
  }

  const sharedMessages = [
    ...conversationHistory.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user" as const, content: message },
  ];

  if (anthropic) {
    try {
      const response = await anthropic.messages.create({
        model: "claude-opus-4-5",
        max_tokens: 1024,
        system: systemPrompt,
        messages: sharedMessages as Anthropic.MessageParam[],
      });

      const assistantMessage =
        response.content[0]?.type === "text"
          ? response.content[0].text
          : "I'm sorry, I couldn't process that request.";

      res.json({ message: assistantMessage, mode, projectId });
      return;
    } catch (err) {
      req.log.error({ err }, "Anthropic API error");
      res.status(500).json({ error: "ai_error", message: "Failed to get AI response" });
      return;
    }
  }

  if (openai) {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        max_tokens: 1024,
        messages: [
          { role: "system", content: systemPrompt },
          ...sharedMessages,
        ],
      });

      const assistantMessage = response.choices[0]?.message?.content ?? "I'm sorry, I couldn't process that request.";
      res.json({ message: assistantMessage, mode, projectId });
      return;
    } catch (err) {
      req.log.error({ err }, "OpenAI API error");
      res.status(500).json({ error: "ai_error", message: "Failed to get AI response" });
      return;
    }
  }

  const fallback =
    mode === "client_assistant"
      ? "The KONTi Client Assistant is not configured in this environment. Please contact your KONTi project manager for assistance."
      : "The KONTi Internal Spec Bot is not configured in this environment. Please set the ANTHROPIC_API_KEY or OPENAI_API_KEY to enable AI assistance.";
  res.json({ message: fallback, mode, projectId });
});

export default router;
