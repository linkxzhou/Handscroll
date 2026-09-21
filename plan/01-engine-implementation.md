# Handscroll 引擎实现计划

> **产品定位**：通用「超长交互画卷」引擎，不绑定《清明上河图》单一内容。任意长卷（城市风俗、南巡纪行、山水叙事等）都走同一套：**放图 → 切图 → 引擎加载 → 插件增强 → 业务剧情脚本 → 验证迭代**。

> **首版约束**：生图目前人工完成（大模型出图后手动放入指定目录），**不接** OpenAI / 其他生图 API；切图与加载流水线自动化。

> **仓库现状（2026-09-21）**：仅有 `.gitignore` 与参考子目录 `third_party/qingming-riverside`。参考项目为 Canvas 2D + Three 水层，可借鉴交互语义与内容拆分思路，**不是**运行时权威。

---

## 0. 目标与边界

### 0.1 要做成什么

| 层 | 职责 | 谁写 |
|---|---|---|
| **核心引擎** | 统一视口、输入、瓦片、资源、调度、命中；PixiJS 二维主渲染 + Three.js 按需三维 | 引擎团队 / 本仓库 `packages/*` |
| **插件层** | 可插拔能力：水效、天气、音效、导览 HUD、质量档、编辑辅助等 | 引擎内置插件 + 第三方插件 |
| **业务层** | **每一幅画自己的**场景数据、素材布局、剧情脚本、热点文案 | 内容作者 / `contents/<scroll-id>/` |

用户侧最短路径：

```text
把原图（及可选抠图层）放到 contents/<scroll-id>/raw/
→ 运行切图工具生成 tiles + manifest
→ 填写 / 生成 scene.json
→ 编写 story 插件脚本（可选）
→ viewer 加载该 scroll-id 即可浏览与交互
→ 验证 → 改素材 / 改脚本 → 再验证
```

### 0.2 多画卷目录（内容目录即「指定位置」）

引擎不硬编码任何一幅画。每幅画是一个 **content pack**：

```text
contents/
├── qingming-riverside/          # 示例：清明上河图式街市
├── gusu-fanhua/                 # 《姑苏繁华图》类
├── nandu-fanhui/                # 《南都繁会图》类
├── kangxi-nanxun/               # 《康熙南巡图》类
├── qianlong-nanxun/             # 《乾隆南巡图》类
├── qingming-qiuying/            # 仇英本
├── qingming-qingyuan/           # 清院本
├── hanxizai-yeyan/              # 《韩熙载夜宴图》等叙事卷
└── _template/                   # 新建画卷用的空模板
```

每个 pack 建议结构：

```text
contents/<scroll-id>/
├── meta.json                    # id、标题、时代、尺寸、默认镜头、启用插件列表
├── raw/                         # 【人工放置】大模型生成的原图 / 分层 PSD 导出 / 修复底图
│   ├── background.png           # 或 .webp；超长底图
│   ├── overlays/                # 可选：船、人物、遮挡层源文件
│   └── README.md                # 本画生图提示词与授权说明
├── tiles/                       # 【工具生成】瓦片金字塔 + manifest.json
├── atlas/                       # 【工具生成】序列帧图集等
├── scene.json                   # 实体、热点、章节、资源引用（数据驱动）
├── story/                       # 【业务层】剧情脚本（TS/JS 模块）
│   ├── index.ts                 # 注册 hooks：onLoad / onEntityClick / 时间线
│   └── events/                  # 如虹桥过船、时雨等（仅本画需要）
├── i18n/                        # 文案（可选）
└── preview/                     # 缩略图、封面（可选）
```

**约定**：`raw/` 只进人工产物；`tiles/`、`atlas/` 可被工具覆盖，勿手改。业务逻辑只进 `story/`，不进 `packages/core`。

### 0.3 明确不做（首版）

- 自动调用生图 API（预留 `tools/image-gen` 接口位，默认 noop / 文档说明「人工放入 raw/」）
- 为某一幅画在核心层写死剧情
- 共享 WebGL 上下文做复杂深度交错
- 浏览器内对几亿像素原图现场切片

