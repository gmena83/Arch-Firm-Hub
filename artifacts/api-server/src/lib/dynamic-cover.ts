// Task #134 — dynamic project card images.
//
// Two completely separate derivations of a project's small "card image",
// driven by who is asking:
//
//   * KONTi roles (admin / architect / team / superadmin)
//     → `liveCoverImage`: the most recent `Document` of `type === "photo"`
//       and `photoCategory === "construction_progress"` for the project,
//       falling back to `project.coverImage` when no qualifying photo
//       exists. The team should see the jobsite as it actually looks today.
//
//   * Client role (`role === "client"`)
//     → `clientCoverImage`: one of five curated KONTi-brand mockup images
//       chosen from the client's `progressPercent` snapped to the nearest
//       landmark (0 / 25 / 50 / 75 / 100). Clients NEVER see real site
//       photos through this field — even if a project has unreviewed
//       jobsite photos sitting in `DOCUMENTS`, the client always gets the
//       polished mockup matching their milestone.
//
// The branch is enforced server-side: the field for the *other* role is
// simply omitted from the payload (rather than nulled out) so a buggy
// client cannot accidentally read what wasn't intended for it.

export interface ProjectShape {
  id: string;
  progressPercent: number;
  coverImage?: string;
}

export interface PhotoDoc {
  type?: string;
  photoCategory?: string;
  uploadedAt?: string;
  imageUrl?: string;
  driveThumbnailLink?: string;
  driveDownloadProxyUrl?: string;
  driveWebContentLink?: string;
}

export type Landmark = 0 | 25 | 50 | 75 | 100;

// Curated mockup ladder for the client view. Each landmark maps to one of
// the bundled KONTi-brand reference images that already ship in
// `artifacts/konti-dashboard/public/seed-images/`. The roots of the URLs
// stay `/seed-images/...` so the dashboard's `resolveSeedImageUrl` helper
// can prepend the artifact base path automatically.
export const MILESTONE_MOCKUP_MAP: Record<Landmark, string> = {
  0: "/seed-images/konti-portfolio-collage.png",
  25: "/seed-images/konti-rain-pond-diagram.png",
  50: "/seed-images/konti-vertical-garden.png",
  75: "/seed-images/konti-elevated-house.png",
  100: "/seed-images/konti-living-space.png",
};

// Snap an arbitrary 0–100 progress integer to its nearest landmark using
// midpoint thresholds 12.5 / 37.5 / 62.5 / 87.5. Values at the midpoint
// round UP (e.g. 12.5 → 25) so the visual progresses cleanly. Values
// outside the 0–100 range clamp to the closest landmark.
export function snapToLandmark(percent: number): Landmark {
  if (!Number.isFinite(percent)) return 0;
  if (percent < 12.5) return 0;
  if (percent < 37.5) return 25;
  if (percent < 62.5) return 50;
  if (percent < 87.5) return 75;
  return 100;
}

export function pickClientCoverImage(project: ProjectShape): {
  url: string;
  landmark: Landmark;
} {
  const landmark = snapToLandmark(project.progressPercent);
  return { url: MILESTONE_MOCKUP_MAP[landmark], landmark };
}

// Drive-aware URL picker for a photo document — mirrors the dashboard's
// `pickThumbUrl` (in `site-photos-gallery.tsx`) so a Drive-hosted photo
// resolves to its thumbnailLink first and the inline imageUrl last. The
// API itself never proxies; if `driveDownloadProxyUrl` is what's set, the
// dashboard already routes that through `/api/integrations/drive/...`.
function pickPhotoUrl(doc: PhotoDoc): string | undefined {
  return (
    doc.driveThumbnailLink ??
    doc.driveDownloadProxyUrl ??
    doc.driveWebContentLink ??
    doc.imageUrl
  );
}

export function pickLiveCoverImage(
  project: ProjectShape,
  docs: PhotoDoc[] | undefined,
): string | undefined {
  const candidates = (docs ?? [])
    .filter((d) => d.type === "photo")
    .filter((d) => d.photoCategory === "construction_progress")
    .filter((d) => typeof d.uploadedAt === "string");
  if (candidates.length === 0) return project.coverImage;
  // Sort by uploadedAt DESC. We re-sort instead of mutating the caller's
  // array to keep the function side-effect free (DOCUMENTS is the live
  // seed object — mutating it would silently reorder the gallery).
  const latest = candidates
    .slice()
    .sort((a, b) => (a.uploadedAt! < b.uploadedAt! ? 1 : -1))[0];
  return pickPhotoUrl(latest!) ?? project.coverImage;
}

// Returns a shallow-merged copy of `project` with the role-appropriate
// derived field attached. The wrong-role field is OMITTED (not nulled) so
// the JSON payload stays minimal and tells client-side TypeScript exactly
// which path the renderer should take.
export function enrichProjectForRole<T extends ProjectShape>(
  project: T,
  role: string | undefined,
  docs: PhotoDoc[] | undefined,
): T & { liveCoverImage?: string; clientCoverImage?: string; clientCoverLandmark?: Landmark } {
  if (role === "client") {
    const { url, landmark } = pickClientCoverImage(project);
    return { ...project, clientCoverImage: url, clientCoverLandmark: landmark };
  }
  const live = pickLiveCoverImage(project, docs);
  if (live === undefined) return { ...project };
  return { ...project, liveCoverImage: live };
}
