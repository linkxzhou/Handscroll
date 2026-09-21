# 应用层计划：清明上河图式街市卷（qingming-riverside）

> 目标：用 **Handscroll 引擎** + `third_party/qingming-riverside` **素材与交互语义**，在应用层落地一个可浏览、可渐进接入玩法的 content pack。  
> 不是把参考项目的 Canvas 2D 运行时搬进 core；**引擎不改业务硬编码**，本画全部落在 `contents/qingming-riverside/`（+ 必要时升格通用插件）。

关联文档：

- 总览：[01-engine-implementation.md](./01-engine-implementation.md)
- 引擎 / 插件 / 业务：[10](./10-core-engine.md) · [20](./20-plugin-layer.md) · [30](./30-business-layer.md)
- 参考仓库（只读）：`third_party/qingming-riverside`（根 `.gitignore` 已忽略，默认不进 Git；素材以拷贝/导出进 content pack 为准）

---

## 1. 产品定位

| 项 | 说明 |
|---|---|
| Pack id | `qingming-riverside` |
| 对外名称 | 沿河街市交互长卷（清明上河图式）；文案需标明**原创插画再创作**，非张择端原作扫描 |
| 入口 | `apps/viewer?scroll=qingming-riverside` / playground 同参 |
| 与 demo 关系 | demo / guide-only 继续做引擎验收；本 pack 是**第一个真实内容应用** |

**成功标准（应用层）：**

1. 用户只打开本 pack 即可平移缩放浏览完整拼接街市底图（瓦片）。  
2. 四段章节可 flyTo：水磨 → 茶市/虹桥 → 城门（对齐参考底部圆点语义）。  
3. 至少若干热点解说 + 1～2 个最小 story 事件（如唤船/点击店铺占位），且切换到其他 pack 无泄漏。  
4. 授权与来源写进 `meta.license` + `raw/README.md`。  
5. **不**把参考项目的 `scene.js` 主循环拷进 `packages/core`。

---

## 2. 参考项目审计结论（应用视角）

### 2.1 可复用（优先）

| 资产 / 语义 | 路径（参考仓） | 用途 |
|---|---|---|
| 中央无人街景 | `assets/street-empty.webp`（2172×724） | 拼接底图中段 |
| 西侧街区 | `assets/district-west.webp` | 水磨/陶作/织坊 |
| 东侧街区 | `assets/district-east.webp` | 货市/城门/仓场 |
| 人物图集 | `assets/people-ink.webp`、`featured-characters-v7.webp` | 后期 animation/sprite |
| 船 | `assets/boat.webp` | 渡船/货船实体 |
| 分区加载思想 | `districts.js` | 迁移为**离线拼接 + 引擎瓦片**，不再运行时三图叠加 |
| 世界尺度与路面 | README / `world.js`：街面约 y=477，河岸/水面带 | 热点与路径坐标依据 |
| 交互语义 | 唤船、过虹桥、时雨、夜景、街区事件 | **story/events** 分阶段移植，不一次性全搬 |
| 水效思路 | `water-three.js` | 升格为通用 `water` 插件时再做（ADR 0002） |

### 2.2 不可直接复用（运行时）

- `scene.js` / Canvas 2D 主循环、整图像素绘制人物变形  
- 参考项目自带的镜头/缩放手势实现（已由引擎 Viewport/Input 替代）  
- `vendor/three` 拷贝（用引擎 lazy Three）  
- 把 141 人网格变形、服装染色管线原样迁入（成本极高，后置）

### 2.3 坐标体系统一（关键）

参考运行时大致为：

- 中央：`x ∈ [0, 2172)`，`y ∈ [0, 724)`  
- 西侧绘制原点约 `-2172`（并有 2272/2172 水平拉伸拼缝）  
- 东侧约从 `2072` 起画  

Handscroll 世界坐标约定：**左上原点、X 右 Y 下、宽高为正**。应用层建议：

```text
离线导出一张 background.png/.webp
  width  ≈ 6516   （西 2172 + 中 2172 + 东 2172，拼缝按 districts 规则烘焙）
  height = 724

世界坐标：
  x' = x_ref + 2172      # 把参考系平移到 [0, 6516)
  y' = y_ref
```