---

## 1. 端到端工作流

```text
┌──────────────┐    人工     ┌─────────────┐   CLI/脚本   ┌──────────────┐
│ 大模型生图    │ ─────────→ │ contents/   │ ──────────→ │ tiles/atlas  │
│（外置工具）   │  放入 raw/  │ <id>/raw/   │  tile-builder│ + manifest   │
└──────────────┘            └─────────────┘             └──────┬───────┘
                                                               │
                                                               ▼
┌──────────────┐  手写/半自动  ┌─────────────┐   import    ┌──────────────┐
│ 验证与修改    │ ←────────── │ scene.json  │ ←────────── │ 可选：从热点  │
│ viewer / 真机 │   迭代      │ + story/*   │   模板生成   │ 草图生成骨架 │
└──────┬───────┘            └──────┬──────┘             └──────────────┘
       │                           │
       │  load(scrollId)           │ registerStory(plugin)
       ▼                           ▼
┌─────────────────────────────────────────────────────────────┐
│ apps/viewer                                                  │
│   Engine(core) + Plugins + ContentPack(business)             │
└─────────────────────────────────────────────────────────────┘
```

### 1.1 步骤说明

| 步骤 | 动作 | 自动化程度 |
|---|---|---|
| 1. 生图 | 用任意大模型 / 绘画工具出长卷底图与分层素材 | **人工**（首版） |
| 2. 投放 | 复制到 `contents/<id>/raw/`，更新 `meta.json` 尺寸与授权 | 人工 + 模板校验 |
| 3. 切图 | `yarn content:tiles --id <id>` | **自动** |
| 4. 场景骨架 | `yarn content:scaffold-scene --id <id>` 生成空 `scene.json` | **自动** |
| 5. 渲染跑通 | viewer 只加载瓦片 + 默认视口（无剧情也可看图） | **自动** |
| 6. 剧情脚本 | 在 `story/` 写业务：热点、时间线、过场 | **人工**（可 LLM 辅助写代码，但进业务目录） |
| 7. 验证 | playground/viewer + Playwright 冒烟 + 真机 | 半自动 |
| 8. 迭代 | 改 raw / 改 scene / 改 story → 重切或热更 | 循环 |

**引擎完成的标志**：换一幅新画时，作者只需新 content pack + 可选 story，**不必改** `packages/core`。

---

## 2. 三层架构

```text
┌────────────────────────────────────────────────────────────┐
│ 业务层  contents/<scroll-id>/                               │
│  meta + scene.json + story/* + raw/tiles                    │
│  「这一幅画发生什么」                                         │
├────────────────────────────────────────────────────────────┤
│ 插件层  packages/plugins/*  或  contents/.../story 注册的插件 │
│  WaterPlugin / WeatherPlugin / AudioPlugin / GuidePlugin    │
│  QualityPlugin / EditorPlugin …                             │
│  「可复用能力，按 meta.plugins 启用」                          │
├────────────────────────────────────────────────────────────┤
│ 核心引擎层  packages/core + tiles + assets + interaction        │
│            + renderer-pixi + renderer-three(adapter)        │
│  Viewport / Input / Scheduler / Tile / Hit / SceneRuntime   │
│  「所有画共用的运行时」                                        │
└────────────────────────────────────────────────────────────┘
```

### 2.1 核心引擎（PixiJS + Three.js）

职责划分不变：

- **PixiJS**：超长背景瓦片、二维精灵/动画、多数特效与热点绘制  
- **Three.js**：**可选插件式渲染器**，正交锚点对齐世界坐标；水、模型、粒子按需  
- **自研**：Viewport、Input、Asset、Tile、SpatialIndex、统一 RAF  

核心只认识通用实体类型（sprite / animation / hotspot / model3d / …），不认识「虹桥过船」。

### 2.2 插件层

插件实现统一接口，例如：

```ts
interface ScrollPlugin {
  id: string;
  onRegister?(ctx: EngineContext): void;
  onSceneLoad?(scene: SceneDocument): void;
  onFrame?(dt: number, viewport: ViewportState): void;
  onHit?(hit: HitResult): boolean | void; // 可拦截
  onDestroy?(): void;
}
```

