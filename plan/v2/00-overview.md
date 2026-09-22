# Handscroll 引擎计划 v2.0 — 总览

> **实施状态：** Phase 1 已完成 · Phase 2+ 未开始

> 状态：有效计划（Phase 0 版本门与 Phase 1 世界运行时已落地；Phase 2 起尚未实现）  
> 基线：v1 baseline（shipped 2026-09），见 [../README.md](../README.md)  
> 本文不改运行时。实现时仍遵守：`packages/core` 不 import `pixi.js` / `three`，core 内不出现画名或实体 id。

## 1. 产品定位

**画卷游戏引擎**（scroll game engine）：给中国古典**横卷 / 长卷**（以及构图相近的超长横幅）用的可玩运行时，不是《清明上河图》单机演示，也不是通用网页地图。

玩家沿画卷水平走动视线，在世界坐标里遇到人、船、铺、桥、章节与少量剧情。换一幅画时，作者换的是 **content pack**（底图、图集、路径、区域、文案、薄脚本），不是 fork 引擎。

v1 的对外句子是「超长交互画卷引擎」。浏览能力已经成立。用户反馈是：街市玩法仍然不像在画里走，而像叠在画上的 HTML。v2.0 把产品句子改成：

> 实现一套能适配多幅中国（及同类）古典长卷的**卷轴绘画游戏引擎**。

「适配」指数据与薄脚本能表达该画类型需要的玩法，不是自动识别画意，也不是生成原画。

## 2. 和 v1 的关系

| 处置 | 内容 |
|---|---|
| **保留** | 三层：`packages/core` + 渲染/资源包、`packages/plugins`、`contents/<scroll-id>/`。Pixi 主世界 + lazy Three。Yarn 4 workspaces。瓦片金字塔（`tools/tile-builder`）+ Zod（`packages/scene`）。`meta.json` 的 `plugins`。热点形状与章节书签。`registerStory` 可卸载。`test:dep` 禁止 core 依赖 pixi/three。ADR 0001 双 Canvas。质量档、导览轨、音效总线、天气 overlay、水面插件的**存在**。 |
| **演进** | 场景从「四种展示实体」升级为可玩世界数据（actor / path / zone / spawn / dialogue stub / trigger）。`packages/animation` 从时钟变成通用路径与帧时钟。Pixi 增加与视口同步的世界角色层。命中从「只测 hotspot」扩展到角色与区域，并做视口裁剪。调度增加暂停与时段钩子。可复用玩法（人群、船只、夜色）从清明上河图 story 升到插件。作者路径改为声明式为主、脚本只接 id 与独特任务。 |
| **废弃（v2 目标态，v1 代码在迁移完成前仍可运行）** | 用 DOM 扮演世界角色（行人、船体、店铺世界标签、跟着世界坐标跑的图钉）。story 里各写一套折线跟随。story 私自 `requestAnimationFrame`，绕开 `RenderScheduler`。schema 里的 `sprite` / `animation` 若渲染器不画它们，则不再假装它们是角色系统。把 `FlatbushIndex` 当作空间索引（今天的点击路径是线性扫描，见差距分析）。ADR 0002 里「河上的船优先 DOM」这一条推论——水面本身仍可用 Three，船不再为了压过水面而回到 DOM（见 [adr/0005](./adr/0005-occlusion-and-water-composite.md)）。 |

v1 计划文件不删。它们解释 2026-09 已交付的浏览引擎。施工顺序见 [50-roadmap.md](./50-roadmap.md)。

## 3. 目标画卷类型与引擎必须提供的能力

类型是**玩法剖面**，不是承诺已取得该画的图像版权。素材未就绪时用合成长图占位，文案必须写明不是原作扫描。

| 类型 | 代表（仅作类型说明） | 引擎要提供 | 内容包自己写 |
|---|---|---|---|
| **街市风俗** | 清明上河图式、姑苏繁华、南都繁会 | 路径人群、摊位循环标签、船/车沿路径移动、视口裁剪、简单遮挡层、区域音效 | 铺名、码头 id、独有任务（如过桥降桅） |
| **南巡纪行** | 康熙 / 乾隆南巡图类 | 超宽卷（规划包络 6k–20k 世界像素宽）、仪仗/船队沿同一条 path、章节=路程站 | 站名、仪仗成员与速度、哪一段才允许下船 |
| **山水长卷** | 千里江山、富春山居类 | 章节导览、少量热点、雾/时辰钩子、可选一艘慢船；人群系统可关闭 | 题跋式解说；通常无 quest |
| **叙事人物卷** | 韩熙载夜宴、洛神赋图类 | 章节进入触发、对话**桩**（id + 行列表，不是完整 RPG 对话树）、时间线钩子、少量定点角色 | 对白正文、演出顺序 |
| **劳动生产** | 闸口盘车、耕织图类 | 循环路径或往返（ping-pong）、刷新点、区域进入才模拟 | 工序文案、哪一架机械循环 |

同一套原语覆盖五类：`path` + `actor` + `zone` + `trigger` + 可选 `spawn`。街市把它们配成人群；山水几乎只用章节和热点；叙事卷把 trigger 接到对话桩。core 不出现「虹桥」「茶市」分支。

