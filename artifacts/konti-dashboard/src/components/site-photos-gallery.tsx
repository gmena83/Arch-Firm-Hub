import { useMemo, useState } from "react";
import { Camera, X as XIcon, ImageIcon } from "lucide-react";
import {
  useGetProjectDocuments,
  getGetProjectDocumentsQueryKey,
  type Document,
} from "@workspace/api-client-react";
import { useLang } from "@/hooks/use-lang";
import { resolveSeedImageUrl } from "@/lib/seed-image-url";

export type PhotoCategoryKey =
  | "site_conditions"
  | "construction_progress"
  | "punchlist_evidence"
  | "final";

export const PHOTO_CATEGORY_OPTIONS: Array<{
  key: PhotoCategoryKey;
  label: string;
  labelEs: string;
}> = [
  { key: "site_conditions", label: "Site Conditions", labelEs: "Condiciones del Sitio" },
  { key: "construction_progress", label: "Construction Progress", labelEs: "Progreso de Construcción" },
  { key: "punchlist_evidence", label: "Punchlist Evidence", labelEs: "Evidencia de Punchlist" },
  { key: "final", label: "Final / Completed", labelEs: "Final / Completado" },
];

export function photoCategoryLabel(key: string, lang: "en" | "es"): string {
  const opt = PHOTO_CATEGORY_OPTIONS.find((o) => o.key === key);
  if (!opt) return key;
  return lang === "es" ? opt.labelEs : opt.label;
}

function selectPhotos(
  docs: Document[],
  isClientView: boolean,
): Document[] {
  return docs
    .filter((d) => d.type === "photo")
    .filter((d) => !isClientView || d.isClientVisible)
    .filter((d) => typeof d.photoCategory === "string");
}

// Drive-aware URL pickers (Task #128). When a photo lives in Drive the API
// strips the inline `data:` URL to keep responses small, so we have to fall
// back to the Drive-side URLs. For client role the raw Drive links are
// stripped server-side as well, leaving `driveDownloadProxyUrl` as the only
// safe choice — that's why it's always the last sturdy fallback.
function pickThumbUrl(p: Document): string | undefined {
  return p.driveThumbnailLink ?? p.driveDownloadProxyUrl ?? resolveSeedImageUrl(p.imageUrl);
}
function pickFullUrl(p: Document): string | undefined {
  return p.driveDownloadProxyUrl ?? p.driveWebContentLink ?? resolveSeedImageUrl(p.imageUrl);
}

function groupByCategory(photos: Document[]): Record<PhotoCategoryKey, Document[]> {
  const out: Record<PhotoCategoryKey, Document[]> = {
    site_conditions: [],
    construction_progress: [],
    punchlist_evidence: [],
    final: [],
  };
  for (const p of photos) {
    const k = p.photoCategory as PhotoCategoryKey | undefined;
    if (k && k in out) out[k].push(p);
  }
  return out;
}

interface SitePhotosGalleryProps {
  projectId: string;
  isClientView: boolean;
}

export function SitePhotosGallery({ projectId, isClientView }: SitePhotosGalleryProps) {
  const { t, lang } = useLang();
  const [lightboxId, setLightboxId] = useState<string | null>(null);

  const { data: allDocs = [] } = useGetProjectDocuments(projectId, undefined, {
    query: { enabled: !!projectId, queryKey: getGetProjectDocumentsQueryKey(projectId, undefined) },
  });

  const photos = useMemo(() => selectPhotos(allDocs, isClientView), [allDocs, isClientView]);
  const grouped = useMemo(() => groupByCategory(photos), [photos]);
  const lightbox = useMemo(
    () => (lightboxId ? photos.find((p) => p.id === lightboxId) ?? null : null),
    [lightboxId, photos],
  );

  return (
    <div
      id="photos"
      className="bg-card rounded-xl border border-card-border p-5 shadow-sm scroll-mt-20"
      data-testid="site-photos-gallery"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold text-foreground flex items-center gap-1.5">
          <Camera className="w-4 h-4" /> {t("Site Photos", "Fotos del Sitio")}
        </h2>
        <span className="text-xs text-muted-foreground" data-testid="site-photos-count">
          {photos.length} {t(photos.length === 1 ? "photo" : "photos", photos.length === 1 ? "foto" : "fotos")}
        </span>
      </div>

      {photos.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground" data-testid="site-photos-empty">
          <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">{t("No site photos yet.", "Aún no hay fotos del sitio.")}</p>
          {!isClientView && (
            <p className="text-xs mt-1">{t("Use the Documents Upload to add photos by category.", "Usa el botón Subir en Documentos para agregar fotos por categoría.")}</p>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          {PHOTO_CATEGORY_OPTIONS.map((cat) => {
            const items = grouped[cat.key];
            if (items.length === 0) return null;
            return (
              <div
                key={cat.key}
                data-testid={`photo-category-${cat.key}`}
                className="space-y-2"
              >
                <div className="flex items-center justify-between">
                  <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                    {photoCategoryLabel(cat.key, lang)}
                  </p>
                  <span className="text-[11px] text-muted-foreground/70">
                    {items.length}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {items.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setLightboxId(p.id)}
                      data-testid={`photo-thumb-${p.id}`}
                      className="group relative aspect-square overflow-hidden rounded-lg border border-card-border bg-muted hover:border-konti-olive transition-colors text-left"
                      aria-label={p.caption ?? p.name}
                    >
                      {pickThumbUrl(p) ? (
                        <img
                          src={pickThumbUrl(p)}
                          alt={p.caption ?? p.name}
                          loading="lazy"
                          className="w-full h-full object-cover transition-transform group-hover:scale-105"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                          <ImageIcon className="w-6 h-6" />
                        </div>
                      )}
                      {p.caption && (
                        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent text-white text-[10px] px-2 py-1 line-clamp-2">
                          {p.caption}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          data-testid="photo-lightbox"
          onClick={() => setLightboxId(null)}
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setLightboxId(null); }}
            data-testid="photo-lightbox-close"
            aria-label={t("Close", "Cerrar")}
            className="absolute top-4 right-4 text-white/80 hover:text-white p-2"
          >
            <XIcon className="w-6 h-6" />
          </button>
          <div
            className="max-w-4xl w-full bg-card rounded-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-black">
              {pickFullUrl(lightbox) ? (
                <img
                  src={pickFullUrl(lightbox)}
                  alt={lightbox.caption ?? lightbox.name}
                  className="w-full max-h-[70vh] object-contain"
                  data-testid="photo-lightbox-image"
                />
              ) : (
                <div className="w-full h-64 flex items-center justify-center text-white/60">
                  <ImageIcon className="w-12 h-12" />
                </div>
              )}
            </div>
            <div className="p-4 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
                <h3 className="font-bold text-foreground min-w-0 break-words" data-testid="photo-lightbox-title">
                  {lightbox.name}
                </h3>
                <span className="self-start sm:self-auto text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-konti-olive/10 text-konti-olive border border-konti-olive/30">
                  {photoCategoryLabel(lightbox.photoCategory ?? "", lang)}
                </span>
              </div>
              {lightbox.caption && (
                <p className="text-sm text-foreground" data-testid="photo-lightbox-caption">
                  {lightbox.caption}
                </p>
              )}
              <p className="text-xs text-muted-foreground" data-testid="photo-lightbox-meta">
                {lightbox.uploadedBy} · {new Date(lightbox.uploadedAt).toLocaleDateString(lang === "es" ? "es-PR" : "en-US", { year: "numeric", month: "short", day: "numeric" })}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
