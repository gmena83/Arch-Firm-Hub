import { Link, useLocation } from "wouter";
import { LayoutDashboard, FolderOpen, Calculator, Package, MessageSquare, LogOut, Menu, X } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLang } from "@/hooks/use-lang";
import logoWhite from "@assets/Horizontal02_WhitePNG_1776258303461.png";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard", labelEs: "Panel" },
  { href: "/projects", icon: FolderOpen, label: "Projects", labelEs: "Proyectos" },
  { href: "/calculator", icon: Calculator, label: "Calculator", labelEs: "Calculadora" },
  { href: "/materials", icon: Package, label: "Materials", labelEs: "Materiales" },
  { href: "/ai", icon: MessageSquare, label: "AI Assistant", labelEs: "Asistente IA" },
];

export function Sidebar() {
  const [location] = useLocation();
  const { logout, user } = useAuth();
  const { t, lang, toggleLang } = useLang();
  const [mobileOpen, setMobileOpen] = useState(false);

  const NavContent = () => (
    <div className="flex flex-col h-full">
      <div className="px-6 py-6 border-b border-sidebar-border">
        <img src={logoWhite} alt="KONTi" className="h-8 w-auto" />
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1" data-testid="sidebar-nav">
        {navItems.map((item) => {
          const isActive = location.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              data-testid={`nav-${item.href.replace("/", "")}`}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? "bg-konti-olive text-white"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              }`}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {t(item.label, item.labelEs)}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-sidebar-border space-y-2">
        <button
          onClick={toggleLang}
          data-testid="lang-toggle"
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs font-semibold text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
        >
          <span className={lang === "en" ? "text-white" : "opacity-50"}>EN</span>
          <span className="opacity-30">|</span>
          <span className={lang === "es" ? "text-white" : "opacity-50"}>ES</span>
        </button>

        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-konti-olive flex items-center justify-center text-white text-xs font-bold shrink-0">
            {user?.avatar ?? user?.name?.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-sidebar-foreground truncate">{user?.name}</p>
            <p className="text-xs text-sidebar-foreground/50 capitalize">{user?.role}</p>
          </div>
          <button
            onClick={logout}
            data-testid="btn-logout"
            className="text-sidebar-foreground/40 hover:text-sidebar-foreground transition-colors"
            title={t("Logout", "Cerrar sesión")}
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-60 bg-sidebar text-sidebar-foreground shrink-0 h-screen sticky top-0">
        <NavContent />
      </aside>

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-sidebar text-sidebar-foreground px-4 py-3 flex items-center justify-between">
        <img src={logoWhite} alt="KONTi" className="h-6 w-auto" />
        <button onClick={() => setMobileOpen(!mobileOpen)} data-testid="mobile-menu-toggle">
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile slide-out menu */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="w-64 bg-sidebar text-sidebar-foreground h-full pt-14">
            <NavContent />
          </div>
          <div className="flex-1 bg-black/50" onClick={() => setMobileOpen(false)} />
        </div>
      )}
    </>
  );
}