- **引擎内置插件**：随仓库发布（水效、质量档、基础音效总线、章节导览条）  
- **内容侧插件**：放在某画的 `story/` 里，仅该画启用（复杂剧情）  
- `meta.json` 的 `plugins: string[]` 决定加载哪些内置插件；story 入口再注册本画专属逻辑  

### 2.3 业务层（每画剧情脚本）

业务层 = 数据 + 脚本：

- **数据**：`scene.json`（热点位置、实体、章节镜头书签）  
- **脚本**：`story/index.ts` 监听引擎事件，驱动本画玩法  

示例（示意）：

```ts
// contents/qingming-riverside/story/index.ts
export function registerStory(engine: ScrollEngine) {
  engine.on("entity:click", ({ entityId }) => {
    if (entityId === "dock-east") startFerry(engine);
  });
  engine.plugins.use(localBridgeEventPlugin); // 仅本画
}
```

《姑苏繁华图》可以有完全不同的 `story/`，共享同一引擎与「天气」「音效」等通用插件。

---

## 3. 多画卷内容路线图（非引擎阻塞）

引擎 Phase 与「画哪些画」解耦。内容可并行、按优先级填 pack：

**城市风俗优先（推荐顺序）**

1. 示例街市卷（可从参考项目语义抽一小段做 demo pack）  
2. 《姑苏繁华图》类  
3. 《南都繁会图》类  
4. 仇英本 / 清院本《清明上河图》类  
5. 《康熙南巡图》/《乾隆南巡图》类  

**其他长卷类型**（验证引擎通用性）

- 叙事人物卷：《韩熙载夜宴图》  
- 市井小品：《货郎图》  
- 劳动生产：《闸口盘车图》《耕织图》  
- 山水长卷：《千里江山图》《富春山居图》  
- 文学连续画：《洛神赋图》  

山水/叙事卷可能弱化「街市剧情」、强化章节镜头与热点解说——这正是业务层差异，引擎不改。

---

## 4. 技术选型（首版锁定）

| 项 | 选择 |
|---|---|
| 语言 | TypeScript（严格） |
| 构建 | Vite + Yarn Berry 4 workspace（`nodeLinker: node-modules`） |
| 主渲染 | PixiJS |
| 三维 | Three.js，lazy 动态 import |
| UI 壳 | Vue 或 React（viewer 外围） |
| 场景校验 | Zod |
| 空间索引 | Flatbush / RBush |
| 切图 | Sharp / libvips → `tools/tile-builder` |
| 测试 | Vitest + Playwright |

---

## 5. 仓库结构

```text
Handscroll/
├── plan/
├── packages/
│   ├── core/                 # Engine、Viewport、Input、Scheduler、EventBus、插件宿主
│   ├── scene/                # SceneDocument 类型与加载
│   ├── assets/
│   ├── tiles/
│   ├── interaction/
│   ├── animation/
│   ├── renderer-pixi/
│   ├── renderer-three/       # 以插件/适配器形式挂入
│   └── plugins/              # 内置通用插件
│       ├── water/
│       ├── weather/
│       ├── audio/
│       ├── guide/
│       └── quality/
├── apps/
│   ├── viewer/               # 按 ?scroll=<id> 或路由加载 content pack
│   └── playground/           # 引擎/插件验证沙盒
├── tools/
│   ├── tile-builder/         # raw → tiles + manifest
│   ├── atlas-builder/
│   ├── scene-scaffold/       # 从 meta/raw 生成空 scene.json
│   ├── scene-validator/
│   └── image-gen/            # 首版：README 说明人工流程；预留未来 API
├── contents/                 # 【所有画卷业务与素材】
│   ├── _template/
│   └── ...
├── third_party/
│   └── qingming-riverside/   # 参考，只读
└── README.md
```

---

## 6. 成功标准

**引擎通用性**

