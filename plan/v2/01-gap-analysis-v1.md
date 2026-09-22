# v1 计划 vs 已交付 — 差距分析

> 对照日期：2026-09-22。只记录仓库里能打开的文件。假设若与代码不符，以代码为准。  
> v1 计划本身标为 **v1 baseline（shipped 2026-09）**。

## 1. 结论（先看这个）

v1 **浏览引擎**大体按计划落地：视口、输入、瓦片、Zod 场景、插件宿主、Pixi + lazy Three、一个真实内容包。  
v1 **游戏引擎**没有落地：角色不在 Pixi 世界里，场景 schema 没有路径/区域/触发器，动画包不驱动任何人，第二幅「弱剧情」包不存在。清明上河图的街市、渡船、过桥是 `contents/qingming-riverside/story` 里的 DOM 状态机。

这解释了「能逛、能点、有小人，但玩法不像画卷引擎的一部分」：小人、船、夜色、图钉都画在 `.ui-layer` 上，和瓦片不是同一个场景图。

## 2. 总表

| 计划（v1 文档） | 仓库现状 | 痛 | v2 回应 |
|---|---|---|---|
| 三层分离；剧情不进 core（`plan/01` §2，`plan/10` §1） | **已做到。** `packages/core` 无画名。玩法在 `contents/qingming-riverside/story/`。插件注册表只有 quality/guide/audio/weather/water（`packages/plugins/src/registry.ts`） | 分离本身没问题。痛的是「本该复用的移动与人群」被放进了唯一的 story | 保留分层。把路径跟随、人群、船只升到无画名的插件/world。story 只留独特任务 |
| Pixi 画瓦片、精灵、动画；Three 按需（`plan/10` §5.4，ADR 0001） | **瓦片已画。** `packages/renderer-pixi/src/PixiRenderer.ts` 只有 `TileLayer`。`scene.json` 里的 `ferry-boat` sprite **没有**对应的 Pixi 精灵。船在 `story/events/ferry.ts` 用 `<img class="qingming-boat">` | 世界物体与镜头同步靠手写 `worldToScreen` + `style.left/top`，缩放时和 CSS 尺寸互相迁就 | Pixi `ActorLayer`；禁止 DOM 世界角色。见 ADR 0003 |
| 实体类型 sprite / animation / hotspot / model3d（`plan/10` §5.5，`packages/scene/src/schema.ts` `version: 1`） | Schema **只有这四种**。热点点击可用（`packages/interaction/src/pick.ts` 只处理 `type === "hotspot"`）。animation 实体无帧、无路径字段（仅可选 `atlas` 字符串） | 作者无法声明「谁沿哪条路走」。每个玩法自造坐标模块 | scene **version 2** 增加 actors / paths / zones / spawns / dialogues / triggers。v1 文档仍可加载 |
| `packages/animation`：序列帧、路径、参数动画（`plan/10` §2） | `AnimationRuntime` **只累加 `time`**（`packages/animation/src/AnimationRuntime.ts`）。viewer/playground 注入它，没有任何 follower | 计划中的「通用路径」被 story 复制了三份：`ferry.ts`、`bridge.ts`、`street-life.ts` + `coords.ts` 的 `pointAlong` | 路径数学放进 `animation`；世界模拟调用它。删除「每幅画一份插值器」的必要性 |
| 空间索引 Flatbush / RBush（`plan/01` §4，`plan/10`） | 类名 `FlatbushIndex`（`packages/interaction/src/InteractionManager.ts`）是**数组过滤**。`pickAll` 不走这个类的 `query()`，点击是对全部热点线性扫描。多边形在 `pick.ts` 里有真正的点在多边形内测试 | 热点数量少时无感。数百 actor 的命中与裁剪不能靠全表扫描，也不该继续叫 Flatbush | 视口查询 + 命中共用 AABB 索引（实现可选 rbush/flatbush）。名字与行为一致 |
| 插件：水、天气、音效、导览、质量（`plan/20`） | **五者都在 registry。** weather 是全屏 CSS（`WeatherPlugin.ts`，z-index 7）。water 为 lazy Three + DOM fallback（ADR 0002）。audio 是静音总线 + 程序噪声，**无区域**。guide 是章节按钮，飞镜头，不发出「进入章节」 | 通用插件是氛围与壳，不是玩法系统。夜色不在 weather 里，而在 story | atmosphere 收纳夜色与天气 API；guide 在飞完后发 `chapter:arrive`；audio 听 zone 触发 |
| story 可选；无 story 仍可浏览（`plan/30` §4） | **成立。** `demo-scroll` 无 `story/`。`_template/story/index.ts` 是空函数。引擎 `loadStory` 可选 | 空 story 只能看图。一有「人在走路」就必须写一整套 DOM | 无 story 时，scene v2 的 actor+path 仍会动（插件按 meta 启用） |
| 两个验收包：`demo-scroll` + `guide-only-scroll`（`plan/30` §6） | **只有** `demo-scroll`（合成几何，4096×1024，热点+章节）和 `qingming-riverside`（6516×724，完整 story）。**没有** `guide-only-scroll`，也没有姑苏/南都/山水目录 | 「换一幅画不用改引擎」只在浏览层被 `content:new` 证明，没有第二套玩法剖面 | Phase 3 做合成山水导览包，类型与街市相反 |
| 作者工具：tile-builder、scene-scaffold、scene-validator、atlas-builder（`plan/01` §5） | **前三个在** `tools/` 与根脚本。**没有** `tools/atlas-builder`。`contents/qingming-riverside/atlas/` 只有 `README.md` 与手工 `boat.webp` 的说明；行人不是图集 | 人物无法走「图集 → 精灵」流水线 | v2 把 atlas-builder 列为内容工具，actor 引用帧 |
| 活跃区、遮挡分层、路径（`plan/01` Phase 3；`plan/40` Phase F） | 活跃区**只存在于** `street-life.ts`（`ACTIVE_MARGIN = 320`，近处动、远处 `hidden`）。遮挡是 `bridge.ts` 的 DOM 条 `.qingming-bridge-occluder`。路径常量在 `coords.ts` | 这些是清明上河图私有实现，下一幅画抄不到 | 裁剪与 path 进 world；遮挡用 Pixi 前景精灵/蒙版，不用 DOM 假桥洞 |
| 切换 scroll 无泄漏（`plan/01` §6，`plan/10` destroy 清单） | `ScrollEngine.unloadCurrent` 会调用 story cleanup、插件 `onSceneUnload`、清瓦片。街市 `dispose` 会 `remove()` 行人 DOM。图钉另有一条 **独立 rAF**（`story/index.ts` `tickPins`） | 清理靠每个 story 记得拆 DOM。漏一个 class 就残留。没有堆测量 | 世界节点由渲染器 `setActors` 整表替换；HUD 插件统一卸。泄漏次数目标 0，**待测** |
| 性能：拖动 p95 ≤ 24ms（`plan/10` §8） | 代码里有预算字段（缓存、DPR、每帧上传），**仓库没有** `phase1-metrics.md` 或 bench 结果 | 不能声称 v1 已达标 | v2 沿用同一预算，角色层接入后重测，结果标待测 |
| 清明上河图：人物用 sprite，船用 story 插值（`plan/40` Phase C） | Phase F 改成了 **CSS 剪影**（`street-life.ts` 注释写明不用 people-ink 图集）。渡船与过桥都是 DOM。`scene.json` 的 `ferry-boat` sprite 只被 `pack.test.ts` 断言「字段存在」，渲染器不读 `url` | 和「画里的人」脱节；z-index 与夜色叠加打架 | 见 [40-migration-qingming.md](./40-migration-qingming.md) |
| core 不硬编码剧情 | `rg`：`packages/` 下无 `qingming` / `虹桥`（`schema.test.ts` 有一条非法 type `"ferry"` 的**负例**，不是玩法） | 这条守住了，v2 继续当门禁 | 保留 `test:dep` 与插件检索 |

