import { useState } from "react";
import { useListMaterials } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/app-layout";
import { RequireAuth } from "@/hooks/use-auth";
import { useLang } from "@/hooks/use-lang";
import { Search, Package } from "lucide-react";

const CATEGORIES = [
  { key: "all", label: "All", labelEs: "Todos" },
  { key: "steel", label: "Steel", labelEs: "Acero" },
  { key: "foundation", label: "Foundation", labelEs: "Fundación" },
  { key: "lumber", label: "Lumber", labelEs: "Madera" },
  { key: "electrical", label: "Electrical", labelEs: "Eléctrico" },
  { key: "plumbing", label: "Plumbing", labelEs: "Plomería" },
  { key: "finishes", label: "Finishes", labelEs: "Acabados" },
  { key: "insulation", label: "Insulation", labelEs: "Aislamiento" },
];

const CAT_COLORS: Record<string, string> = {
  steel: "bg-slate-100 text-slate-700",
  foundation: "bg-stone-100 text-stone-700",
  lumber: "bg-amber-100 text-amber-700",
  electrical: "bg-yellow-100 text-yellow-700",
  plumbing: "bg-sky-100 text-sky-700",
  finishes: "bg-pink-100 text-pink-700",
  insulation: "bg-purple-100 text-purple-700",
};

export default function MaterialsPage() {
  const { t, lang } = useLang();
  const { data: materials = [], isLoading } = useListMaterials();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");

  const filtered = materials.filter((mat) => {
    const matchCat = activeCategory === "all" || mat.category === activeCategory;
    const q = search.toLowerCase();
    const matchSearch = !q || mat.item.toLowerCase().includes(q) || mat.itemEs.toLowerCase().includes(q);
    return matchCat && matchSearch;
  });

  return (
    <RequireAuth>
      <AppLayout>
        <div className="space-y-6" data-testid="materials-page">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Package className="w-6 h-6 text-konti-olive" />
              {t("Materials Library", "Biblioteca de Materiales")}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {t("Reference catalog of all construction materials.", "Catálogo de referencia de todos los materiales de construcción.")}
            </p>
          </div>

          {/* Search + category filters */}
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("Search materials...", "Buscar materiales...")}
                data-testid="materials-search"
                className="w-full pl-9 pr-4 py-2.5 rounded-md border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div className="flex flex-wrap gap-2" data-testid="category-filters">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.key}
                  onClick={() => setActiveCategory(cat.key)}
                  data-testid={`filter-cat-${cat.key}`}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                    activeCategory === cat.key
                      ? "bg-konti-olive text-white"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {lang === "es" ? cat.labelEs : cat.label}
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[...Array(8)].map((_, i) => <div key={i} className="h-12 bg-card rounded-lg border animate-pulse" />)}
            </div>
          ) : (
            <div className="bg-card rounded-xl border border-card-border shadow-sm overflow-hidden">
              <table className="w-full text-sm" data-testid="materials-table">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">{t("Material", "Material")}</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell">
                      {t("Spanish Name", "Nombre en Español")}
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">{t("Category", "Categoría")}</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">{t("Unit", "Unidad")}</th>
                    <th className="text-right px-4 py-3 font-semibold text-muted-foreground">{t("Base Price", "Precio Base")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((mat) => (
                    <tr key={mat.id} data-testid={`material-row-${mat.id}`} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">{mat.item}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{mat.itemEs}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CAT_COLORS[mat.category] ?? "bg-gray-100 text-gray-700"}`}>
                          {mat.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{mat.unit}</td>
                      <td className="px-4 py-3 text-right font-semibold text-foreground">${mat.basePrice.toLocaleString()}</td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                        {t("No materials found.", "No se encontraron materiales.")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          <p className="text-xs text-muted-foreground">{filtered.length} {t("items shown", "elementos mostrados")}</p>
        </div>
      </AppLayout>
    </RequireAuth>
  );
}