所有从参考代码抄来的路径点、热点、码头坐标，**一律先做 +2172 平移**（若拼缝拉伸与参考不完全一致，以烘焙后的底图重新标定，见 Phase A）。

### 2.4 授权

- 参考 README / PROJECT-STORY：**原创生成插画**，非《清明上河图》原作扫描。  
- 上游公开源：`https://github.com/xianxie6/qingming-riverside`。  
- 本仓 `third_party` 被 gitignore；**进 contents 的素材必须带 license 摘录与上游链接**。  
- 发布前人工确认上游 LICENSE（参考树内未见独立 LICENSE 文件时，以仓库声明 + 联系/README 为准，**不确定则仅本地预览、不公开分发素材**）。

---

## 3. 目标目录（应用层）

```text
contents/qingming-riverside/
├── meta.json
├── raw/
│   ├── background.webp          # 离线拼接后的整卷底图（或分片源 + 拼接脚本产出）
│   ├── overlays/                # 船、遮挡层、修复补丁等（可选）
│   ├── people/                  # 从图集裁切/拷贝的精灵源
│   └── README.md                # 来源、上游链接、提示词索引、授权
├── tiles/                       # tile-builder 生成
├── atlas/                       # 人物/船图集（后期）
├── scene.json                   # 热点、章节、sprite/animation/model3d
├── story/
│   ├── index.ts                 # registerStory
│   ├── coords.ts                # 参考坐标 → 引擎坐标
│   └── events/
│       ├── ferry.ts             # 唤船（阶段 C）
│       ├── bridge.ts            # 虹桥过船（阶段 D）
│       ├── street-life.ts       # 街区小品（阶段 D/E）
│       └── weather-night.ts     # 时雨/夜景（依赖插件，阶段 E）
├── i18n/zh-CN.json
└── preview/cover.webp
```

可选工具（应用侧，不进 core）：

```text
tools/qingming-adapt/
├── stitch-districts.mjs         # west+center+east → background
├── remap-coords.mjs             # 批量 +2172 / 校验落在画布内
└── extract-hotspots.md          # 从参考列出码头/店铺候选点
```

---

## 4. 分层职责（再次钉死）

| 能力 | 落点 |
|---|---|
| 瓦片、视口、输入、调度、命中 | 引擎（已有） |
| 章节圆点、质量档、音效总线 | 插件 `guide` / `quality` / `audio` |
| 水面 Three 特效 | 插件 `water`（未完成则本 pack 先禁用或占位） |
| 拼接底图、章节、解说热点、唤船/过桥/街市事件 | **本 pack 业务** |
| 参考项目 JS 主循环 | **丢弃** |

---

## 5. 分阶段实施

### Phase A — 底图可逛（1–2 天）【门禁】

**做什么**

1. `stitch-districts`：用 `street-empty` + `district-west` + `district-east` 按参考拼缝规则烘焙 `raw/background.webp`（6516×724 量级）。  
2. 写入 `meta.json`（width/height、defaultViewport、plugins: `["quality","guide"]`、license）。  
3. `pnpm content:tiles -- --id qingming-riverside`。  
4. `scene.json`：空实体或仅 chapters 四个书签（水磨 / 茶市 / 虹桥 / 城门），坐标经 `+2172` 映射并人工微调。  
5. `story/index.ts` 可先空实现（只 return cleanup）。  

**验收**

- `playground?scroll=qingming-riverside` 可拖拽看全卷，LOD 正常。  
- `content:validate` 通过。  
- 与 `demo-scroll` 切换无泄漏。  

**不测：** 人物、船、水、复杂事件。

---

### Phase B — 解说与导览（1–2 天）

**做什么**

- 热点：码头、茶铺、虹桥、城门、水磨等（矩形/多边形），`action: openPanel`，文案进 `i18n`。  
- guide 章节与热点对齐。  
- 可选：点击某热点 `flyTo`（story 或 hotspot action）。  

**验收**

- 点击热点出面板；章节点 flyTo 落点正确（误差人工目视 ≤ 几十世界单位）。  
- Vitest：pack meta/scene fixture 校验；story 加载/卸载。  

---

### Phase C — 最小动态层（约 1 周）

**目标：** 证明「分层素材 + story」可行，不追求 141 人。

