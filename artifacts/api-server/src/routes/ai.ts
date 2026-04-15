import { Router, type IRouter } from "express";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { PROJECTS, PROJECT_TASKS, DOCUMENTS, WEATHER_DATA } from "../data/seed";

const router: IRouter = Router();

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
- Phase: ${project.phaseLabel} (Phase ${project.phaseNumber} of 6)
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

${projectSection}

COMPANY CONTEXT:
${KONTI_CONTEXT}

IMPORTANT: Only answer questions about this specific project and general KONTi company information. Do not discuss other clients or projects.`;
}

const INTERNAL_SYSTEM_PROMPT = `You are the KONTi Internal Spec Bot — a precise, technical AI assistant for the internal KONTi Design | Build Studio team. You have full access to all project data, documents, and specifications.

Answer in the same language the team member uses (English or Spanish). Be technical, precise, and thorough. Reference specific document names, quantities, and specifications when asked.

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

router.post("/ai/chat", async (req, res) => {
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
