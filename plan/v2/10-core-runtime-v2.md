# v2 核心运行时

> **实施状态：** Phase 1 已完成 · Phase 2 未开始

> 目标：所有长卷共用的**游戏向**运行时。本层禁止画名、禁止 import `pixi.js` / `three`。  
> 渲染器只消费纯数据快照。

## 1. 保留 / 改 / 弃

| 保留 | 改 | 弃（目标态） |
|---|---|---|
| `ScrollEngine.create` / `loadContent` / `destroy` | `frame()` 在插件 `onFrame` 之前推进世界模拟 | story 用 DOM 摆世界坐标物体 |
| `ViewportController`、`InputManager`、`RenderScheduler` 的 on-demand / continuous | 增加 `TimeService`：暂停、时间缩放、时段钩子 | 每个事件模块自己 `requestAnimationFrame` |
| `PluginHost`、`EventBus`、`HitResult` | 触发器把 zone / click / chapter 收成声明 | 只对 hotspot 做命中 |
| `RendererAdapter` 注入 | 适配器增加可选 `setActors` | 在 core 里 `new PIXI.Sprite` |
| scene version 1 可读 | version 2 超集 | 把 v1 包判定为非法 |

## 2. 包边界

```text
packages/core/src/
├── Engine.ts                      # frame 顺序见下
├── time/TimeService.ts            # 新
├── triggers/TriggerRuntime.ts     # 新
└── contracts/
    ├── world.ts                   # ActorSnapshot、WorldSystem 接口
    ├── time.ts
    └── trigger.ts

packages/animation/src/
├── AnimationRuntime.ts            # 保留时钟，供帧相位
├── path.ts                        # 折线长度、pointAlong、跟随步进
└── PathFollower.ts

packages/world/src/                 # 新包，依赖 core + animation + scene 类型
├── WorldRuntime.ts                # 模拟、裁剪、产出快照
└── cull.ts

packages/interaction/src/
├── SpatialIndex.ts                # 替换名不副实的 FlatbushIndex
└── pick.ts                        # 热点 + 可点 actor + zone

packages/scene/src/schema.ts       # version 1 | 2
packages/renderer-pixi/src/
├── TileLayer.ts                   # 保留
└── ActorLayer.ts                  # 新：精灵、可选标签、标记
```

`packages/world` 不进 core 的 import 图：与 tiles 一样，由 `EngineServices` 注入。

```ts
export interface EngineServices {
  assets: AssetSystem;
  tiles: TileSystem;
  interaction: InteractionSystem;
  animation: AnimationSystem;
  world: WorldSystem; // v2 新增
}
```

### 2.1 帧顺序

```ts
function frame(rawDt: number) {
  const dt = time.gameDt(rawDt); // 暂停时为 0；上限仍建议 0.05s，与现 scheduler 一致
  input.update(rawDt);           // 指针不暂停
  camera.update(dt === 0 ? rawDt : dt); // flyTo 用未缩放的墙钟还是游戏钟：见 §4
  tiles.update(viewport, policy, dpr);
  world.update(dt, viewport);    // 跟随、刷新、裁剪、快照
  interaction.sync(world.queryDynamic()); // 可点体的 AABB 跟上位置
  triggers.update(world, camera); // zone / chapter
  animation.update(dt);
  plugins.broadcastFrame(dt, viewport);
  pixi.setTiles(tiles.getVisibleTiles());
  pixi.setActors?.(world.snapshots()); // 无此方法的旧适配器可跳过
  pixi.sync(viewport);
  three?.sync(viewport);
  pixi.render();
  if (three?.needsThree?.()) three.render();
}
```

镜头惯性在暂停时仍可结束（用墙钟），避免松手后永远滑。`flyTo` 默认用墙钟，这样暂停菜单期间章节跳转仍完成。文档把「游戏模拟」和「镜头」分开，不要共用一个被暂停的 dt 却不写清楚。

## 3. 世界实体层（Pixi）

