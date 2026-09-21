# 核心引擎层详细实现计划

> 对应总览：[01-engine-implementation.md](./01-engine-implementation.md)  
> 关联：[20-plugin-layer.md](./20-plugin-layer.md) · [30-business-layer.md](./30-business-layer.md)

## 1. 目标与非目标

### 目标

实现所有画卷共用的运行时：**统一视口 / 输入 / 瓦片 / 资源 / 命中 / 单 RAF 调度**，以及 **PixiJS 主渲染适配器 + Three.js 按需适配器**。对外提供 `ScrollEngine.create` / `loadContent` / `destroy`，并内建最小 **插件宿主**（插件细节见 20）。

### 非目标（本层禁止）

- 任何单画剧情（虹桥、时雨、南巡仪仗等）→ 进 `contents/*/story`
- 生图 API、自动出图
- 共享 WebGL 上下文做深度交错
- 浏览器内对超大原图现场切片

## 2. 包划分与依赖规则

```text
packages/
├── core/              # Engine、Viewport、Input、Scheduler、EventBus、PluginHost
├── scene/             # SceneDocument 类型、加载、实体注册表
├── assets/            # AssetManager、取消令牌、字节预算 LRU
├── tiles/             # TileManager、LOD、manifest 解析
├── interaction/       # SpatialIndex、InteractionManager、手势结果→命中
├── animation/         # 序列帧 / 路径 / 参数动画（通用，无业务语义）
├── renderer-pixi/     # PixiAdapter：创建应用、世界根、瓦片精灵、sync/render
└── renderer-three/    # ThreeAdapter：lazy import、正交相机、sync/render
```

**依赖规则（CI 用 dependency-cruiser 或自定义脚本强制）：**

| 包 | 可依赖 | 禁止 |
|---|---|---|
| `core` | 无渲染库 | `pixi.js` / `three` / `contents/*` |
| `scene` / `assets` / `tiles` / `interaction` / `animation` | `core` 类型 | pixi / three |
| `renderer-pixi` | `core` 契约 + pixi | three、业务 story |
| `renderer-three` | `core` 契约 + three | pixi、业务 story |

共享契约放在 `packages/core/src/contracts/`（或 `@handscroll/core` 导出）。

## 3. 关键契约（TypeScript）

```ts
// packages/core/src/contracts/viewport.ts
export interface SceneMeta {
  id: string;
  width: number;
  height: number;
}

export interface ViewportState {
  centerX: number;
  centerY: number;
  zoom: number; // CSS px / world unit
  screenWidth: number;
  screenHeight: number;
}

export interface ViewportController {
  getState(): ViewportState;
  setSize(w: number, h: number): void;
  panByScreen(dx: number, dy: number): void;
  zoomAtScreen(factor: number, screenX: number, screenY: number): void;
  clampToScene(meta: SceneMeta): void;
  flyTo(opts: { centerX: number; centerY: number; zoom: number; duration: number }): void;
  update(dt: number): void; // 惯性 / flyTo 插值
  screenToWorld(sx: number, sy: number): { x: number; y: number };
  worldToScreen(wx: number, wy: number): { x: number; y: number };
}
```

```ts
// packages/core/src/contracts/hit.ts
export interface HitResult {
  entityId: string;
  renderer: "pixi" | "three" | "dom";
  interactionPriority: number;
  worldX: number;
  worldY: number;
}
```

```ts
// packages/core/src/contracts/engine.ts
export interface EngineConfig {
  container: HTMLElement;
  renderers: { pixi: true; three: false | "lazy" };
  quality?: "auto" | "low" | "medium" | "high";
  dprMax?: number;
}

export interface CachePolicy {
  gpuBudgetBytes: number;
  decodedBudgetBytes: number;
  maxConcurrentRequests: number;
  maxUploadsPerFrame: number;
}

export type SchedulerMode = "continuous" | "on-demand";
```

世界坐标约定：原点画卷左上，X 右 Y 下，单位 = 原图逻辑像素；DPR 不进入业务坐标。

## 4. 源码文件树（建议一次建齐空壳）

```text
packages/core/src/
├── index.ts
├── Engine.ts
├── EventBus.ts
├── PluginHost.ts
├── viewport/ViewportController.ts
├── input/InputManager.ts
├── input/GestureState.ts
├── scheduler/RenderScheduler.ts
└── contracts/{viewport,hit,engine,plugin}.ts

packages/tiles/src/
├── TileManager.ts
├── LodSelector.ts
├── TileCache.ts
└── parseManifest.ts

packages/assets/src/
├── AssetManager.ts
├── PriorityQueue.ts
└── ByteLru.ts

packages/interaction/src/
├── InteractionManager.ts
├── FlatbushIndex.ts
└── pick.ts

packages/scene/src/
├── loadScene.ts
├── EntityRegistry.ts
└── schema.ts          # 基础类型；完整 Zod 可与业务层共用 @handscroll/scene

packages/renderer-pixi/src/
├── PixiRenderer.ts
├── WorldRoot.ts
└── TileLayer.ts

packages/renderer-three/src/
├── ThreeRenderer.ts
├── OrthoCameraSync.ts
└── createLazyThree.ts
```

