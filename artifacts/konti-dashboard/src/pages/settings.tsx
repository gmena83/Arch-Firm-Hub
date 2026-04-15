import { useState } from "react";
import { Settings, User, Bell, Globe } from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { RequireAuth } from "@/hooks/use-auth";
import { useAuth } from "@/hooks/use-auth";
import { useLang } from "@/hooks/use-lang";

export default function SettingsPage() {
  const { user } = useAuth();
  const { t, lang, toggleLang } = useLang();

  const [notifEnabled, setNotifEnabled] = useState<boolean>(() => {
    return localStorage.getItem("konti_notif_pref") !== "false";
  });

  const handleNotifToggle = () => {
    const next = !notifEnabled;
    setNotifEnabled(next);
    localStorage.setItem("konti_notif_pref", next ? "true" : "false");
  };

  const initials = user?.name
    ?.split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) ?? "??";

  const roleLabel: Record<string, [string, string]> = {
    admin: ["Administrator", "Administrador"],
    superadmin: ["Super Administrator", "Super Administrador"],
    architect: ["Architect", "Arquitecto/a"],
    client: ["Client", "Cliente"],
  };

  const [en, es] = roleLabel[user?.role ?? ""] ?? [user?.role ?? "", user?.role ?? ""];

  return (
    <RequireAuth>
      <AppLayout>
        <div className="max-w-2xl space-y-8" data-testid="settings-page">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Settings className="w-6 h-6 text-konti-olive" />
              {t("Settings", "Configuración")}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {t("Manage your profile and preferences.", "Administra tu perfil y preferencias.")}
            </p>
          </div>

          {/* Profile card */}
          <div className="bg-card rounded-xl border border-card-border shadow-sm p-6">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4 flex items-center gap-2">
              <User className="w-4 h-4" />
              {t("Profile", "Perfil")}
            </h2>
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-full bg-konti-olive flex items-center justify-center text-white text-xl font-bold shrink-0">
                {initials}
              </div>
              <div className="space-y-1">
                <p className="text-lg font-semibold text-foreground">{user?.name}</p>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
                <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-konti-olive/15 text-konti-olive font-medium">
                  {t(en, es)}
                </span>
              </div>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              {t(
                "Profile editing is not available in the demo. Contact your administrator to update your information.",
                "La edición del perfil no está disponible en la demo. Contacta a tu administrador para actualizar tu información."
              )}
            </p>
          </div>

          {/* Preferences card */}
          <div className="bg-card rounded-xl border border-card-border shadow-sm p-6 space-y-6">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <Settings className="w-4 h-4" />
              {t("Preferences", "Preferencias")}
            </h2>

            {/* Language toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-start gap-3">
                <Globe className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">{t("Language", "Idioma")}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t("Switch between English and Spanish.", "Cambia entre inglés y español.")}
                  </p>
                </div>
              </div>
              <button
                onClick={toggleLang}
                data-testid="settings-lang-toggle"
                className="flex items-center gap-1 px-3 py-1.5 rounded-md border border-input bg-muted text-sm font-semibold hover:bg-muted/80 transition-colors"
              >
                <span className={lang === "en" ? "text-konti-olive" : "text-muted-foreground"}>EN</span>
                <span className="text-muted-foreground mx-1">|</span>
                <span className={lang === "es" ? "text-konti-olive" : "text-muted-foreground"}>ES</span>
              </button>
            </div>

            <div className="border-t border-border" />

            {/* Notification preference */}
            <div className="flex items-center justify-between">
              <div className="flex items-start gap-3">
                <Bell className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {t("Notifications", "Notificaciones")}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t(
                      "Receive project activity notifications in the sidebar.",
                      "Recibe notificaciones de actividad de proyectos en la barra lateral."
                    )}
                  </p>
                </div>
              </div>
              <button
                role="switch"
                aria-checked={notifEnabled}
                onClick={handleNotifToggle}
                data-testid="settings-notif-toggle"
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-konti-olive/50 ${
                  notifEnabled ? "bg-konti-olive" : "bg-muted-foreground/30"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    notifEnabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      </AppLayout>
    </RequireAuth>
  );
}
