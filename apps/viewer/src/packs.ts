export type PackMetaLite = {
  id: string;
  title: string;
  era?: string;
  description?: string;
};

export type GalleryPack = PackMetaLite & {
  featured: boolean;
  secondary: boolean;
  coverUrl: string | null;
  href: string;
};

const TEMPLATE_PREFIX = "_";

export function packIdFromMetaPath(filePath: string): string | null {
  const normalized = filePath.replaceAll("\\", "/");
  const match = normalized.match(/\/contents\/([^/]+)\/meta\.json$/) ?? normalized.match(/^contents\/([^/]+)\/meta\.json$/);
  if (!match) return null;
  const id = match[1]!;
  if (!id || id.startsWith(TEMPLATE_PREFIX) || id.startsWith(".")) return null;
  return id;
}

/** Qingming first; other original packs; demo last as a tech card. */
export function featuredRank(id: string): number {
  if (id === "qingming-riverside") return 0;
  if (id === "demo-scroll") return 100;
  return 50;
}

export function isFeaturedPack(id: string): boolean {
  return id === "qingming-riverside";
}

export function isSecondaryPack(id: string): boolean {
  return id === "demo-scroll";
}

export function scrollHref(id: string): string {
  return `/?scroll=${encodeURIComponent(id)}`;
}

export function coverUrlForPack(id: string, hasCover: boolean): string | null {
  if (hasCover) return `/contents/${id}/preview/cover.webp`;
  return `/contents/${id}/tiles/0/0_0.webp`;
}

export function unwrapModule(mod: unknown): unknown {
  if (mod && typeof mod === "object" && "default" in mod) {
    return (mod as { default: unknown }).default;
  }
  return mod;
}

export function assembleGalleryPacks(
  metas: Array<{ path: string; meta: PackMetaLite }>,
  coverIds: Set<string> = new Set(),
): GalleryPack[] {
  const packs: GalleryPack[] = [];
  for (const { path, meta } of metas) {
    const folderId = packIdFromMetaPath(path);
    if (!folderId) continue;
    const id = meta.id || folderId;
    packs.push({
      id,
      title: meta.title,
      era: meta.era,
      description: meta.description,
      featured: isFeaturedPack(id),
      secondary: isSecondaryPack(id),
      coverUrl: coverUrlForPack(id, coverIds.has(id)),
      href: scrollHref(id),
    });
  }
  packs.sort((a, b) => featuredRank(a.id) - featuredRank(b.id) || a.id.localeCompare(b.id));
  return packs;
}

export function loadPublishedPacksFromGlob(
  metaModules: Record<string, unknown>,
  coverModules: Record<string, unknown> = {},
): GalleryPack[] {
  const coverIds = new Set<string>();
  for (const filePath of Object.keys(coverModules)) {
    const normalized = filePath.replaceAll("\\", "/");
    const match = normalized.match(/contents\/([^/]+)\/preview\/cover\./);
    if (match?.[1]) coverIds.add(match[1]);
  }
  const metas = Object.entries(metaModules).flatMap(([path, mod]) => {
    const meta = unwrapModule(mod) as PackMetaLite | undefined;
    if (!meta || typeof meta !== "object") return [];
    return [{ path, meta }];
  });
  return assembleGalleryPacks(metas, coverIds);
}
