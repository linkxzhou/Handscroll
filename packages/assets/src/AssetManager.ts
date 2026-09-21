export class AssetManager {
  private readonly inflight = new Map<string, Promise<ImageBitmap>>();
  private readonly controllers = new Map<string, AbortController>();
  private generation = 0;

  loadImageBitmap(url: string): Promise<ImageBitmap> {
    const existing = this.inflight.get(url);
    if (existing) return existing;

    const controller = new AbortController();
    this.controllers.set(url, controller);
    const gen = this.generation;

    const promise = (async () => {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
      const blob = await res.blob();
      if (gen !== this.generation) throw new DOMException("cancelled", "AbortError");
      return await createImageBitmap(blob);
    })();

    this.inflight.set(url, promise);
    void promise.finally(() => {
      if (this.inflight.get(url) === promise) {
        this.inflight.delete(url);
        this.controllers.delete(url);
      }
    });
    return promise;
  }

  cancel(url: string): void {
    this.controllers.get(url)?.abort();
    this.inflight.delete(url);
    this.controllers.delete(url);
  }

  cancelAll(): void {
    this.generation += 1;
    for (const c of this.controllers.values()) c.abort();
    this.inflight.clear();
    this.controllers.clear();
  }

  pendingCount(): number {
    return this.inflight.size;
  }
}
