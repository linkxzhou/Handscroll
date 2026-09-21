# Image generation (deferred)

Handscroll v1 does **not** call an image-generation API.

## Manual workflow

1. Generate or paint a long scroll with any external tool.
2. Drop the file at `contents/<scroll-id>/raw/background.png` (webp/jpg/tif also work).
3. Document source and license in `contents/<scroll-id>/raw/README.md`.
4. Run `pnpm content:tiles -- --id <scroll-id>`.

## Future extension point

A later adapter can write into the same `raw/` contract:

```ts
export interface ImageGenAdapter {
  generate(input: { prompt: string; width: number; height: number }): Promise<{ filePath: string }>;
}
```

Keep generated files in `raw/` so tile-builder and the engine stay unchanged.
