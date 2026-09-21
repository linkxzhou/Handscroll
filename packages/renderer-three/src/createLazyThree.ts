import type { RendererAdapter, ViewportState } from "@handscroll/core";

/**
 * Dual-canvas Three overlay. Does **not** import `three` until `ensureLoaded()`.
 * Engine only calls that when a model3d entity (or a plugin) needs WebGL 3D.
 */
export function createLazyThreeRenderer(): RendererAdapter {
  return new LazyThreeAdapter();
}

class LazyThreeAdapter implements RendererAdapter {
  readonly kind = "three" as const;
  private canvas: HTMLCanvasElement | null = null;
  private inner: {
    setSize(width: number, height: number, dpr: number): void;
    sync(viewport: ViewportState): void;
    render(): void;
    destroy(): void;
  } | null = null;
  private loadPromise: Promise<void> | null = null;
  private width = 1;
  private height = 1;
  private dpr = 1;
  private lastViewport: ViewportState | null = null;

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
        this.inner = inner;
      })();
    }
    await this.loadPromise;
  }

  needsThree(): boolean {
    return this.inner !== null;
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
    this.inner?.destroy();
    this.inner = null;
    this.loadPromise = null;
    this.canvas?.remove();
    this.canvas = null;
  }
}
