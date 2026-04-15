import { useState, useRef, useEffect } from "react";
import { useListProjects, useSendChatMessage } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/app-layout";
import { RequireAuth } from "@/hooks/use-auth";
import { useLang } from "@/hooks/use-lang";
import { Send, Trash2, Bot, User, Loader2, MessageSquare, Briefcase } from "lucide-react";

type ChatMode = "client_assistant" | "internal_spec_bot";

interface Message {
  role: "user" | "assistant";
  content: string;
}

function ChatInterface({ mode, projectId }: { mode: ChatMode; projectId: string }) {
  const { t } = useLang();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const mutation = useSendChatMessage();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, mutation.isPending]);

  const send = () => {
    if (!input.trim() || mutation.isPending) return;
    const userMsg: Message = { role: "user", content: input };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");

    mutation.mutate(
      {
        data: {
          message: input,
          mode,
          projectId: projectId || undefined,
          conversationHistory: messages,
        },
      },
      {
        onSuccess: (data) => {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: data.message },
          ]);
        },
        onError: () => {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: t(
                "I'm having trouble connecting. Please try again.",
                "Tengo problemas para conectarme. Por favor intente de nuevo."
              ),
            },
          ]);
        },
      }
    );
  };

  const isClient = mode === "client_assistant";

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0" data-testid={`chat-messages-${mode}`}>
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="w-14 h-14 rounded-full bg-konti-olive/10 flex items-center justify-center mb-4">
              <Bot className="w-7 h-7 text-konti-olive" />
            </div>
            <h3 className="font-semibold text-foreground mb-1">
              {isClient
                ? t("Welcome to KONTi Client Assistant", "Bienvenido al Asistente KONTi")
                : t("KONTi Internal Spec Bot", "Bot de Especificaciones Internas KONTi")}
            </h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              {isClient
                ? t("Ask me about your project progress, timelines, and next steps.", "Pregúntame sobre el progreso de tu proyecto, plazos y próximos pasos.")
                : t("Ask me about specifications, documents, material quantities, permit requirements.", "Pregúntame sobre especificaciones, documentos, cantidades de materiales, requisitos de permisos.")}
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
            data-testid={`chat-msg-${i}`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
              msg.role === "user" ? "bg-konti-slate text-white" : "bg-konti-olive text-white"
            }`}>
              {msg.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>
            <div
              className={`max-w-xs md:max-w-md rounded-2xl px-4 py-3 text-sm ${
                msg.role === "user"
                  ? "bg-konti-olive text-white rounded-tr-sm"
                  : "bg-card border border-card-border text-foreground rounded-tl-sm"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {mutation.isPending && (
          <div className="flex gap-3" data-testid="typing-indicator">
            <div className="w-8 h-8 rounded-full bg-konti-olive flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="bg-card border border-card-border rounded-2xl rounded-tl-sm px-4 py-3">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
            placeholder={
              isClient
                ? t("Ask about your project...", "Pregunta sobre tu proyecto...")
                : t("Ask about specs, materials, permits...", "Pregunta sobre especificaciones, materiales, permisos...")
            }
            data-testid={`chat-input-${mode}`}
            className="flex-1 px-4 py-2.5 rounded-full border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <button
            onClick={send}
            disabled={!input.trim() || mutation.isPending}
            data-testid={`btn-send-${mode}`}
            className="w-10 h-10 rounded-full bg-konti-olive hover:bg-konti-olive/90 text-white flex items-center justify-center transition-colors disabled:opacity-40 shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AiAssistantPage() {
  const { t } = useLang();
  const { data: projects = [] } = useListProjects();
  const [activeMode, setActiveMode] = useState<ChatMode>("client_assistant");
  const [projectId, setProjectId] = useState("");
  const [keys, setKeys] = useState({ client_assistant: 0, internal_spec_bot: 0 });

  const clearChat = () => {
    setKeys((prev) => ({ ...prev, [activeMode]: prev[activeMode] + 1 }));
  };

  return (
    <RequireAuth>
      <AppLayout>
        <div className="space-y-4 h-full" data-testid="ai-assistant-page">
          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-bold text-foreground">{t("AI Assistant", "Asistente IA")}</h1>
              <p className="text-muted-foreground text-sm mt-1">
                {t("Powered by Claude — KONTi's architecture intelligence.", "Desarrollado por Claude — inteligencia arquitectónica de KONTi.")}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                data-testid="ai-project-selector"
                className="px-3 py-2 rounded-md border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="">{t("All Projects", "Todos los Proyectos")}</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <button
                onClick={clearChat}
                data-testid="btn-clear-chat"
                className="flex items-center gap-1.5 px-3 py-2 rounded-md border border-border text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
              >
                <Trash2 className="w-4 h-4" /> {t("Clear", "Limpiar")}
              </button>
            </div>
          </div>

          {/* Mode tabs */}
          <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit" data-testid="mode-tabs">
            <button
              onClick={() => setActiveMode("client_assistant")}
              data-testid="tab-client-assistant"
              className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeMode === "client_assistant" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              {t("Client Assistant", "Asistente del Cliente")}
            </button>
            <button
              onClick={() => setActiveMode("internal_spec_bot")}
              data-testid="tab-spec-bot"
              className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeMode === "internal_spec_bot" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              <Briefcase className="w-3.5 h-3.5" />
              {t("Internal Spec Bot", "Bot de Especificaciones")}
            </button>
          </div>

          {/* Chat area */}
          <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden" style={{ height: "calc(100vh - 280px)", minHeight: 400 }}>
            {activeMode === "client_assistant" ? (
              <ChatInterface key={`client-${keys.client_assistant}`} mode="client_assistant" projectId={projectId} />
            ) : (
              <ChatInterface key={`spec-${keys.internal_spec_bot}`} mode="internal_spec_bot" projectId={projectId} />
            )}
          </div>
        </div>
      </AppLayout>
    </RequireAuth>
  );
}
