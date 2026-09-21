import type { ViewportState } from "@handscroll/core";
import {
  Color,
  OrthographicCamera,
  Scene,
  WebGLRenderer,
  type WebGLRendererParameters,
} from "three";

export function syncOrthoCamera(
  camera: OrthographicCamera,
  viewport: ViewportState,
  distance = 1000,
): void {
  const visW = viewport.screenWidth / viewport.zoom;
  const visH = viewport.screenHeight / viewport.zoom;
  camera.left = -visW / 2;
  camera.right = visW / 2;
  camera.top = visH / 2;
  camera.bottom = -visH / 2;
  camera.near = 0.1;
  camera.far = distance * 4;
  camera.position.set(viewport.centerX, -viewport.centerY, distance);
  camera.lookAt(viewport.centerX, -viewport.centerY, 0);
  camera.updateProjectionMatrix();
}

export class ThreeRenderer {
  readonly renderer: WebGLRenderer;
  readonly scene: Scene;
  readonly camera: OrthographicCamera;
  private width = 1;
  private height = 1;

  constructor(canvas: HTMLCanvasElement, params: WebGLRendererParameters = {}) {
    this.renderer = new WebGLRenderer({
      canvas,
      alpha: true,
      antialias: false,
      ...params,
    });
    this.renderer.setClearColor(new Color(0x000000), 0);
    this.scene = new Scene();
    this.camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 4000);
  }

  setSize(width: number, height: number, dpr: number): void {
    this.width = width;
    this.height = height;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(width, height, false);
  }

  sync(viewport: ViewportState): void {
    syncOrthoCamera(this.camera, viewport);
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  destroy(): void {
    this.renderer.dispose();
  }
}