## 5. 实现顺序与要点

### 5.1 Phase E0 — Engine 壳 + EventBus + Scheduler

```ts
// Engine.ts（骨架）
export class ScrollEngine {
  static async create(config: EngineConfig): Promise<ScrollEngine> { /* ... */ }

  readonly events: EventBus;
  readonly camera: ViewportController;
  readonly plugins: PluginHost;

  async loadContent(scrollId: string): Promise<void> {
    // 1) fetch contents/<id>/meta.json（路径由宿主注入 ContentResolver）
    // 2) plugins.loadFromMeta(meta.plugins)
    // 3) tiles.load(manifest)
    // 4) scene.load(scene.json)
    // 5) dynamic import story → registerStory(this)（业务约定，见 30）
    this.scheduler.requestFrame();
  }

  async destroy(): Promise<void> {
    this.scheduler.stop();
    this.input.detach();
    await this.plugins.destroyAll();
    this.pixi?.destroy();
    this.three?.destroy();
    this.assets.cancelAll();
    this.tiles.clear();
  }
}
```

`ContentResolver` 由 `apps/viewer` 注入（Vite 静态资源或 fetch），**core 不写死** `/contents` 磁盘路径。

**Scheduler：**

```ts
function frame(now: number) {
  const dt = Math.min((now - prev) / 1000, 0.05);
  input.update(dt);
  viewport.update(dt);
  tiles.update(viewport.getState());
  animation.update(dt);
  plugins.broadcast("onFrame", dt, viewport.getState());
  pixi.sync(viewport.getState());
  three?.sync(viewport.getState());
  if (needPixi) pixi.render();
  if (needThree) three.render();
  if (mode === "continuous" || pendingWake) scheduleNext();
}
```

静止默认 `on-demand`；拖动/惯性/动画/插件注册 active task 时升为 `continuous`。资源完成必须 `scheduler.wake()`。

### 5.2 Phase E1 — Viewport + Input

**Viewport 转换：**

```ts
screenX = (worldX - centerX) * zoom + screenWidth / 2;
worldX  = (screenX - screenWidth / 2) / zoom + centerX;
// Y 同理
```

**绕点缩放：** 先把指针转为世界坐标 W → 改 zoom → 调 center，使 W 仍映射到原屏幕点。

**Input 状态机：** `Idle → Pressed → Dragging | Pinching → Inertia`；`CameraTransition`（flyTo）中用户按下立即打断。使用 Pointer Events + `setPointerCapture`；处理 `pointercancel`、`visibilitychange`。

滚轮：viewer 全屏模式 `preventDefault`；嵌入模式可配置。

### 5.3 Phase E2 — Tiles + Assets

**manifest 示例字段：** `width, height, tileSize, levels[{id,scale}], tileUrl` 模板。

**每帧：** 可见世界矩形 → LOD（`levelScale ≈ zoom * renderDpr`，带滞回）→ 所需瓦片集 → 与已有/在途求差 → 优先级队列 → 限并发 → 限每帧上传。

优先级：P0 可视缺失背景 → P1 当前交互主体 → P2 边缘预载 → P3 运动方向 → P4 远处。

`ByteLru`：按估算字节淘汰；**正在显示与低清回退瓦片钉住**。

### 5.4 Phase E3 — Pixi / Three 适配器

**DOM：**

```html
<div class="viewer">
  <canvas class="pixi-layer"></canvas>
  <canvas class="three-layer"></canvas>
  <div class="ui-layer"></div>
</div>
```

Three canvas：`pointer-events: none`。输入只绑在容器上。

**Pixi sync：** 世界根 `scale = zoom`，`position = (sw/2 - centerX*zoom, sh/2 - centerY*zoom)`。关闭 Pixi 自动 render。

**Three sync（正交）：** 画卷 `(x,y) → (x,-y,z)`；`visibleW = sw/zoom` 等设 left/right/top/bottom；`camera.position.set(centerX, -centerY, dist)`。`three: "lazy"` 时首次需要 model3d 或水效插件再 `import('three')`。

### 5.5 Phase E4 — Interaction + Scene 实体挂载

热点数据进 Flatbush；流程：屏幕 → 世界 → 粗筛 → 几何精确 → 按 `interactionPriority` 排序 → `entity:click`。Three Raycaster **仅**可交互模型，结果并入同一 `HitResult`（优先级按合成层，禁止混用 zIndex 与相机距离原始值）。

实体类型（引擎认识）：`sprite | animation | hotspot | model3d`（可扩展，扩展字段进业务数据，不进 core 分支剧情）。

### 5.6 destroy 清单（测试强制）

RAF、DOM 监听、进行中的 fetch、Pixi 纹理/容器、Three 几何材质渲染器、Worker、插件 `onDestroy`、共享纹理引用计数。

## 6. 验证脚本

在根 `package.json`（示意）：