## 3. 玩法泄漏：DOM 街市（假设 1，已确认）

`contents/qingming-riverside/story/index.ts` 把整份 CSS 注入 `document.head`（`STYLE_ID = qingming-riverside-story-css`），并在 `getUiLayer()` 上挂：

| DOM | 类名 | 层级 | 行为 |
|---|---|---|---|
| 渡船 | `.qingming-boat` | z-index 3 | `ferry.ts` 每帧改 left/top/width/height |
| 热点图钉 | `.qingming-pin` | 4 | **自己的 rAF**，不走 scheduler |
| 过桥货船、桅、绳 | `.qingming-cargo` 等 | 4–5 | `bridge.ts` |
| 桥洞遮挡 | `.qingming-bridge-occluder` | 3，在 bridge root 内 | 渐变 + `clip-path`，注释写明假遮挡 |
| 夜色 | `.qingming-night` | **6**，`inset: 0`，`mix-blend-mode: multiply` | 盖住画布，盖不住更高的 DOM |
| 行人 / 店铺标签 | `.qingming-walker` / `.qingming-shop` | **7**（`STREET_LIFE_Z_INDEX`） | 8 个剪影 + 3 个循环标签 |
| 天气插件雨幕 | `.hs-weather` | **7**（插件 CSS，不在 story 文件） | 与行人同一 z-index，谁在上取决于插入顺序 |
| 面板、过船按钮、氛围按钮 | `.qingming-panel` 等 | 8–9 | 这些是 HUD，v2 **留在 DOM** |

夜色必须低于行人，否则剪影被乘色盖暗；行人必须高于夜色，否则「看不见人」。这就是尺寸、z-index、夜色互相迁就的来源。天气雨幕与行人同级，没有稳定的叠放合同。

行人数据写死在 `WALKER_SEEDS` 与 `STREET_PATHS`（`coords.ts`），不是 `scene.json`。

`street-life.ts` 另起 `requestAnimationFrame`，同时再 `scheduler.requestContinuous("qingming:street")`。模拟时钟与引擎帧不是同一个。

## 4. 场景太瘦（假设 2，已确认）

