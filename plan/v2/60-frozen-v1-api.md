# 冻结的 v1 表面（Phase 0）

> **实施状态：** Phase 0 已完成 · Phase 1 已在旁边加能力 · 下列语义仍冻结

Phase 1 在这些 API **旁边**加了世界模拟与 `setActors`。改变下列签名或语义之前，先在本文件加一条「变更说明」，并在 PR 里点名。

## 0. 变更说明

- 2026-09-22 Phase 1：新增 `RendererAdapter.setActors`、`TimeService`、`TriggerRuntime`、`EngineServices.world`、`InteractionSystem.sync`。未改 `loadContent` 的卸载/装载顺序、`HitResult` 字段、`weather:set`、`camera.flyTo` 的毫秒时长与夹取、`requestContinuous` 的 reason 集合语义。镜头 `update` 仍用调度器墙钟，因此暂停时飞镜与惯性仍会结束。`guide` 在飞镜结束且镜头落到章节目标附近时额外发出 `chapter:arrive`。

ADR [0003](./adr/0003-world-actors-pixi.md)、[0004](./adr/0004-scene-schema-versioning.md)、[0005](./adr/0005-occlusion-and-water-composite.md) 保持 **accepted**。本文件只把它们落到「现在不能悄悄改什么」。

## 1. 迁移安全 API

对照代码核对过（2026-09-22）。「相关表面」同样冻结，避免只守住名字、改掉调用方依赖的行为。

| API | 现在的语义 | 代码 |
|---|---|---|
| `loadContent(scrollId: string)` | 先 `unloadCurrent`（story cleanup → 插件 `onSceneUnload` → 清瓦片/动画/命中/资源 → `scene:unload`），再 `loadMeta` → 按 `meta.plugins` 装插件 → `loadManifest` + 瓦片 → `loadScene` → 用 `scene.meta` 设镜头，有 `defaultViewport` 则用它 → 仅当实体含 `model3d` 才 `ensureLoaded` Three → 可选 `loadStory` / `registerStory` → `broadcastSceneLoad` → `content:load`。参数仍是 **scroll id 字符串**。 | `packages/core/src/Engine.ts` |
| `HitResult` | 字段保持 `entityId`、`renderer`（`"pixi" \| "three" \| "dom"`）、`interactionPriority`、`worldX`、`worldY`。点击最高优先级命中：插件 `onHit` 返回 true 则吞掉，否则 `emit("entity:click", hit)`。没有命中则 `emit("world:click", { worldX, worldY })`，不伪造 `HitResult`。 | `packages/core/src/contracts/hit.ts`、`Engine.handleClick` |
| `weather:set` | 载荷是 `WeatherId` 或 `{ id: WeatherId }`，`WeatherId = "clear" \| "rain" \| "snow" \| "mist"`。其它载荷忽略。成功后插件发 `weather:change`。非 `clear` 时 `requestContinuous("weather")`，`clear` 时 `releaseContinuous("weather")`。雨雪雾仍是 ui-layer 的屏幕空间效果。 | `packages/plugins/src/weather/WeatherPlugin.ts` |
| `camera.flyTo` | 参数 `{ centerX, centerY, zoom, duration }`。`duration` 单位是**毫秒**（`elapsed` 用 `dt * 1000` 累加）。`0` 立即落到目标并做场景夹取。`zoom` 夹在控制器的 min/max。调用会清掉平移速度。指针按下走 `interruptTransition()`，取消未完成的飞镜。 | `packages/core/src/viewport/ViewportController.ts`；公开面是 `ScrollEnginePublic.camera` |
| `requestContinuous(reason)` | 按 **reason 字符串**记入集合；集合非空则调度器为 `continuous`，空则回到 `on-demand`。配对 API 是 `releaseContinuous(reason)`。帧 `dt` 仍夹在 `0..0.05` 秒。引擎自己使用的 reason 包括 `"camera"`、`"pointer"`、`"inertia"`；天气 `"weather"`、水面 `"water"`。不要改成按调用次数计数。 | `packages/core/src/scheduler/RenderScheduler.ts` |

相关、同样不要在 Phase 1 改语义而不写说明：

- `ScrollEngine.create` / `destroy` / `on` / `getViewport` / `setQuality` / `getQuality` / `ensureThree`
- `ensureThree()`：`renderers.three` 为 false 或没有适配器时解析为 `null`（ADR 0005：契约不变）
- 热点 `action.type`：`"openPanel" | "emit" | "flyTo" | "none"`
- `entity:click` 与 `world:click` 的分工（见上表）
- `releaseContinuous`、`interruptTransition`、`weather:change`
- guide 章节点调用 `camera.flyTo` 时 `duration` 为 `800`（毫秒），并 `requestContinuous("camera")`

`HitResult.renderer` 以后可以让世界角色报 `"pixi"`（ADR 0003）。那是**新的命中来源**，不是改字段含义。DOM HUD 按钮不走这条拾取。

## 2. Scene 版本门（ADR 0004，Phase 0 已落地的部分）

加载器与 `SceneSchema.parse` / `safeParse`（`packages/scene/src/schema.ts`）：

| 输入 | 行为 |
|---|---|
| `version: 1` | 按已发布形状通过：`meta`、`background`、`entities`（sprite / animation / hotspot / model3d）、`chapters`。不注入世界数组。文档上的 `paths` 等未知键被 **剥掉**（Zod 默认 strip，不拒绝、不保留）。 |
| `version: 2` | 同一套实体形状，外加六个数组：`paths`、`actors`、`zones`、`spawns`、`dialogues`、`triggers`。缺省 `[]`。元素按 Phase 1 的 Zod schema 校验（不再是 `unknown`）。其它未知键剥掉。`toSceneV2` 把 version 1 补成空数组后的 version 2，供世界模拟使用；加载结果本身仍保留 version 1。 |
| `version` 不是 `1` 或 `2`（含 ≥3、缺省、字符串、小数） | 拒绝。错误文本包含实际版本，以及 `accepted versions are 1 and 2`。不降级猜测。 |
| 未知 entity `type` | 版本 1 与 2 都失败（与原 `schema.test.ts` 一致）。 |

`SceneDocument.version` 的类型是 `1 | 2`。`loadScene` 不改写磁盘上的 version 1。世界系统调用 `toSceneV2` 后只走 version 2。

现有浏览包 `demo-scroll`、`qingming-riverside` 保持 `version: 1`。脚手架与 `_template` 从 Phase 1 起写出 version 2 空数组。夹具包 `path-walker` 是 version 2。

## 3. 新包约束（ADR 0003、0005）

- **新包不得增加 DOM 世界角色**（人、船、车、世界标签、世界标记、前景遮挡条）。禁止为世界物体每帧写 `style.left` / `style.top`。`.ui-layer` 只放 HUD。`contents/qingming-riverside/story/` 里的 DOM（含 `street-life.ts`）是遗留，**不要复制到新包**，本阶段也不删。
- **夜色与水面合成按 ADR 0005。** 夜色最终只乘瓦片层；有船体要压在水上的包用 `water.composite = "pixi-underlay"`，无船包可以继续 `three-overlay`。Phase 0 不实现这两种绘制。不要把船搬回 DOM 当作合成方案。
- `packages/core` 不 import `pixi.js` / `three`，core 内不出现画名或内容包实体 id。`yarn test:dep` 继续守这条。