决策全文：[adr/0003-world-actors-pixi.md](./adr/0003-world-actors-pixi.md)。

**世界角色**包括：走动的人、船、车、仪仗、摊位名牌、跟着世界走的标记、桥洞前景条。它们的位置是世界坐标。  
**HUD** 包括：章节轨、解说面板、暂停、音量、任务提示、全屏雨幕。它们的位置是屏幕坐标。

DOM 只允许 HUD。`getUiLayer()` 继续存在，但 review 门禁：story 不得创建带 `left/top` 且每帧跟随 `getViewport()` 的节点。

### 3.1 快照（core 契约，无 Pixi 类型）

```ts
export interface ActorSnapshot {
  id: string;
  x: number;
  y: number;
  zIndex: number;
  visible: boolean;          // 裁剪结果
  kind: "sprite" | "marker" | "label" | "occluder";
  width: number;
  height: number;
  anchorX: number;           // 0–1，相对宽度
  anchorY: number;
  atlasUrl?: string;
  frame?: string;            // 图集帧名；缺省则用整张 url
  imageUrl?: string;
  tint?: number;             // 可选，0xRRGGBB
  alpha?: number;
  flipX?: boolean;
  label?: string;            // 已解析的文案；渲染器用位图文字或 Pixi.Text
  interactionPriority?: number;
}
```

`ActorLayer` 职责：

- 按 id 复用 `Sprite` / `Text`，不每帧 `new`
- 世界 root 已有 `scale = zoom`、`position` 跟随镜头（现 `PixiRenderer.sync`）。角色**只写世界坐标**，不再乘 zoom
- `visible === false` 的节点 `renderable = false` 且不上传新纹理
- `destroy` / 换包时清空层
- 标签是角色的子节点，不是 ui-layer。这样缩放与夜色分层才稳定

点击仍由 core 的输入 → 世界坐标 → `interaction.pickAll`，不依赖 Pixi 的 `eventMode`（与现热点一致，避免两套命中）。

## 4. 时间服务

v1 `RenderScheduler` 已夹紧 dt（`Math.min(..., 0.05)`）并支持 `requestContinuous(reason)`。v2 不替换它，在旁边加 `TimeService`。

```ts
export interface TimeState {
  /** 本帧模拟步长，暂停时为 0 */
  gameDt: number;
  /** 未暂停、未缩放的帧间隔，已夹紧 */
  wallDt: number;
  paused: boolean;
  /** 1 = 常速。只影响 gameDt */
  scale: number;
  /**
   * 0–1 的时段。引擎不自动走表。
   * 插件或 story 调用 setTimeOfDay。null 表示该包不使用。
   */
  timeOfDay: number | null;
}

export interface TimeService {
  getState(): TimeState;
  gameDt(wallDt: number): number;
  setPaused(paused: boolean): void;
  setScale(scale: number): void;
  setTimeOfDay(value: number | null): void;
}
```

钩子（事件名，无画意）：

| 事件 | 何时 |
|---|---|
| `time:pause` / `time:resume` | `setPaused` |
| `time:ofday` | `setTimeOfDay` 变化 |

atmosphere 插件可以听 `time:ofday` 改色调。没有监听者时，设值是空操作。core 不内置日出日落曲线。

暂停时：`world.update(0)` 仍刷新快照（镜头可能还在动），但不推进 path 距离、不推进刷新计时。

## 5. 空间查询、裁剪、命中优先级

### 5.1 索引

用真正的 AABB 索引。**选定：均匀网格，格宽 256 世界像素**（`packages/interaction` 的 `SpatialIndex`），不引入 rbush / flatbush。v1 的 `FlatbushIndex` 已替换；点击先查网格，再做精确形状测试。

查询 API：

```ts
export interface SpatialQuery {
  loadStatic(items: readonly AabbItem[]): void;   // 热点、zone、不动的标记
  loadDynamic(items: readonly AabbItem[]): void;  // 本帧在动的 actor
  queryPoint(x: number, y: number): AabbItem[];
  queryRect(r: Rect): AabbItem[];                  // 视口裁剪
}
```