## 4. 非目标（v2 明确不做）

- **不把生图 API 放进 v2 核心。** `tools/image-gen` 维持 v1 的说明位：图由人放入 `raw/`。日后若接 API，只写工具，仍落到同一目录。
- **不声称任何 third_party 或 contents 素材是宋代（或任何朝代）原作扫描。** `qingming-riverside` 是上游原创生成插画的再创作，见该包 `meta.license` 与 `raw/README.md`。
- **不做共享 WebGL 上下文的深度交错**（2D 与 3D 像素级穿插）。ADR 0001 继续有效。
- 不做通用 RPG（背包、战斗数值、技能树）。
- 不做上游 141 人网格变形、服装染色。
- v2 前四阶段不做完整可视化关卡编辑器（路线图 Phase 4 只规划轻量拾取）。
- 音频不做 HRTF / 真 3D 声像。区域音效 = 进入 zone 后在总线上播放 id。

## 5. 架构（目标态）

```text
contents/<scroll-id>/          这一幅画的数据与薄 story
        │  scene v2 + atlas + tiles + i18n
        ▼
packages/plugins               crowd、vessel、atmosphere、guide、audio、quality、water
        │  只消费契约与场景 id
        ▼
packages/world                 世界模拟：actor 快照、裁剪、跟随 path（无 pixi/three）
packages/animation             折线数学、帧时钟（无画名）
packages/interaction           热点 + actor + zone 查询
packages/scene                 Zod v1 仍可读，v2 为超集
packages/core                  视口、输入、调度、时间、触发器、插件宿主、契约
        │  RendererAdapter.setActors?(snapshots)  纯数据
        ▼
packages/renderer-pixi         瓦片层 + 世界角色层（精灵、可选文字标签、标记）
packages/renderer-three        按需：模型、以及 ADR 0005 允许的水面模式
apps/viewer                    HUD 壳、面板、画廊。世界角色不在这里画
```

依赖：

| 包 | 允许 | 禁止 |
|---|---|---|
| `core` | 契约、视口、调度、触发器 | `pixi.js`、`three`、`contents/*`、任何画名 |
| `world` / `animation` / `scene` / `interaction` | `core` 类型 | pixi、three、画名 |
| `renderer-pixi` | core 契约 + pixi | three、story |
| `plugins/*` | core 契约、scene 类型 | 写死 `qingming`、`虹桥`、码头 id |
| `contents/<id>/story` | engine 公共 API、本包 json | 其他 pack、renderer 内部文件 |

`EngineServices` 继续由 viewer 注入。core 不读磁盘上的 `/contents`。

## 6. 成功标准

下列是**验收门**，不是已测结果。未落地前一律写「待测」。

| 门 | 标准 | 现在 |
|---|---|---|
| 多画卷 | 新增第二个非清明上河图类型的 pack：复制模板、放（或生成）长图、切图、填写 scene v2、可选薄 story。**零修改 `packages/core`**，且不在 core 增加该画 id。作者工时目标：导览型（山水剖面）**≤ 5 个工作日**；含人群的第二套街市 **≤ 8 个工作日**（crowd/vessel 已合并之后）。实测工时 | **待测**（今天只有 `qingming-riverside` 是真实玩法包；`demo-scroll` 是合成验收图，无 story） |
| 人群在画里 | 茶市 / 同类路径上的行人是 Pixi 世界精灵，随视口缩放；视口外不模拟或不绘制。数百角色为设计容量，帧时间是否仍 ≤ 24ms | **待测**（v1 是 8 个 CSS 剪影，见 `street-life.ts`） |
| 切换无泄漏 | `loadContent(A)` → `loadContent(B)` 后，A 的世界角色节点、HUD、Three 物体、天气 DOM 均为 0。自动化堆快照 | **待测**（v1 有 `dispose`，无仓库内的堆回归测试） |
| 声明式 | 新画的路径、刷新、区域不需要复制 `coords.ts` + 事件模块才能动起来 | 目标，未实现 |
| 架构门禁 | `yarn test:dep` 仍绿；`packages/plugins` 与 `packages/core` 检索不到画名 | v1 的 core 已满足「无 qingming」；v2 不得倒退 |

帧预算沿用 v1：拖动 p95 ≤ 24ms（理想 ≤ 16ms），**在 v2 角色层接入后重新测**。v1 没有提交 `plan/phase1-metrics.md`，因此不引用任何「已经达标」的数字。

## 7. 文档地图

| 文件 | 回答 |
|---|---|
| [01-gap-analysis-v1.md](./01-gap-analysis-v1.md) | 计划写了什么、仓库里有什么、痛在哪 |
| [10-core-runtime-v2.md](./10-core-runtime-v2.md) | 共享运行时怎么升级 |
| [20-gameplay-plugins-v2.md](./20-gameplay-plugins-v2.md) | 哪些玩法升成插件 |
| [30-content-pack-v2.md](./30-content-pack-v2.md) | 作者如何做第二幅、第三幅 |
| [40-migration-qingming.md](./40-migration-qingming.md) | 现有街市包怎么迁 |
| [50-roadmap.md](./50-roadmap.md) | 先做哪一段才对「多画卷」最有杠杆 |
| [adr/](./adr/) | 不可逆选择 |