1. 新增一幅画：复制 `_template` → 放 raw → 切图 → 最简 scene → viewer 可浏览；**零核心代码改动**。  
2. 无 story 时仍可平移缩放看全卷；有 story 时能力可叠加。  
3. 关闭 Three / 不启用水效插件时，二维主路径完整。  

**工作流**

4. `tile-builder` 对 `raw/background.*` 一键产出可加载金字塔。  
5. `scene-validator` 校验失败时给出可读错误。  
6. destroy / 切换 scroll-id 无泄漏。  

**性能（Phase1 门禁）**

7. 目标设备拖动 p95 ≤ 24ms（理想 ≤ 16ms）；首屏先低清后高清，无整图纹理。

---

## 7. 分阶段实施

### Phase 0 — 骨架 + 内容约定（1–2 天）

- monorepo、playground、空 `Engine` + 插件宿主  
- `contents/_template` + `meta.json` schema  
- README：人工放图工作流说明  
- `tools/image-gen/README.md`：首版人工；未来 API 扩展点  

**验收：** 目录约定文档化；`yarn playground` 可跑。

### Phase 1 — 放图即可看（技术门禁，约 1–1.5 周）

1. Viewport + 输入（绕点缩放、拖动惯性）  
2. `tile-builder` + TileManager LOD  
3. Pixi 主层渲染瓦片；统一 Scheduler  
4. viewer：`loadContent(scrollId)` 只靠 meta + tiles + 空 scene 可浏览  
5. Three lazy 锚点可选验证；双 Canvas 门禁 ADR  
6. 真机指标 → `plan/phase1-metrics.md`  

**验收：** 任意放入一张长图到新 pack 的 `raw/`，切图后 viewer 可逛，无业务脚本。

### Phase 2 — 引擎 MVP + 插件宿主（约 2–3 周）

- SceneDocument + Zod；热点命中；Asset 缓存预算  
- 对外 API：`create` / `loadContent` / `on` / `camera.flyTo` / `setQuality` / `destroy`  
- 插件注册与 `meta.plugins`  
- 至少 1 个内置插件（如 quality 或 guide）跑通  
- Playwright 冒烟；切换两个 content pack  

**验收：** 两个不同 scroll-id 可切换；其一带简单 hotspot 面板。

### Phase 3 — 业务故事脚本模型（约 2 周）

- `story/index.ts` 约定与加载器（动态 import content 侧模块）  
- 动画实体、路径、分层遮挡、活跃区  
- 用 **一个** 完整 demo pack（街市向）写齐示例剧情（可借鉴参考项目事件语义，但实现为 story 插件）  
- 文档：`contents/README.md` 作者手册（如何加新画、如何写 story）  

**验收：** demo pack 含点击码头/店铺类最小剧情；第二 pack 仅解说热点、无复杂事件，证明业务隔离。

### Phase 4 — Three / 通用插件完善（约 1–2 周）

- 水效等：内置插件，按画启用  
- 质量档、上下文恢复  
- 更多内置插件按需（weather / audio）  

### Phase 5 — 作者工具与多画扩展（按需）

- 轻量编辑器（坐标拾取、热点多边形、导出 scene.json）  
- 批量接入姑苏 / 南都等 pack（素材与脚本由内容侧推进）  
- 若日后接通生图 API：只实现 `tools/image-gen`，仍写入同一 `raw/` 约定  

---

## 8. 核心契约摘要

### 8.1 视口

- 世界坐标：画卷左上原点，X 右 Y 下，单位 = 原图逻辑像素  
- DPR 不影响业务坐标  
- 缩放绕指针 / 双指中心  

### 8.2 ContentPack 加载

```ts
await engine.loadContent("gusu-fanhua");
// 等价于读取 contents/gusu-fanhua/meta.json
// → 按需启用 plugins
// → 加载 tiles/manifest + scene.json
// → dynamic import ./story/index.ts → registerStory(engine)
```

### 8.3 命中

```ts
interface HitResult {
  entityId: string;
  renderer: "pixi" | "three" | "dom";
  interactionPriority: number;
  worldX: number;
  worldY: number;
}
```