1. 从 `people-ink` / featured 裁 3～5 个静止或双帧 sprite，放入 `scene.entities`。  
2. 船：1 艘 `sprite`/`animation`，码头热点触发 **简化唤船**（story 状态机：靠岸 → 短暂等待 → 横渡插值 → 对岸；可用 `camera.flyTo` 跟随或仅船移动）。  
3. 坐标全部走 `coords.ts`。  

**验收**

- 点击东/西码头能走完一次简化渡船循环。  
- 切换 pack 后定时器/监听清理（单测 + 手动）。  

**不做：** 网格腿部变形、服装染色缓存、完整 passenger 路径。

---

### Phase D — 招牌事件「虹桥过船」【本 pack 已落地简化版】

- 移植参考 `bridge-event` **状态机语义**（靠近、降桅/牵绳、过桥、完成/Esc 取消），UI 用 HTML overlay（viewer），船用现有 `boat.webp` DOM 精灵 + 简单绳索。  
- **未**移植 Canvas2D 运行时。桥洞遮挡为 DOM 前景条带（假遮挡），不改引擎拓扑。  
- 入口：左下「过船」按钮、热点 `bridge-event`、虹桥面板「开始过船」。  

**验收**

- 可完成一次「过船」主路径；Escape 可取消。  
- 文档说明与参考差异（未 1:1 复刻处）见 pack README。  

**仍后置：** Phase E 时雨/夜景/水效；Phase F 人群街市。

### Phase E — 氛围插件对接（并行/后置）

| 项 | 依赖 | 策略 |
|---|---|---|
| 时雨 | `weather` 插件 | 插件先 stub API，story 调 `setWeather`；视觉可先 CSS/滤镜 |
| 夜景 | 业务或插件 | 优先乘色/双套瓦片（成本高）→ 首版乘色叠加 |
| 水效 | `water` + Three | 等 ADR 0002；本 pack `meta.plugins` 再加 `water` |
| 音效 | `audio` | 拷贝可授权 mp3 到 pack 或 contents 资源表，默认静音 |

---

### Phase F — 人群与街市生活（长期）

- 批量实体：路径行人、店铺循环事件（参考 `street-life`）。  
- 性能：活跃区（可见/附近/远处）、图集分包。  
- 仅当 C/D 稳定后再开；可单独立项，不阻塞「可发布导览版」。

---

## 6. meta / scene 草案

### meta.json（示意）

```json
{
  "id": "qingming-riverside",
  "title": "沿河街市（清明上河图式）",
  "era": "宋风原创再创作",
  "width": 6516,
  "height": 724,
  "defaultViewport": { "centerX": 3258, "centerY": 362, "zoom": 0.9 },
  "plugins": ["quality", "guide", "audio"],
  "pluginConfig": {
    "guide": { "showChapterDots": true },
    "audio": { "defaultMuted": true }
  },
  "storyEntry": "./story/index.ts",
  "license": {
    "assets": "Derived from xianxie6/qingming-riverside original generated art; not Song-dynasty original painting scans. See raw/README.md.",
    "notes": "Verify upstream license before public redistribution of binaries."
  }
}
```

### chapters（示意，坐标需标定）

| id | 语义 | 参考系大致位置 | 引擎 x（+2172 后） |
|---|---|---|---|
| watermill | 水磨 | 西段 `data-x=-1550` | 622 |
| teahouse | 茶市 | 中央偏左 `data-x=650` | 2822 |
| bridge | 虹桥 | 中央 `data-x=1560` | 3732 |
| gate | 城门 | 东段 `data-x=3360` | 5532 |

标定：上游章节圆点 `data-x` +2172，centerY=400 以同时框住街面与河。热点矩形按拼接底图微调（见 `contents/qingming-riverside/scene.json`）。

---

## 7. Story 模块设计

```ts
// story/index.ts
export function registerStory(engine: ScrollEnginePublic): () => void {
  const ferry = createFerryController(engine);
  const offs = [
    engine.on("entity:click", (hit) => {
      if (hit.entityId.startsWith("dock-")) ferry.summon(hit.entityId);
      // bridge / shop handlers…
    }),
  ];
  const onUnload = () => {
    ferry.dispose();
    offs.forEach((off) => off());
  };
  engine.on("scene:unload", onUnload);
  return onUnload;
}
```

原则：

