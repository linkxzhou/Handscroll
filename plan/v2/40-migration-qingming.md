# 迁移：清明上河图式街市包是第一个消费者

> **实施状态：** 待 Phase 2 · Phase 1 已完成

> 包 id 不变：`qingming-riverside`。  
> 它不定义 v2 API。API 以无画名的 world / plugins 为准；本包只填数据并留下独有任务。  
> 素材仍然是上游原创生成插画的再创作，**不是**张择端《清明上河图》扫描。见 `contents/qingming-riverside/meta.json` 的 `license.assets`。

## 1. 保留 / 改 / 弃

| 保留在本包 | 改到引擎/插件 | 弃 |
|---|---|---|
| 6516×724 拼接底图、瓦片、四章节坐标 | 行人与店铺标签 → `crowd` + scene actors/spawns | `.qingming-walker` / `.qingming-shop` DOM |
| 热点文案、`i18n/zh-CN.json` | 渡船位移 → `vessel` + path | `.qingming-boat` 每帧改 style |
| 过桥**任务**（靠近、降桅、牵绳、过洞、完成、Esc） | 货船位移与缩放 → `vessel` + `scaleTrack` | `.qingming-cargo` 作为世界物体 |
| 码头 id（`dock-west` / `dock-east`）作为**本包** trigger | 夜色 → `atmosphere:night` 作用在瓦片层 | `.qingming-night` 全屏 DOM |
| `+2172` 烘焙说明，留在 README，直到坐标全部进 scene 后删除运行时副本 | 雨 → 已有 `weather:set`（保持） | story 私有 rAF（行人、图钉） |
| 面板、过船按钮、氛围开关（HUD） | 桥洞遮挡 → Pixi `occluder` 精灵或前景条 | `.qingming-bridge-occluder` DOM 渐变 |
| 水面 band `{x:0,y:520,w:6516,h:204}` | `water.composite = "pixi-underlay"`，否则 Pixi 船会在 Three 画布下面 | 「船用 DOM 压水」 |
| `registerStory` 的 dispose 纪律 | 跟着世界跑的图钉 → 可点的 marker actor，或只保留热点命中 | DOM pin + 独立 rAF |

`scene.json` 里现有的 `ferry-boat` sprite（url `./atlas/boat.webp`）渲染器不画。迁移后改成 actor，或删除该 entity，避免两套船。不要继续用测试只断言「JSON 里有一个没人画的 sprite」。

## 2. 数据从哪来

今天的常量在 `contents/qingming-riverside/story/coords.ts`。

| 常量 | 迁到 |
|---|---|
| `STREET_PATHS.teahouse/bridge/gate` | `scene.paths` 三条。id 由本包自定。core 不认识这些 id |
| `WALKER_SEEDS`（8 人，速度约 18–32） | 三条 `spawns`，`count` 与 seed 复现当前分布。人数可以仍是 8：先求「在 Pixi 里」，再谈变密 |
| `SHOPS` + 循环文案 | 三个 `kind: "label"` actor，`cycleKeys` 指向现有 i18n（`shop.teahouse` 等） |
| `BERTHS` | 一条渡船 path 的两端；trigger：点击 `dock-*` → `vessel:summon` |
| `BRIDGE_PATH` + `BRIDGE_CARGO_SCALE` | 一条 path + `scaleTrack`。阶段秒数（约 4s / 3.5s / 4s / 2s，见 `bridge.ts` 常量）留在 story，因为它们是任务节拍不是几何 |
| `BRIDGE_OCCLUDER` 矩形 | `kind: "occluder"` actor。在烘焙图上重对一次 |
| `CHAPTERS` | **已经在** `scene.json` 的 `chapters`。story 里的副本删除 |
| `WATER_BAND` | 留在 `meta.pluginConfig.water.bands`（已经如此） |
| `worldToScreen` | 删除。镜头同步由 Pixi world root 负责 |
| `REF_SHIFT_X` | 仅作者注记。运行时不再加 2172 |

`i18n` 键保持，避免文案回归。

## 3. 模块怎么拆

```text
contents/qingming-riverside/story/
├── index.ts                 # 注册 HUD、监听任务事件、cleanup
└── events/
    ├── bridge-quest.ts      # 状态机：approaching / mast / under / done
    └── hud.ts               # 面板、过船按钮、时雨/夜景/水面/音效按钮
```