点中之后仍做精确形状测试（v1 `pointInHotspot` 的矩形/圆/多边形保留）。

### 5.2 裁剪三态

对齐今天街市已经验证过的手感，但放到 world，单位是世界像素：

| 态 | 条件（默认） | 行为 |
|---|---|---|
| `active` | 与视口扩张 `margin`（默认 320 世界像素）相交 | 模拟 + 绘制 |
| `frozen` | 不出 `margin * 2`，但已出 active | 不模拟，绘制最后一帧 |
| `hidden` | 出 cull 矩形 | 不模拟，不绘制 |

`320` 来自 `street-life.ts` 的 `ACTIVE_MARGIN`，作为**默认**，pack 可用 `meta` 或 world 配置覆盖。不要在 core 写「茶市」。

动态 actor 每帧用视口矩形查索引，而不是对全表做 `inActiveZone`。全表上限见 §8；超出时 validator 警告。

### 5.3 命中优先级

沿用数字越大越先。来源：

1. actor / hotspot 的 `interactionPriority`
2. 否则 `zIndex`
3. 同优先级：后声明者胜（稳定排序，写进测试）

`HitResult.renderer` 保持 `"pixi" | "three" | "dom"`。世界角色命中报 `"pixi"`。DOM HUD 不参与这条拾取（按钮自己的 click）。

插件 `onHit` 返回 true 仍可吞掉事件（v1 行为保留）。

## 6. 触发器

声明在 scene 里，运行在 core。插件与 story 只 `emit` / `on`，不自己做「每帧点是否在矩形里」——除非是该画独有的多步任务。

```ts
export type TriggerWhen =
  | { type: "zone:enter"; zoneId: string; subject: "camera" | "actor"; actorId?: string }
  | { type: "zone:exit"; zoneId: string; subject: "camera" | "actor"; actorId?: string }
  | { type: "entity:click"; entityId: string }
  | { type: "chapter:enter"; chapterId: string }
  | { type: "custom"; event: string };

export interface TriggerDef {
  id: string;
  when: TriggerWhen;
  emit: string;          // 例如 "quest:start"，由 story 监听
  once?: boolean;
  payload?: unknown;
}
```

规则：

- `camera` 主体 = 视口中心点（与「读者走到这里」一致）。不要用整个视口矩形去触发，否则宽屏会提前触发；若某包需要矩形，用单独的 zone 而不是改默认。
- `chapter:enter`：guide 在 `flyTo` 结束时发出 `chapter:arrive { id }`，触发器把它映射出去。视口中心进入与章节绑定的 zone 也可以发，二选一由该 trigger 的 `when` 决定，不自动双发。
- `entity:click` 与现有 `entity:click` 事件并存：触发器是数据，事件是总线。避免 story 再写 `if (entityId === "dock-east")` 才能开船——那行可以变成 trigger `emit: "vessel:summon"`。
- 换包时 `once` 状态清空。
- core 不解释 `emit` 字符串的业务含义。`vessel` 插件注册自己认识的事件；不认识的留给 story。

## 7. 路径跟随（通用）

放在 `packages/animation`，无船、无人、无桥。

```ts
export interface PathPoint { x: number; y: number }

export interface PathDef {
  id: string;
  points: PathPoint[];     // ≥ 2
  closed?: boolean;
}

export type FollowMode = "once" | "loop" | "ping-pong";

export interface FollowerState {
  pathId: string;
  distance: number;        // 沿折线的弧长
  speed: number;           // 世界像素 / 秒
  mode: FollowMode;
  direction: 1 | -1;
  paused?: boolean;
}

export interface PathSample {
  x: number;
  y: number;
  direction: 1 | -1;
  finished: boolean;       // mode=once 且走到端点
}

export function polylineLength(points: readonly PathPoint[]): number;
export function pointAlong(points: readonly PathPoint[], distance: number): PathPoint;
export function stepFollower(path: PathDef, state: FollowerState, dt: number): PathSample;
```