`SceneSchema`（`packages/scene/src/schema.ts`）字段：`version: 1`、`meta`、`background.manifestUrl`、`entities[]`、`chapters[]`。

没有：actor、path、zone、spawn、dialogue、quest、trigger、timeline。

清明上河图因此发明了：

- `story/coords.ts`：泊位、桥路径、街道路径、店铺点、`REF_SHIFT_X = 2172`
- `story/events/*.ts`：四个状态机
- `i18n/zh-CN.json`：文案（这一项是对的，v2 保留）

`demo-scroll/scene.json` 只有一个 hotspot 和三个 chapter，能验证浏览，不能验证玩法数据。

## 5. 动画包没有驱动角色（假设 3，已确认）

计划写「人物图集后期进 animation/sprite」（`plan/40` §2.1）。图集 README 写明：行人保持 CSS，`people-ink.webp` **没有**拷进 `atlas/`。

渲染器不读取 `SpriteEntity.url`。所以 schema 里的船精灵与运行时的 DOM 船是两套事实。`pack.test.ts` 只锁住 JSON 形状。

LOD：瓦片有（`tiles` 的 levels，清明上河图 manifest 为 0.0625–1，tile 512）。**角色没有 LOD**，因为角色不是纹理。

## 6. 浏览引擎 vs 游戏引擎（假设 4，已确认）

已有、应保留的浏览能力：

- 绕点缩放、拖动、flyTo（`ViewportController`）
- 瓦片可视集（Pixi `TileLayer`）
- 热点优先级排序（`interactionPriority`）
- 章节轨（`GuidePlugin`）
- 质量档改 DPR 与缓存（`QualityPlugin`）

缺少的游戏能力（代码中不存在，不是风格问题）：

- 世界实体图与镜头同一变换（今天镜头只 `sync` 到 Pixi world root，DOM 角色各自换算）
- 密度：8 个行人是常量，没有 spawn
- 遮挡：DOM 条，且 z-index 低于船的一部分，靠 opacity 假装桥洞
- 循环摊位：改 `textContent`，不是动画帧
- 渡船/过桥：各自 `easeInOutCosine` + 秒数常量，不能给下一幅画的船队复用

## 7. 多画卷未证明（假设 5，已确认）

| Pack | 实际 |
|---|---|
| `contents/qingming-riverside` | 唯一有 tiles + story + 玩法的包 |
| `contents/demo-scroll` | 合成图，无 story 目录 |
| `contents/_template` | 空 scene、`plugins: ["quality"]`、story 空函数 |
| `guide-only-scroll` 及计划中的名画目录 | **不存在** |

画廊会扫描 `contents/*/meta.json`（viewer，跳过 `_template`）。多卡只说明「多一个 meta 就能多一张卡」，不说明街市系统能关掉、山水系统能打开。

## 8. 作者成本（假设 6，已确认）

新包最短路径（根 README，已实现）：`content:new` → 放 `raw/background.png` → `content:tiles` → `content:scaffold-scene` → `content:validate`。这条路径**不能**摆人、摆船、摆触发器。

要做出与茶市同级的反馈，作者必须：

1. 写 TS 状态机  
2. 写 CSS  
3. 自己做世界到屏幕的变换（`coords.worldToScreen` 与引擎公式重复）  
4. 自己管 rAF、`requestContinuous`、dispose  

v2 的目标是把 2–4 从作者清单删掉。1 只留给该画独有的任务。

## 9. 插件与 story 的边界（假设 7，已确认）

| 能力 | 今天落点 | 判断 |
|---|---|---|
| 质量、章节按钮 | 插件 | 保留 |
| 雨/雪/雾 CSS | `weather` 插件，API `weather:set` | 保留 API，夜色并入 atmosphere |
| 夜色乘色、氛围 HUD 按钮 | `story/events/weather-night.ts` | 夜色进插件；按钮可以留在包的 HUD |
| 水面 | `water` 插件，带区由 `pluginConfig.water.bands` 配置（清明上河图 y=520,h=204） | 保留插件；与船体的上下关系要改，见 ADR 0005 |
| 音效 | `audio` 插件，story 发 `audio:play` | 增加 zone → play，插件内仍不写坐标 |
| 渡船、过桥、行人、店铺 | 仅清明上河图 story | 移动与刷新进 vessel/crowd；过桥**任务步骤**留在包内 |

口诀（v1 `plan/20` 已写，v2 继续执行）：换一幅画仍可能复用 → 插件；只有这一幅的文案与任务步骤 → story。

## 10. v1 里不要在 v2 推倒的部分

- 世界坐标：左上原点，X 右 Y 下，单位 = 逻辑像素；DPR 不进业务坐标。
- `loadContent` 顺序：卸 story → 卸场景 → 装插件 → 装瓦片与场景 → `registerStory`。
- 热点 `openPanel` / `emit` / `flyTo` 动作枚举。
- 默认静音、手势解锁音频。
- 双 Canvas，输入绑在容器上，Three `pointer-events: none`。
- 每包 `license.assets` 必填。
- 清明上河图坐标平移 `+2172` 是**该包烘焙底图**的事实，留在包的作者注记，不进 core。