- 状态机本地化在 `events/*`，可单测（不依赖 Pixi）。  
- 需要连续动画时 `scheduler.requestContinuous('qingming:ferry')`，结束 release。  
- 禁止 import 其他 contents pack；禁止 import renderer 内部 API。

---

## 8. 与引擎缺口的对接（应用驱动，能升格再升格）

| 应用需要 | 现状 | 对策 |
|---|---|---|
| 超长真实图瓦片 | 已有 tile-builder | 直接用；注意 6516×724 体积与质量档 |
| 多帧人物 | animation 包可能仍简陋 | Phase C 双帧即可；不足再提引擎 issue |
| 路径跟随 | 未必有现成 PathAnimation | story 内插值或补 `packages/animation` 通用路径 |
| 桥洞遮挡 | 双 Canvas 难交错 | 前景条带 sprite / 降低表现；不强制改拓扑 |
| 水 | water stub | Phase E + ADR |
| 音效资源表 | audio 总线 | pack 内 url 注册 |

应用 plan **可以提引擎小改进**，但默认先 story 侧 workaround，避免阻塞内容。

---

## 9. 验证与测试

### 脚本

```bash
pnpm content:tiles -- --id qingming-riverside
pnpm content:validate -- --id qingming-riverside
pnpm playground   # ?scroll=qingming-riverside
pnpm test:unit
pnpm test:content
```

### 用例表

| ID | 类型 | 内容 | 期望 |
|---|---|---|---|
| Q-A-01 | manual | Phase A 浏览 | 全卷可逛，无整图纹理 |
| Q-A-02 | unit | meta/scene zod | validate 通过 |
| Q-A-03 | unit | coords 映射 | 抽样点在 [0,W)×[0,H) |
| Q-B-01 | e2e/manual | 热点面板 | 打开/关闭正常 |
| Q-B-02 | manual | 四章节 flyTo | 落点正确 |
| Q-C-01 | unit | ferry 状态机 | 序列转换与 dispose |
| Q-C-02 | integration | 切到 demo | ferry 监听解除 |
| Q-D-01 | manual | 过船主路径 | 可完成/可取消 |
| Q-R-01 | regression | `rg` packages | 无 qingming 业务硬编码 |

---

## 10. 实施任务清单（可建 issue）

**A 底图**

- [x] 实现 `tools/qingming-adapt/stitch-districts.mjs`
- [x] 产出 `contents/qingming-riverside/raw/background.webp` + raw/README
- [x] meta + 空/章节 scene + tiles
- [ ] playground 验收截图

**B 导览**

- [x] 热点标定与 i18n
- [x] guide 四章节最终坐标

**C 动态最小集**

- [x] 人物/船 sprite 接入
- [x] ferry 简化状态机 + 单测

**D 虹桥过船（简化）**

- [x] `story/events/bridge.ts` 状态机 + 单测 + `registerStory` 与 ferry 一同 dispose
- [x] 热点 `bridge-event` / 过船按钮 / Esc 取消
- [ ] Phase E 时雨/夜景/水效（仍后置）
- [ ] Phase F 人群街市（仍后置）

---

## 11. 风险

| 风险 | 缓解 |
|---|---|
| 拼缝与参考拉伸不一致导致坐标全偏 | Phase A 强制「在新底图上重标定」；coords 测与视觉点选结合 |
| 素材授权不清 | 不上架公开 CDN；README 醒目声明；必要时只留流程用替代图 |
| 一次移植全部事件爆炸 | 严格 Phase A→B→C；D 单独里程碑 |
| 遮挡/水效期望过高 | 文档写清首版表现边界 |
| third_party 过大不当提交 | 只提交 contents 所需导出物；工具读 third_party 本地路径 |

---

## 12. 建议的立即下一步

1. 合并或拉取当前引擎 PR，确保 `content:new` / `content:tiles` / story 加载可用。  
2. 落地 Phase A：拼接脚本 + `qingming-riverside` pack 可逛。  
3. 在烘焙图上标定四章节与 5 个以内热点，进入 Phase B。  

---

## 13. 一句话

**把参考项目当成「素材库 + 玩法说明书」，用 Handscroll 的 content pack 重做应用；先拼接长卷可逛，再热点导览，再简化唤船，最后才是虹桥/风雨/人群。**
