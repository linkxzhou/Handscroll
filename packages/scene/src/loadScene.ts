import type { ContentMeta, ContentResolver, SceneDocument, StoryModule } from "@handscroll/core";
import { MetaSchema, SceneSchema } from "./schema.ts";

export interface FetchResolverOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export function createFetchResolver(options: FetchResolverOptions = {}): ContentResolver {
  const baseUrl = (options.baseUrl ?? "/contents").replace(/\/$/, "");
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    async loadMeta(scrollId: string): Promise<ContentMeta> {
      const json = await getJson(fetchImpl, `${baseUrl}/${scrollId}/meta.json`);
      const meta = MetaSchema.parse(json);
      return {
        id: meta.id,
        title: meta.title,
        width: meta.width,
        height: meta.height,
        plugins: meta.plugins,
        pluginConfig: meta.pluginConfig,
        defaultViewport: meta.defaultViewport,
        storyEntry: meta.storyEntry,
      };
    },
    async loadManifest(scrollId: string): Promise<unknown> {
      return await getJson(fetchImpl, `${baseUrl}/${scrollId}/tiles/manifest.json`);
    },
    async loadScene(scrollId: string): Promise<SceneDocument> {
      const json = await getJson(fetchImpl, `${baseUrl}/${scrollId}/scene.json`);
      const scene = SceneSchema.parse(json);
      return scene as SceneDocument;
    },
    resolveUrl(scrollId: string, relativePath: string): string {
      const rel = relativePath.replace(/^\.\//, "");
      return `${baseUrl}/${scrollId}/${rel}`;
    },
    async loadStory(_scrollId: string, _entry: string): Promise<StoryModule | null> {
      return null;
    },
  };
}

async function getJson(fetchImpl: typeof fetch, url: string): Promise<unknown> {
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
  return await res.json();
}