### 8.4 缓存参数起点

瓦片 512（对比 1024）、并发 4–8、桌面 DPR≤2、移动 1–1.5、预载约 0.5 屏、每帧上传限流。

---

## 9. 任务拆分（可建 issue）

### P0

- [ ] monorepo + playground  
- [ ] `contents/_template` 与 meta schema  
- [ ] 人工放图工作流写入根 README  
- [ ] tile-builder CLI  
- [ ] Viewport / Input / Scheduler  
- [ ] `loadContent` 只读瓦片可浏览  
- [ ] Phase1 指标与渲染拓扑 ADR  

### P1

- [ ] Scene + Zod + 热点  
- [ ] 插件宿主 + quality/guide 其一  
- [ ] viewer 多 scroll 切换  
- [ ] destroy / 切换无泄漏  
- [ ] Playwright  

### P2

- [ ] story 加载约定 + demo 剧情 pack  
- [ ] animation + 遮挡分层  
- [ ] 作者手册  
- [ ] 第二 pack（弱剧情）验证通用性  

### P3

- [ ] Three/水效等内置插件  
- [ ] 编辑器  
- [ ] 更多历史名画 content pack（素材就绪后）  
- [ ] （可选）image-gen API 适配器  

---

## 10. 风险与对策

| 风险 | 对策 |
|---|---|
| 把某画剧情写进 core | Code review 门禁：剧情只进 `contents/*/story` |
| 生图尺寸/风格不一 | meta 显式 width/height；切图前校验；作者手册给推荐尺寸与提示词模板 |
| 双 Canvas 遮挡不够 | Phase1 ADR；复杂遮挡改主渲染器，不叠层 |
| 参考项目绑架架构 | 只迁语义与可授权素材；运行时重写 |
| 切换画卷资源泄漏 | 强制 `destroy` 清单测试；插件 `onDestroy` |
| 版权 | 每 pack `raw/README` 写明来源与授权；无授权不进主仓库发布 |

---

## 11. 本周建议下一步

1. Phase 0：骨架 + `contents/_template`。  
2. 准备 **一张** 可授权测试长图放入 `contents/demo-scroll/raw/`，跑通切图 → viewer。  
3. 写 `plan/02-content-workflow.md`（给内容作者的短手册，可从本文第 1、2 节抽出）。  
4. 参考项目审计改为「可迁语义 / 不可迁运行时」清单（`plan/03-reference-audit.md`）。  

---

## 12. 文档索引

| 文件 | 用途 |
|---|---|
| `plan/01-engine-implementation.md` | 本文（总计划：多画卷 + 三层 + 工作流） |
| `plan/10-core-engine.md` | **核心引擎层**详细实现：包结构、契约、实现顺序、验证脚本、测试用例 |
| `plan/20-plugin-layer.md` | **插件层**详细实现：ScrollPlugin 契约、内置插件、隔离与测试 |
| `plan/30-business-layer.md` | **业务层**详细实现：Content Pack、schema、story、作者脚本与测试 |
| `plan/40-qingming-riverside-app.md` | **应用层**：基于 third_party 素材做清明上河图式 content pack |
| `plan/02-content-workflow.md` | 放图→切图→剧情→验证短手册（待写，可从 30 压缩） |
| `plan/03-reference-audit.md` | 参考仓库审计（待写） |
| `plan/adr/0001-renderer-topology.md` | 双 Canvas vs 主渲染器 |
| `plan/adr/0002-water-effect.md` | 水效选型（插件层依赖） |
| `plan/phase1-metrics.md` | 验证指标 |

---

## 13. 对齐原则（一句话）

1. **引擎服务多幅长卷；清明上河图只是其中一个 content pack。**  
2. **工作流中心是「指定目录放图 → 工具切图 → 引擎加载」；生图首版人工。**  
3. **核心 / 插件 / 业务三层分离：剧情进业务，能力进插件，运行时进核心。**  
4. **先分块与视口，再特效；先统一坐标与场景数据，再接 Three；复杂交错遮挡时改主渲染器，不叠 Canvas。**
