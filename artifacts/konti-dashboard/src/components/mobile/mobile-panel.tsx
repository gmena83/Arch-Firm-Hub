import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronRight, ChevronDown, X } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useMobileV2Flag } from "@/hooks/use-mobile-v2";
import { useLang } from "@/hooks/use-lang";

type ExpandMode = "inline" | "sheet";

type GroupSignal = { command: "open" | "close"; nonce: number } | null;
const MobilePanelGroupCtx = createContext<GroupSignal>(null);

interface MobilePanelGroupProps {
  signal: GroupSignal;
  children: ReactNode;
}

/** Wrap a region of `<MobilePanel>`s so a parent control can broadcast
 *  expand-all / collapse-all commands down to inline panels. */
export function MobilePanelGroup({ signal, children }: MobilePanelGroupProps) {
  const value = useMemo(() => signal, [signal?.command, signal?.nonce]);
  return <MobilePanelGroupCtx.Provider value={value}>{children}</MobilePanelGroupCtx.Provider>;
}

interface MobilePanelProps {
  title: string;
  summary?: string;
  icon?: ReactNode;
  statusChip?: ReactNode;
  expandMode?: ExpandMode;
  defaultOpen?: boolean;
  forceOpen?: boolean;
  testId?: string;
  children: ReactNode;
}

/**
 * MobilePanel — minimalist mobile presentation wrapper (Task #165).
 *
 * On screens ≥768px OR when the mobile-V2 flag is off, renders children
 * inline with no extra chrome. On mobile + V2, renders a compact card
 * (title + one-line summary + chevron) that expands either inline with
 * an animation, or into a full-screen sheet for long content.
 *
 * Existing functionality (uploads, edits, etc.) is preserved — this is
 * a presentation change only.
 */
export function MobilePanel({
  title,
  summary,
  icon,
  statusChip,
  expandMode = "inline",
  defaultOpen = false,
  forceOpen = false,
  testId,
  children,
}: MobilePanelProps) {
  const isMobile = useIsMobile();
  const [v2] = useMobileV2Flag();
  const [open, setOpen] = useState<boolean>(defaultOpen || forceOpen);
  const groupSignal = useContext(MobilePanelGroupCtx);

  useEffect(() => {
    if (forceOpen) setOpen(true);
  }, [forceOpen]);

  useEffect(() => {
    if (!groupSignal) return;
    // Only inline panels respond to expand-all / collapse-all; sheet
    // panels stay closed because opening them would stack modals.
    if (expandMode !== "inline") return;
    setOpen(groupSignal.command === "open");
  }, [groupSignal, expandMode]);

  const active = isMobile && v2 && !forceOpen;

  if (!active) {
    return <>{children}</>;
  }

  const ChevronIcon = open && expandMode === "inline" ? ChevronDown : ChevronRight;

  return (
    <div
      data-testid={testId ?? `mobile-panel-${title.toLowerCase().replace(/\s+/g, "-")}`}
      className="bg-card rounded-xl border border-card-border shadow-sm"
    >
      <button
        type="button"
        onClick={() => {
          if (expandMode === "sheet") setOpen(true);
          else setOpen((o) => !o);
        }}
        aria-expanded={expandMode === "inline" ? open : undefined}
        className="w-full text-left px-4 py-3.5 min-h-[56px] flex items-center gap-3 active:bg-muted/40 transition-colors rounded-xl"
      >
        {icon && <span className="text-konti-olive shrink-0">{icon}</span>}
        <span className="flex-1 min-w-0">
          <span className="block font-semibold text-foreground text-sm leading-tight truncate">{title}</span>
          {summary && (
            <span className="block text-xs text-muted-foreground mt-0.5 truncate">{summary}</span>
          )}
        </span>
        {statusChip && <span className="shrink-0">{statusChip}</span>}
        <ChevronIcon className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden />
      </button>

      {expandMode === "inline" && open && (
        <div className="px-4 pb-4 pt-1 border-t border-border/60 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 motion-safe:duration-150">
          {children}
        </div>
      )}

      {expandMode === "sheet" && open && (
        <MobileSheet title={title} icon={icon} onClose={() => setOpen(false)}>
          {children}
        </MobileSheet>
      )}
    </div>
  );
}

interface MobileSheetProps {
  title: string;
  icon?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}

export function MobileSheet({ title, icon, onClose, children }: MobileSheetProps) {
  const { t } = useLang();
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previouslyFocusedRef.current = (document.activeElement as HTMLElement) ?? null;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    closeBtnRef.current?.focus();

    const focusableSelector = [
      "a[href]",
      "button:not([disabled])",
      "textarea:not([disabled])",
      "input:not([disabled])",
      "select:not([disabled])",
      "[tabindex]:not([tabindex='-1'])",
    ].join(",");

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !sheetRef.current) return;
      const nodes = sheetRef.current.querySelectorAll<HTMLElement>(focusableSelector);
      if (nodes.length === 0) {
        e.preventDefault();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (active === first || !sheetRef.current.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      previouslyFocusedRef.current?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      ref={sheetRef}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-testid="mobile-sheet"
      className="fixed inset-0 z-50 bg-background flex flex-col motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-150"
    >
      <div className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
        <button
          ref={closeBtnRef}
          type="button"
          onClick={onClose}
          aria-label={t("Close", "Cerrar")}
          data-testid="mobile-sheet-close"
          className="w-11 h-11 rounded-md flex items-center justify-center hover:bg-muted text-muted-foreground active:bg-muted/70"
        >
          <X className="w-5 h-5" />
        </button>
        {icon && <span className="text-konti-olive shrink-0">{icon}</span>}
        <h2 className="font-bold text-foreground text-base flex-1 truncate">{title}</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-4">{children}</div>
    </div>
  );
}

interface MobileExpandToggleProps {
  onExpandAll: () => void;
  onCollapseAll: () => void;
  allExpanded: boolean;
}

/** "Expand all / Collapse all" control shown above long card stacks. */
export function MobileExpandToggle({ onExpandAll, onCollapseAll, allExpanded }: MobileExpandToggleProps) {
  const { t } = useLang();
  const isMobile = useIsMobile();
  const [v2] = useMobileV2Flag();
  if (!isMobile || !v2) return null;
  return (
    <div className="flex justify-end -mb-1">
      <button
        type="button"
        onClick={allExpanded ? onCollapseAll : onExpandAll}
        className="text-xs min-h-[44px] px-3 py-1.5 rounded-md border border-border bg-card text-muted-foreground hover:bg-muted active:bg-muted/70"
        data-testid="mobile-expand-toggle"
      >
        {allExpanded ? t("Collapse all", "Cerrar todo") : t("Expand all", "Abrir todo")}
      </button>
    </div>
  );
}

/** Convenience hook to drive `<MobilePanelGroup>` + `<MobileExpandToggle>`. */
export function useMobilePanelGroup() {
  const [signal, setSignal] = useState<GroupSignal>(null);
  const [allExpanded, setAllExpanded] = useState(false);
  return {
    signal,
    allExpanded,
    onExpandAll: () => { setAllExpanded(true); setSignal({ command: "open", nonce: Date.now() }); },
    onCollapseAll: () => { setAllExpanded(false); setSignal({ command: "close", nonce: Date.now() }); },
  };
}