```json
{
  "scripts": {
    "typecheck": "pnpm -r typecheck",
    "test:unit": "vitest run",
    "test:unit:watch": "vitest",
    "test:dep": "node tools/check-deps.mjs",
    "test:engine": "vitest run packages/core packages/tiles packages/assets packages/interaction",
    "playground": "pnpm --filter playground dev",
    "test:e2e": "pnpm --filter viewer exec playwright test",
    "bench:tiles": "pnpm --filter playground exec node ../../tools/bench-tiles.mjs"
  }
}
```

### 手工验证清单（playground）

1. 加载仅含 tiles 的 demo pack，拖动/滚轮缩放流畅，瓦片无大面积闪白。  
2. 缩小到 overview 再放大，LOD 滞回无抖动。  
3. 快速甩动后惯性停止，松手后不再错误加载沿途高清（或可接受降级）。  
4. 开启 three lazy：锚点方块与二维热点世界坐标对齐（误差 ≤ 1px @ zoom=1）。  
5. 连续 `loadContent` A→B→A 十次，Chrome Performance/Memory 无单调泄漏。  
6. `destroy` 后 RAF 停止（devtools）。  

## 7. 测试用例

| ID | 类型 | 模块 | 步骤 | 期望 |
|---|---|---|---|---|
| E-U-01 | unit | Viewport | `screenToWorld` / `worldToScreen` 往返 | 误差 < 1e-6 |
| E-U-02 | unit | Viewport | `zoomAtScreen` 后指针下世界点不变 | 点坐标不变 |
| E-U-03 | unit | Viewport | `clampToScene` | center 不越出允许范围 |
| E-U-04 | unit | Viewport | `flyTo` 打断 | Pressed 时 transition 取消 |
| E-U-05 | unit | Input | 阈值内移动 | 仍为 Pressed，非 Dragging |
| E-U-06 | unit | Input | 双指缩放 | 进入 Pinching，中心为两指中点 |
| E-U-07 | unit | LodSelector | 给定 zoom/dpr | 选中期望 level；临界带滞回 |
| E-U-08 | unit | TileManager | 视口移动 | 旧请求被 cancel/忽略；新集正确 |
| E-U-09 | unit | ByteLru | 超预算 | 钉住瓦片不删；其它按 LRU |
| E-U-10 | unit | AssetManager | 同 URL 并发 | 合并为单次请求 |
| E-U-11 | unit | pick | 重叠热点 | 高 priority 先返回 |
| E-U-12 | unit | Scheduler | on-demand + wake | 资源完成触发恰好一帧 |
| E-U-13 | unit | EventBus | off 后 emit | 不回调 |
| E-I-01 | integration | Engine+Pixi | create→load tiles→destroy | 无抛错；canvas 移除 |
| E-I-02 | integration | Engine+Three lazy | 无 model 时 | 不加载 three chunk |
| E-I-03 | integration | 坐标对齐 | 同世界点 pixi 与 three | 投影误差阈值内 |
| E-I-04 | integration | 切换 content | A→B | A 资源释放；B 可见 |
| E-E-01 | e2e | viewer | 打开 demo | 首屏有低清；可拖动 |
| E-E-02 | e2e | viewer | 点击 hotspot | 收到 click / 面板打开 |
| E-E-03 | e2e | viewer | 缩放绕指针 | 焦点附近内容不瞬移跑飞 |
| E-D-01 | dep | CI | `test:dep` | core 无 pixi/three import |
| E-P-01 | perf | bench | 录制拖动 5s | p95 帧耗时 ≤ 24ms（目标机） |

Playwright 示例断言方向：`page.locator('.pixi-layer')` 可见；拖拽后截图或读引擎测试钩子 `window.__handscroll__.getViewport()`（仅 playground/test 注入）。

## 8. 性能预算与测量

| 指标 | 预算 | 测量 |
|---|---|---|
| 拖动 p95 frame | ≤ 24ms（理想 ≤ 16ms） | `bench:tiles` + PerformanceObserver |
| 首屏有内容 | ≤ 2s（视网络） | LCP / 自定义 mark `first-tile` |
| 首屏可交互 | ≤ 3s | mark `input-ready` |
| GPU 缓存 | 按档位字节预算 | TileCache 统计 |
| three 未用时 | 0 three 网络请求 | Playwright request 日志 |

## 9. Definition of Done

**E0：** monorepo 可 typecheck；Engine create/destroy 空转；`test:dep` 绿。  
**E1：** Viewport+Input 单测全绿；playground 纯色世界可拖缩放。  
**E2：** 任意 raw 长图经 tile-builder 后可浏览；E-U-07..09、E-E-01 绿。  
**E3：** 双 Canvas sync；E-I-02/03 绿；ADR 记录拓扑结论。  
**E4：** 热点点击 E-E-02 绿；`loadContent` 切换 E-I-04 绿；destroy 泄漏检查通过。

## 10. 实现排期建议

| 周次 | 交付 |
|---|---|
| W1 | E0 + E1 + playground |
| W2 | E2 瓦片主路径 + 指标草稿 |
| W3 | E3 适配器 + 对齐测试 |
| W4 | E4 命中 + loadContent + e2e 冒烟 |

插件宿主最小实现放在 E0（`PluginHost` 空壳），内置插件填肉见 [20-plugin-layer.md](./20-plugin-layer.md)。
