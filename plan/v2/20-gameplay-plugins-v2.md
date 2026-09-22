# v2 玩法插件

> **实施状态：** 待 Phase 2 · Phase 0 已完成

> 口诀不变：换一幅画还能用 → 插件；只有这一幅的文案和任务步骤 → `contents/<id>/story`。  
> 插件 id、事件名、配置字段里不出现画名。

## 1. 保留 / 改 / 弃

| 保留 | 改 | 弃 |
|---|---|---|
| `ScrollPlugin` 生命周期与 `onHit` 吞事件 | 新增三个内置 id：`crowd`、`vessel`、`atmosphere` | story 内再实现一套行人 DOM |
| `quality`、`guide`、`audio` 总线、`water` | `weather` 的雨雪雾留在 atmosphere 门面之后，或 atmosphere 内部调用现有 `weather:set` | 夜色只存在于某一个 pack 的 CSS |
| `meta.plugins` + `pluginConfig` | guide 飞完章节后发 `chapter:arrive` | 插件源码写码头坐标 |
| 未知插件 id 的告警行为（保持 v1：warn 并跳过，见 `PluginHost` 的 `"warn"`） | audio 增加「听到事件就播放」，事件由 zone 触发器发出 | 用 DOM 船压过 Three 水面（ADR 0005） |

注册表目标（`packages/plugins/src/registry.ts`）：

```text
quality | guide | audio | weather | water | atmosphere | crowd | vessel
```

`weather` 可以在 atmosphere 落地后变成薄转发，避免两套 `setWeather`。在转发完成前不要删 `weather`，现有 `weather:set` 调用方（`weather-night.ts`）还在。

## 2. 谁写逻辑

```text
scene v2                         数据：path、actor、spawn、zone、trigger、dialogue 桩
crowd / vessel / atmosphere      系统：按数据模拟，调用 WorldRuntime / 事件
story/index.ts                   接线：监听本画的任务 id，打开面板，推进独有状态机
```

无 story 的包只要 `meta.plugins` 包含 `crowd`，且 scene 里有 spawn，行人就会动。这是相对 v1 的分界：v1 没有 story 就没有人。

story 允许做的事：

- `engine.on("quest:bridge", ...)` 这类**本画**事件
- 调用 `camera.flyTo`
- 在 ui-layer 放面板和按钮
- `emit` 一个插件已经文档化的命令（`vessel:summon`、`weather:set`、`audio:play`）

story 禁止做的事（v2 门禁，实现时加检索或 review）：

- 创建每帧跟随世界坐标的 DOM
- 复制 `polylineLength` / `pointAlong`
- import 另一个 `contents/<id>`

## 3. `crowd` — 路径人群与摊位循环

对应今天的 `street-life.ts`，但读场景，不读 `WALKER_SEEDS`。

### 3.1 输入

- `spawns[]`：沿 `pathId` 放 `count` 个精灵，速度在 `[speedMin, speedMax]`，`seed` 决定初始 `distance`（可复现，便于测试）
- `actors[]` 里 `kind: "label"` 且带 `label.cycleKeys`：摊位文案循环
- 图集帧 `frames` + `frameSeconds`：由 `AnimationRuntime.getTime()` 取模，**不**在插件里另起 rAF

### 3.2 行为

- 只步进裁剪态为 `active` 的实例（world 已做；插件不要再扫全图）
- `follow: "ping-pong"` 为街市默认；山水包不启用本插件
- 标签循环秒数来自数据（清明上河图今天是 `SHOP_LOOP_SECONDS = 2.8`，迁到该 actor 的字段，不写进插件默认作为唯一合法值）
- 实例 id：`${spawn.id}:${index}`，卸载时 world 按 owner 前缀删除

### 3.3 插件不做

- 不生成剪影 CSS
- 不写死三条路（茶市/虹桥/城门）
- 不负责点击店铺后的解说（那是 hotspot + 面板）

### 3.4 配置

```json
{
  "plugins": ["crowd"],
  "pluginConfig": {
    "crowd": { "enabled": true }
  }
}
```

人数与路径**不**放进 `pluginConfig`，否则每幅画的坐标会进插件调用方之外的「配置惯例」并被复制粘贴。坐标只在 scene。

## 4. `vessel` — 沿路径的载具

渡船、货船、画舫、车队都是 vessel。插件名不用 ferry。

### 4.1 数据

一个 actor：`kind: "sprite"`，`pathId`，`speed`，`follow`，可选 `scaleTrack`。

### 4.2 命令

```ts
/** story 或 trigger 发出。插件监听，不在 core 里 switch 画名。 */
interface VesselSummon {
  actorId: string;
  /** 缺省用 actor 自己的 pathId */
  pathId?: string;
  fromDistance?: number;
  toDistance?: number;
  speed?: number;
}
// 事件名： "vessel:summon"
// 到达：   "vessel:arrived" { actorId, pathId }
```

`follow: "once"` 的召唤：从 `fromDistance` 走到 `toDistance` 后 `finished`，发 `vessel:arrived`，停住。  
`follow: "loop"` 的巡航：不需要 summon，加载后即走（仪仗、游船）。

### 4.3 与独有任务的边界

清明上河图「降桅 / 按住牵绳 / Esc 取消」**不是** vessel 的状态机。vessel 只保证：

- 船体在路径上
- 可用 `scaleTrack` 变小（过桥远近）
- 可被 story **暂停跟随**（`vessel:pause { actorId }` / `vessel:resume`），以便任务阶段把速度暂时改为 0

桅杆角度、牵绳按钮、文案、镜头在 `contents/qingming-riverside/story/events/bridge.ts` 的后继模块里，改成驱动 pause/resume 与 HUD，不再自己改 DOM 船的 `style.left`。

