import type { ViewportState } from "@handscroll/core";
import {
  BoxGeometry,
  Color,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  Scene,
  WebGLRenderer,
  type WebGLRendererParameters,
} from "three";
import { orthoCameraFromViewport } from "./orthoMath.ts";
import { model3dAnchorsFromEntities } from "./anchors.ts";
import { DEFAULT_ANCHOR_SIZE } from "./worldMap.ts";
import type { SceneEntity } from "@handscroll/core";

export function syncOrthoCamera(
  camera: OrthographicCamera,
  viewport: ViewportState,
  distance = 1000,
): void {
  const pose = orthoCameraFromViewport(viewport, distance);
  camera.left = pose.left;
  camera.right = pose.right;
  camera.top = pose.top;
  camera.bottom = pose.bottom;
  camera.near = pose.near;
  camera.far = pose.far;
  camera.position.set(pose.position.x, pose.position.y, pose.position.z);
  camera.lookAt(pose.lookAt.x, pose.lookAt.y, pose.lookAt.z);
  camera.updateProjectionMatrix();
}

export class ThreeRenderer {
  readonly renderer: WebGLRenderer;
  readonly scene: Scene;
  readonly camera: OrthographicCamera;
  private width = 1;
  private height = 1;
  private readonly anchors = new Map<string, Mesh>();

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

  setSceneEntities(entities: readonly SceneEntity[]): void {
    const wanted = model3dAnchorsFromEntities(entities);
    const keep = new Set(wanted.map((anchor) => anchor.id));
    for (const anchor of wanted) {
      let mesh = this.anchors.get(anchor.id);
      if (!mesh) {
        mesh = createAnchorMesh(anchor.id);
        this.anchors.set(anchor.id, mesh);
        this.scene.add(mesh);
      }
      mesh.position.set(anchor.x, anchor.y, anchor.z);
    }
    for (const [id, mesh] of [...this.anchors]) {
      if (keep.has(id)) continue;
      this.scene.remove(mesh);
      disposeMesh(mesh);
      this.anchors.delete(id);
    }
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  destroy(): void {
    for (const mesh of this.anchors.values()) {
      this.scene.remove(mesh);
      disposeMesh(mesh);
    }
    this.anchors.clear();
    this.renderer.dispose();
  }
}

function createAnchorMesh(id: string): Mesh {
  const geometry = new BoxGeometry(DEFAULT_ANCHOR_SIZE, DEFAULT_ANCHOR_SIZE, DEFAULT_ANCHOR_SIZE);
  const material = new MeshBasicMaterial({ color: 0xe8c36a, transparent: true, opacity: 0.9 });
  const mesh = new Mesh(geometry, material);
  mesh.name = id;
  return mesh;
}

function disposeMesh(mesh: Mesh): void {
  mesh.geometry.dispose();
  const material = mesh.material;
  if (Array.isArray(material)) {
    for (const item of material) item.dispose();
  } else {
    material.dispose();
  }
}