`pointAlong` 的行为对齐 `contents/qingming-riverside/story/coords.ts` 已测的实现（超长距离夹在末端），迁移时把单测搬到 `packages/animation`，coords 改为从场景读路径或变薄封装。

可选、仍属通用：

```ts
export interface ScalarTrack {
  /** distance 单位与 path 弧长相同；按距离线性插值 */
  keys: { distance: number; value: number }[];
}
```

过桥时船体变小，用 `ScalarTrack` 驱动 `scale`，不要在动画包里写 `BRIDGE_CARGO_SCALE`。

世界角色若带 `pathId`，`WorldRuntime` 在 `active` 时调用 `stepFollower`。`hidden` 时不调用。`frozen` 时不调用。

船、行人、仪仗都是「带 pathId 的 actor」加不同的 mode / speed / spawn。

## 8. Scene schema v2

版本政策全文：[adr/0004-scene-schema-versioning.md](./adr/0004-scene-schema-versioning.md)。

### 8.1 形状

v1 文档原样通过。v2 是超集：`version: 2`，并增加数组（默认空）。

```ts
export const SceneSchemaV2 = SceneSchemaV1.extend({
  version: z.literal(2),
  paths: z.array(PathSchema).default([]),
  actors: z.array(ActorSchema).default([]),
  zones: z.array(ZoneSchema).default([]),
  spawns: z.array(SpawnSchema).default([]),
  dialogues: z.array(DialogueStubSchema).default([]),
  triggers: z.array(TriggerSchema).default([]),
});

// 加载器
export const SceneSchema = z.union([SceneSchemaV1, SceneSchemaV2]);
```

v1 的 `entities`（sprite / animation / hotspot / model3d）**保留**。热点与 model3d 继续走原路径。新的可玩物体写 `actors`，不要再把「会动的船」写成一个永远不被渲染的 sprite 实体。

迁移函数（纯函数，不做 DOM）：

```ts
export function toSceneV2(doc: SceneV1 | SceneV2): SceneV2 {
  if (doc.version === 2) return doc;
  return { ...doc, version: 2, paths: [], actors: [], zones: [], spawns: [], dialogues: [], triggers: [] };
}
```

这只为了让运行时只有一条 v2 代码路径。它**不会**把清明上河图的 `coords.ts` 变成 actors。那是内容迁移（[40](./40-migration-qingming.md)）。

### 8.2 草图

```ts
const ActorSchema = z.object({
  id: z.string(),
  kind: z.enum(["sprite", "marker", "label", "occluder"]),
  x: z.number(),
  y: z.number(),
  zIndex: z.number().default(0),
  width: z.number().positive(),
  height: z.number().positive(),
  anchorX: z.number().min(0).max(1).default(0.5),
  anchorY: z.number().min(0).max(1).default(1), // 人的脚点；船可改 0.5
  imageUrl: z.string().optional(),
  atlas: z.string().optional(),
  frame: z.string().optional(),
  frames: z.array(z.string()).optional(),       // 循环帧
  frameSeconds: z.number().positive().optional(),
  pathId: z.string().optional(),
  speed: z.number().nonnegative().optional(),
  follow: z.enum(["once", "loop", "ping-pong"]).optional(),
  distance: z.number().nonnegative().optional(),
  label: z.object({
    i18nKey: z.string().optional(),
    text: z.string().optional(),
    cycleKeys: z.array(z.string()).optional(),
    cycleSeconds: z.number().positive().optional(),
  }).optional(),
  interactionPriority: z.number().optional(),
  cull: z.boolean().default(true),
  scaleTrack: z.array(z.object({ distance: z.number(), value: z.number() })).optional(),
});

const ZoneSchema = z.object({
  id: z.string(),
  x: z.number(),
  y: z.number(),
  shape: z.union([RectShape, CircleShape, PolygonShape]),
  chapterId: z.string().optional(),
});

const SpawnSchema = z.object({
  id: z.string(),
  pathId: z.string(),
  count: z.number().int().positive().max(64),
  speedMin: z.number().positive(),
  speedMax: z.number().positive(),
  atlas: z.string(),
  frames: z.array(z.string()).min(1),
  follow: z.enum(["loop", "ping-pong"]).default("ping-pong"),
  seed: z.number().int(),
  width: z.number().positive(),
  height: z.number().positive(),
});

const DialogueStubSchema = z.object({
  id: z.string(),
  lineKeys: z.array(z.string()).min(1), // i18n 键，不是内嵌长文
});
```

