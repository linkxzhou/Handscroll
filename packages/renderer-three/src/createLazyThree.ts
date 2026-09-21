import type { RendererAdapter, ViewportState } from "@handscroll/core";

/**
 * Dual-canvas Three overlay. Does **not** import `three` until `ensureLoaded()`.
 * Engine only calls that when a model3d entity (or a plugin) needs WebGL 3D.
 */
export function createLazyThreeRenderer(): RendererAdapter {
  return new LazyThreeAdapter();
}

type OverlayObject = {
  isObject3D?: boolean;
  removeFromParent?: () => void;
};

type InnerHost = {
  scene: { add(object: unknown): void; remove(object: unknown): void };
  setSize(width: number, height: number, dpr: number): void;
  sync(viewport: ViewportState): void;
  render(): void;
  destroy(): void;
};

function isObject3D(object: unknown): object is OverlayObject {
  return Boolean(object && typeof object === "object" && (object as OverlayObject).isObject3D === true);
}

class LazyThreeAdapter implements RendererAdapter {
  readonly kind = "three" as const;
  private canvas: HTMLCanvasElement | null = null;
  private inner: InnerHost | null = null;
  private loadPromise: Promise<void> | null = null;
  private width = 1;
  private height = 1;
  private dpr = 1;
  private lastViewport: ViewportState | null = null;
  private readonly overlays = new Set<unknown>();

  async mount(container: HTMLElement): Promise<HTMLCanvasElement> {
    const canvas = document.createElement("canvas");
    canvas.className = "three-layer";
    canvas.style.pointerEvents = "none";
    container.appendChild(canvas);
    this.canvas = canvas;
    this.width = Math.max(1, container.clientWidth);
    this.height = Math.max(1, container.clientHeight);
    canvas.width = this.width;
    canvas.height = this.height;
    return canvas;
  }

  async ensureLoaded(): Promise<void> {
    if (this.inner) return;
    if (!this.loadPromise) {
      this.loadPromise = (async () => {
        const { ThreeRenderer } = await import("./ThreeRenderer.ts");
        if (!this.canvas) throw new Error("Three canvas missing");
        const inner = new ThreeRenderer(this.canvas);
        inner.setSize(this.width, this.height, this.dpr);
        if (this.lastViewport) inner.sync(this.lastViewport);
        this.inner = inner as unknown as InnerHost;
        this.flushOverlays();
      })();
    }
    await this.loadPromise;
  }

  needsThree(): boolean {
    return this.inner !== null;
  }

  attachOverlay(object: unknown): void {
    this.overlays.add(object);
    this.flushOverlay(object);
  }

  detachOverlay(object: unknown): void {
    this.overlays.delete(object);
    this.removeOverlay(object);
  }

  setSize(width: number, height: number, dpr: number): void {
    this.width = width;
    this.height = height;
    this.dpr = dpr;
    this.inner?.setSize(width, height, dpr);
  }

  sync(viewport: ViewportState): void {
    this.lastViewport = viewport;
    this.inner?.sync(viewport);
  }

  render(): void {
    this.inner?.render();
  }

  destroy(): void {
    for (const object of this.overlays) this.removeOverlay(object);
    this.overlays.clear();
    this.inner?.destroy();
    this.inner = null;
    this.loadPromise = null;
    this.canvas?.remove();
    this.canvas = null;
  }

  private flushOverlays(): void {
    for (const object of this.overlays) this.flushOverlay(object);
  }

  private flushOverlay(object: unknown): void {
    if (!this.inner || !isObject3D(object)) return;
    this.inner.scene.add(object);
  }

  private removeOverlay(object: unknown): void {
    const obj = object as OverlayObject;
    if (typeof obj.removeFromParent === "function") {
      obj.removeFromParent();
      return;
    }
    this.inner?.scene.remove(object);
  }
}