目标态不再有 `street-life.ts` 与 `ferry.ts` 的渲染部分。状态机单测若要继续不依赖 Pixi，保留纯函数（下一状态、是否取消），输入改为插件事件而不是 DOM。

`bridge-quest` 与插件的边界：

```ts
// 进度或 vessel:arrived → 进入下一阶段
// 阶段 mast：emit("vessel:pause")，显示牵绳按钮
// 按住牵绳：以更高 speed 再 vessel:summon 剩余距离，或 vessel:resume
// Escape：暂停、复位距离、关 HUD
// dispose：卸监听。精灵属于 world，story 不 remove 精灵
```

速度加成今天是 `HAUL_BOOST = 1.75`（`bridge.ts`）。留在本包常量，通过 summon 的 `speed` 传入。插件不设「牵绳倍率」。

氛围按钮今天在 `weather-night.ts`：

| 按钮 | 迁移后 |
|---|---|
| 时雨 | `weather:set` rain/clear + `audio:play/stop`（已经如此） |
| 夜景 | `atmosphere:night`，删除 `.qingming-night` |
| 水面 | `water:set`（已经如此） |
| 音效 | `audio:setMuted`（已经如此） |

## 4. 可见性验收（茶市 / 虹桥 / 城门）

这些是迁移完成的定义。

| ID | 步骤 | 期望 |
|---|---|---|
| Q2-M-01 | 打开 `/?scroll=qingming-riverside`，章节飞到茶市 | 路面上能看见行人与茶肆标签。节点在 Pixi 角色层。document 中无 `.qingming-walker` |
| Q2-M-02 | 飞到虹桥、城门 | 各自路径上有人与摊位标签；标签文案仍循环（秒数以 scene 字段为准，起点是今天的 2.8s） |
| Q2-M-03 | 镜头移到水磨（远离三条路） | 三条路上的 actor 为 hidden 或 frozen。回来后续走。建议与 v1 相同：远处不模拟。测试里写死一种 |
| Q2-M-04 | 缩放 0.5 与 1.5 | 人与船的屏幕尺寸随 zoom，脚点不漂离路径 |
| Q2-M-05 | 打开夜景 | 瓦片变暗；行人仍可见（默认不把角色乘进夜色）。不存在 z-index 6/7 的夜色与行人互压 |
| Q2-M-06 | 点击东/西码头 | 船沿泊位路径完成一次；船是 Pixi actor；水带若开启，船体仍在水纹之上（`pixi-underlay`） |
| Q2-M-07 | 过船主路径与 Escape | 阶段文案仍在；取消后无残留任务 HUD；船回到起点 |
| Q2-M-08 | 切到 `demo-scroll` 再切回 | 无 `.qingming-boat`、`.qingming-walker`、`.qingming-night`、`.qingming-bridge-occluder`；天气 overlay 关闭；Three 物体卸下。堆曲线待测 |
| Q2-U-01 | 原状态机单测 | 迁到 quest 与 follower 后仍绿。DOM `layout()` 测试改为快照坐标 |

人工目视仍需要一次：路径是否贴着路面。改成 Pixi 不会自动修好标定。偏了就改 `scene.paths`，不要改 core。

## 5. 不要在这次迁移里做的

- 141 人、服装染色、网格腿
- 把过桥任务写成通用插件
- 改卷的宽高或重切瓦片（除非遮挡条需要新的源图）
- 把第二包的文件放进本包
- 为了夜色去做共享 WebGL 深度

## 6. 风险

| 风险 | 处理 |
|---|---|
| Pixi 船被 Three 水盖住 | 本包使用 `pixi-underlay`。观感不够就记缺陷，不把船退回 DOM |
| 桥洞遮挡仍然是假的 | 接受为前景条/蒙版。ADR 0005 明确不做真深度 |
| 标签在缩小时糊 | 先用渲染器文本。是否改位图字体待测 |
| 8 个精灵看不出「数百人裁剪」 | 迁移门用 8 人证明路径。容量测试用合成 spawn 放在夹具里，不把本包改成 400 人 |
| 删 CSS 时把面板一起删掉 | 只删世界类名。`.qingming-panel`、`.qingming-bridge-start`、`.qingming-atmo`、`.qingming-bridge-hud` 仍是 HUD |
