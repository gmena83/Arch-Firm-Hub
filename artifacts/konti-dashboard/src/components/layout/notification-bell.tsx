import { useState, useEffect, useRef } from "react";
import { Bell, Upload, CheckSquare, ArrowRight, CloudRain, MessageSquare, X } from "lucide-react";
import { useLang } from "@/hooks/use-lang";

type ActivityType = "document_upload" | "task_completed" | "phase_change" | "weather_alert" | "comment";

interface ActivityItem {
  id: string;
  type: ActivityType;
  projectId: string;
  projectName: string;
  description: string;
  descriptionEs: string;
  actor: string;
  timestamp: string;
}

const ICON_MAP: Record<ActivityType, React.ReactNode> = {
  document_upload: <Upload className="w-3.5 h-3.5" />,
  task_completed: <CheckSquare className="w-3.5 h-3.5" />,
  phase_change: <ArrowRight className="w-3.5 h-3.5" />,
  weather_alert: <CloudRain className="w-3.5 h-3.5" />,
  comment: <MessageSquare className="w-3.5 h-3.5" />,
};

const COLOR_MAP: Record<ActivityType, string> = {
  document_upload: "bg-sky-100 text-sky-600",
  task_completed: "bg-green-100 text-green-600",
  phase_change: "bg-konti-olive/15 text-konti-olive",
  weather_alert: "bg-amber-100 text-amber-600",
  comment: "bg-purple-100 text-purple-600",
};

function formatRelativeTime(iso: string, lang: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return lang === "es" ? "ahora" : "now";
  if (mins < 60) return lang === "es" ? `hace ${mins}m` : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return lang === "es" ? `hace ${hrs}h` : `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return lang === "es" ? `hace ${days}d` : `${days}d ago`;
}

const STORAGE_KEY = "konti_notif_read";

export function NotificationBell() {
  const { t, lang } = useLang();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [readTimestamp, setReadTimestamp] = useState<number>(() =>
    Number(localStorage.getItem(STORAGE_KEY) ?? "0")
  );
  const panelRef = useRef<HTMLDivElement>(null);

  const unread = items.filter(
    (a) => new Date(a.timestamp).getTime() > readTimestamp
  ).length;

  useEffect(() => {
    const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
    fetch(`${base}/api/notifications`)
      .then((r) => r.json())
      .then((data: ActivityItem[]) => setItems(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const syncHandler = (e: Event) => {
      setReadTimestamp((e as CustomEvent<number>).detail);
    };
    window.addEventListener("konti-notif-read", syncHandler);
    return () => window.removeEventListener("konti-notif-read", syncHandler);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const markAllRead = () => {
    const maxTs = items.length > 0
      ? Math.max(...items.map((a) => new Date(a.timestamp).getTime())) + 1000
      : Date.now();
    localStorage.setItem(STORAGE_KEY, maxTs.toString());
    window.dispatchEvent(new CustomEvent("konti-notif-read", { detail: maxTs }));
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        data-testid="notification-bell"
        className="relative flex items-center justify-center w-7 h-7 rounded-md text-white/70 hover:text-white hover:bg-white/10 transition-colors"
        title={t("Notifications", "Notificaciones")}
      >
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span
            data-testid="notification-badge"
            className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center leading-none"
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          data-testid="notification-panel"
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute right-0 top-9 w-80 bg-card border border-card-border rounded-xl shadow-xl z-50 overflow-hidden"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <p className="text-sm font-semibold text-foreground">{t("Notifications", "Notificaciones")}</p>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  data-testid="mark-all-read"
                  className="text-xs text-konti-olive hover:text-konti-olive/80 font-medium transition-colors"
                >
                  {t("Mark all read", "Marcar todo leído")}
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-border">
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                {t("No notifications.", "Sin notificaciones.")}
              </p>
            ) : (
              items.map((item) => (
                <div
                  key={item.id}
                  data-testid={`notification-item-${item.id}`}
                  className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
                >
                  <span className={`mt-0.5 p-1.5 rounded-full shrink-0 ${COLOR_MAP[item.type]}`}>
                    {ICON_MAP[item.type]}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground leading-snug">
                      {lang === "es" ? item.descriptionEs : item.description}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {item.projectName} · {formatRelativeTime(item.timestamp, lang)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