`SpawnSchema.count` 上限 64 是**单条刷新**的校验上限，防止一个笔误生成一万个节点。全包上限见性能节。对话桩没有选项分支；分支是后续版本的事。v2 只保证「触发器能打开一组行」。

路径点与 actor 的 `x/y` 必须落在 `meta.width/height` 内，validator 交叉检查（热点越界规则的延伸）。

### 8.3 加载兼容

| 输入 | 行为 |
|---|---|
| version 1 | `toSceneV2` 后浏览；actors 为空；与今天 demo-scroll 相同 |
| version 2 缺新数组 | Zod default `[]` |
| version ≥ 3 | validator 失败，运行时拒绝，不猜测 |
| 未知 entity type | 继续失败（v1 测试已覆盖非法 type） |

## 9. 性能预算（6k–20k 宽）

唯一有测量意义的成图是 `qingming-riverside`：**6516×724**，瓦片 512，5 级 LOD（`contents/qingming-riverside/tiles/manifest.json`）。20_000 世界像素宽是南巡式长卷的**规划包络**，仓库里没有这种宽度的包，帧时间**待测**。

| 项 | 预算 | 依据 |
|---|---|---|
| 卷宽 | 设计支持 6_000–20_000 世界像素；更高不保证 | 清明上河图 6516 已在跑；上界未测 |
| 卷高 | 设计 512–2_048 | 现有包 724 与 1024 |
| 全包 actor 数（含 spawn 展开后） | validator **警告** > 400，**失败** > 800 | 设计容量，不是基准 |
| 同时 `active` | 目标 ≤ 80 | 待测 |
| 同时绘制 | 目标 ≤ 120 | 待测；超出先裁剪再谈合批 |
| 单 spawn `count` | ≤ 64 | schema |
| 拖动帧 p95 | ≤ 24ms（理想 ≤ 16ms） | 继承 v1 **目标**；v1 未留实测 |
| 角色纹理 | 走现有 `AssetSystem` 字节预算，不另开隐藏缓存 | v1 `CachePolicy` |
| 裁剪 | hidden 不 `update` 纹理、不步进 path | 正确性要求，不是加速口号 |

实现阶段若 80 个 active 精灵超过 24ms，先降同屏上限并写进实测记录，不要悄悄提高预算假装通过。

合批、图集尺寸、标签用位图字体还是 `Text`：实现时测。计划不指定未验证的 draw call 数。

## 10. 测试（实现时要有，本文不写测试代码）

| ID | 期望 |
|---|---|
| W-U-01 | `stepFollower` loop / ping-pong / once 与 dt=0 |
| W-U-02 | 视口外 actor 为 hidden，distance 不变 |
| W-U-03 | `toSceneV2` 不丢 v1 hotspot |
| W-U-04 | 暂停后 speed 不累积；恢复后走一步 |
| W-U-05 | zone enter 只在穿越时发一次；`once` 后不再发 |
| W-U-06 | 重叠命中按 interactionPriority |
| W-I-01 | Pixi actor 的世界坐标与 `worldToScreen` 一致（误差 ≤ 1px @ zoom=1） |
| W-I-02 | `setActors([])` 后舞台无残留子节点 |
| W-D-01 | `packages/core` 与 `packages/world` 无 pixi/three import |
| W-P-01 | 数百 actor 的裁剪帧时间，**记录实测，不预设通过** |