## 5. `atmosphere` — 天气、夜色、时段

### 5.1 收纳

| 现实现 | v2 |
|---|---|
| `weather:set` → CSS 雨/雪/雾（`packages/plugins/src/weather/WeatherPlugin.ts`） | 保留为屏幕空间 HUD 效果，z-index **低于**面板与章节按钮，**不与世界角色抢层**（角色已不在 DOM） |
| `.qingming-night` 全屏 multiply，z-index 6 | **删除这种做法。** 夜色改为 Pixi 颜色矩阵，默认只作用在**瓦片层**，角色保持可读。可选 `gradeActors: true` 连角色一起压暗 |
| story 里的时雨/夜景/水面/音效四个按钮 | 按钮可以留在该包 HUD（屏幕坐标）。它们 `emit` 插件事件，不自己插入夜色 div |
| `time:ofday` | atmosphere 若配置了梯度，把 0–1 映射到同一套颜色矩阵。没有配置则忽略 |

### 5.2 API（稳定名）

```ts
events.emit("weather:set", { id: "clear" | "rain" | "snow" | "mist" });
events.emit("atmosphere:night", { enabled: boolean });
events.emit("atmosphere:grade", { darkness: number }); // 0–1，可选
```

`darkness` 的默认观感以清明上河图现乘色为起点调（约 `rgba(8,12,32,0.5)` 那一档），**调完再记实测**，计划不写死矩阵系数。

水面仍是 `water` 插件，不并进 atmosphere 的 DOM。合成顺序见 [adr/0005](./adr/0005-occlusion-and-water-composite.md)。

卸载：`onSceneUnload` 去掉 CSS 节点、复位颜色矩阵、`releaseContinuous("weather")` 与 `"atmosphere"`。换包后查询 `.hs-weather` 与夜色矩阵应为关闭。

## 6. `guide` — 章节轨

保留 DOM 轨（它是 HUD）。

增补：

- `flyTo` 的 `duration` 结束（或被打断）时：`emit("chapter:arrive", { id, completed: boolean })`
- 不在插件里翻译标题；继续用 `chapter.title` / `titleKey`（i18n 解析放在 viewer 或插件的可选 `resolveText` 回调，回调由 app 注入，插件不 import 某个包的 json）

v1 guide 直接把 `chapter.title` 当按钮文字（`GuidePlugin.ts`）。v2 允许 app 传入解析函数；缺省仍显示 `title ?? id`，避免阻塞。

## 7. `audio` — 区域

v1：`audio:play { id, kind: "rain" | "water" | "none" }`，默认静音，首次指针解锁，页面隐藏时停。

v2 增补，不删除上述行为：

```ts
events.emit("audio:play", { id: string; kind?: AmbientKind; url?: string });
events.emit("audio:stop", { id: string });
```

区域：scene 的 trigger `zone:enter` → `emit: "audio:play"`，payload 带 `id`。audio 插件**不读 zone 几何**。离开区域用 `zone:exit` → `audio:stop`。

禁止：插件包内捆绑某一幅画的 mp3 路径。未授权的录音不要进仓库。程序噪声可以继续作为 rain/water 的 kind。

不做：距离衰减、左右声像。需要时在以后的版本加，并先测。

## 8. `water`（不新写玩法，只改合成）

保持 ADR 0002 的 lazy Three 作为**一种**模式。增加 `pluginConfig.water.composite`：

| 值 | 何时 |
|---|---|
| `"three-overlay"` | 默认。水面盖住整个 Pixi 画面中的河带。适用于没有船体要压在水上的包 |
| `"pixi-underlay"` | 河带画在瓦片之上、角色之下。载具是 Pixi actor 时用这个，否则船会被第二块 canvas 盖住 |

清明上河图有河又有船，迁移后用 `pixi-underlay`。没有船的包可以继续 Three。细节与桥洞遮挡同见 ADR 0005。

## 9. 启用矩阵（类型 → 插件）

| 插件 | 街市风俗 | 南巡纪行 | 山水长卷 | 叙事人物 | 劳动生产 |
|---|---|---|---|---|---|
| quality | 是 | 是 | 是 | 是 | 是 |
| guide | 是 | 是 | 是 | 是 | 可选 |
| crowd | 是 | 仪仗可改用 vessel/spawn | 否 | 否 | 少量 spawn 即可 |
| vessel | 渡船 | 船队 | 可选一艘 | 否 | 可选 |
| atmosphere | 雨/夜 | 可选 | 雾 | 夜宴时段 | 可选 |
| audio | 区域 + 环境 | 可选 | 可选 | 可选 | 可选 |
| water | 有河则是 | 有河则是 | 通常否 | 否 | 视画面 |
| story | 独有任务 | 站与站的门禁 | 通常空 | 对话桩接线 | 工序说明 |

空 story + 上表，是「多画卷」的定义。若一幅山水还要复制 `street-life.ts`，就是插件边界画错了。

## 10. 测试方向

| ID | 期望 |
|---|---|
| G-U-01 | spawn seed 固定时，初始 distance 稳定 |
| G-U-02 | 视口外 spawn 成员不增加 distance |
| G-U-03 | `vessel:summon` once 结束后恰好一次 `vessel:arrived` |
| G-U-04 | `atmosphere:night` 不创建覆盖全屏且 z-index 介于角色与 HUD 之间的世界 DOM |
| G-U-05 | 插件源码检索无 `qingming`、`虹桥`、`teahouse` |
| G-I-01 | meta 不含 crowd 时，scene 里即使有 spawn 也不生成实例 |
| G-I-02 | 卸场景后 actor 快照为空，天气节点移除 |
