import {
  DoubleSide,
  Group,
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
} from "three";

export interface WaterBand {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface WaterEffectHandle {
  object: Group;
  setTime(t: number): void;
  dispose(): void;
}

const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAGMENT = /* glsl */ `
uniform float uTime;
varying vec2 vUv;
void main() {
  float ripple = sin(vUv.x * 22.0 + uTime * 1.35) * 0.5
    + sin(vUv.y * 14.0 - uTime * 0.95 + vUv.x * 3.0) * 0.5;
  vec3 deep = vec3(0.18, 0.36, 0.42);
  vec3 highlight = vec3(0.52, 0.68, 0.62);
  vec3 color = mix(deep, highlight, 0.45 + 0.35 * ripple);
  float alpha = 0.20 + 0.10 * ripple;
  gl_FragColor = vec4(color, clamp(alpha, 0.12, 0.34));
}
`;

/**
 * World-space river planes. Painting (x, y down) maps to Three (x, -y, z)
 * to match the ortho camera in ADR 0001.
 */
export function createWaterEffect(bands: readonly WaterBand[]): WaterEffectHandle {
  const group = new Group();
  group.name = "handscroll-water";
  const materials: ShaderMaterial[] = [];
  const geometries: PlaneGeometry[] = [];

  for (const band of bands) {
    if (band.w <= 0 || band.h <= 0) continue;
    const geometry = new PlaneGeometry(band.w, band.h, 1, 1);
    const material = new ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
    });
    const mesh = new Mesh(geometry, material);
    mesh.frustumCulled = false;
    mesh.position.set(band.x + band.w / 2, -(band.y + band.h / 2), 2);
    group.add(mesh);
    materials.push(material);
    geometries.push(geometry);
  }

  return {
    object: group,
    setTime(t: number) {
      for (const material of materials) material.uniforms.uTime!.value = t;
    },
    dispose() {
      group.removeFromParent();
      for (const material of materials) material.dispose();
      for (const geometry of geometries) geometry.dispose();
      group.clear();
    },
  };
}
