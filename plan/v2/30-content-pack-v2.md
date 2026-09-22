# v2 内容包与作者流程

> **实施状态：** 待 Phase 3 · Phase 1 已完成 · Phase 2 未开始

> 一幅画 = `contents/<scroll-id>/`。引擎不认识画名。  
> v1 的 `content:new` / `content:tiles` / `content:scaffold-scene` / `content:validate` 保留。

## 1. 保留 / 改 / 弃

| 保留 | 改 | 弃 |
|---|---|---|
| 目录即包；`meta.json` 必填 `license.assets` | scene `version: 2` 当包需要人/船/区域 | 把路径只写在 `story/coords.ts` |
| `raw/` 人工放入，`tiles/` 工具生成、可覆盖 | **actor 使用图集时 `atlas/` 必备** | 用 CSS 剪影代替图集还声称「角色系统完成」 |
| `story/index.ts` 导出 `registerStory`，可缺省 | story 变薄：接线与独有任务 | 每个新包复制 ferry/street-life DOM |
| `i18n/zh-CN.json` | 触发器与标签用 `i18nKey` | 在插件里写中文铺名 |
| `_template` | 模板带上 v2 空数组与作者注释 | 把 `_template` 做成第二幅清明上河图 |
| `demo-scroll` 合成验收图 | 另加一幅**类型不同**的最小包 | 把 demo-scroll 当作「已经证明多画卷玩法」 |

## 2. 目录

```text
contents/<scroll-id>/
├── meta.json
├── raw/
│   ├── background.png|webp      # 人工
│   ├── overlays/                 # 可选：船、遮挡条源图
│   ├── atlas-src/                # 可选：切图集前的单帧
│   └── README.md                 # 来源、授权、是否为再创作
├── tiles/                        # tile-builder 生成
│   └── manifest.json
├── atlas/                        # 有 sprite actor 时必须有；工具可覆盖
│   ├── <name>.json               # 帧矩形
│   └── <name>.webp
├── scene.json                    # version 2；paths/actors/zones/... 放这里
├── story/
│   ├── index.ts                  # 可只有 return cleanup
│   └── events/                   # 仅独有任务
├── i18n/
│   └── zh-CN.json
└── preview/
    └── cover.webp                # 可选
```

路径默认在 `scene.json` 的 `paths`，这样 validator 一次看完引用。单文件过大时（例如点很多；阈值待作者工具实测后再定）允许 `paths.json`，由 validator **合并**进同一 schema 再校验。运行时只看合并结果。不要两套坐标真相。

v1 包（无新数组、`version: 1`）继续被 viewer 打开。不要求立刻改写 `demo-scroll`。

## 3. meta 增补（可选字段）

现有字段全部保留（`packages/scene/src/schema.ts` 的 `MetaSchema`）。

```ts
plugins: z.array(z.string()).default([]),
pluginConfig: z.record(z.unknown()).optional(),
// 新增可选，缺省 = 引擎默认 320 世界像素
world: z.object({
  activeMargin: z.number().positive().optional(),
}).optional(),
```

`world` 仍是通用视口边缘，不是画名配置。`320` 来自今天 `street-life.ts` 的 `ACTIVE_MARGIN`，只作为默认值。

## 4. 作者流程

```text
1. yarn content:new --id <id> --title "..."
2. 把长图放入 raw/，在 raw/README.md 写来源与授权
3. yarn content:tiles --id <id>
4. yarn content:scaffold-scene --id <id>     # v2 起生成 version 2 空数组
5. 标定 chapters 与 hotspots（解说）
6. 若有移动物体：
     准备 atlas-src → yarn content:atlas --id <id>
     在 scene 写 paths、actors 或 spawns、zones、triggers
7. 只有独有任务才写 story/events
8. yarn content:validate --id <id>
9. yarn dev → /?scroll=<id>
10. 与另一包来回切换，确认 DOM/WebGL 无残留（自动化堆快照：待测）
```

无第 6、7 步时，包必须仍然能平移缩放。这是 v1 已成立的门，v2 不得破坏。

### 4.1 工具

| 工具 | v1 状态 | v2 |
|---|---|---|
| `tools/tile-builder` | 已有 | 保留。继续拒绝浏览器内对原图现场切片 |
| `tools/scene-scaffold` | 已有，产 version 1 | 改为产 version 2 空 `paths/actors/zones/spawns/dialogues/triggers` |
| `tools/scene-validator` | 已有 Zod + 宽高交叉 | 校验 v2 引用：`pathId` 存在、zone 不越界、spawn.atlas 文件存在、i18nKey 在 `zh-CN.json` 有条目（缺键 = 警告，空 `license.assets` = 失败） |
| `tools/atlas-builder` | **不存在**（v1 计划写过） | 新增：`atlas-src/*` → `atlas/<name>.webp` + json 帧表。帧名与 scene `frame` 一致 |
| `tools/image-gen` | 只有 README，不调用 API | **保持。** 不进 v2 核心 |
| 可视化摆放 | 无 | Phase 4 可选：在 viewer 里点选世界坐标，导出 path/hotspot JSON。不阻塞 Phase 1–3 |

`content:atlas` 根脚本与 `content:tiles` 同样式。未实现前，作者可以手写一份帧 json；validator 只检查文件存在与矩形不越出图集。手写格式要写在工具 README 里，避免唯一路径是「等编辑器」。

## 5. `_template` 要补的内容

今天的模板：空 `entities`、`plugins: ["quality"]`、story 空函数、license 占位（`contents/_template/meta.json`）。

v2 模板在不加入任何画名的前提下增加：

- `scene.json` `version: 2` 与空的六个数组
- `story/index.ts` 注释改为三行示例：监听 `trigger.emit`、不要创建跟随世界的 DOM、cleanup 里卸监听
- `raw/README.md` 授权清单（下一节）
- `i18n/zh-CN.json` 空对象 `{}`
- **不要**预置行人 spawn。模板不是 demo

`content:new` 继续复制模板再替换 id/title/width/height。

## 6. 第二包：证明「不是街市引擎」

推荐 id：`shanshui-guide`。

| 项 | 决定 |
|---|---|
| 类型 | 山水长卷剖面：章节 + 热点解说 + 可选雾。不要人群 |
| 图 | **合成长图**或明确 CC0 的几何/水墨占位，沿用 `demo-scroll` 的生成方式扩展即可。禁止放《千里江山图》《富春山居图》扫描件并当成已授权 |
| 文案 | 标题可用「山水导览（合成占位）」。`license.assets` 写明不是任何名画原件 |
| 插件 | `quality`、`guide`、`atmosphere`（mist）。不启用 `crowd` |
| 场景 | 3 个 chapter、2–3 个 hotspot、1 个 zone 绑定章节进入。可选 **一条** path + **一个** vessel actor，用来证明路径系统在没有街市 story 时工作 |
| story | 空，或只听一个 `chapter:arrive` 打开已有面板 |
| 验收 | `content:validate` 通过；与 `qingming-riverside` 互切后无 `.qingming-*` 残留；相对 Phase 2 结束时的 `packages/core` 无改动 |

`demo-scroll` 继续当瓦片/视口夹具，不改造它来冒充山水。`demo-scroll` 证明「能看图」；`shanshui-guide` 证明「导览剖面可以不要街市系统」。

叙事人物卷（对话桩）可以作为 Phase 3 的替代，如果合成山水来不及放路径。**不要两幅都做**在同一阶段。优先山水：它强制 crowd 可以被关掉，直接打在「引擎是否被街市绑死」上。

劳动生产、南巡图：有授权素材之前只在总览里登记类型，不建空的名画文件夹。v1 计划列过 `gusu-fanhua` 等目录，仓库里没有；v2 不补空壳。

## 7. i18n、授权、署名

### 7.1 文案

- 玩家可见句子放 `i18n/<locale>.json`，scene 用键
- 首个 locale 仍是 `zh-CN`。英文可选，不作为 v2 门禁
- 对话桩只存 `lineKeys`

### 7.2 古典绘画再创作

凡标题或 README 指向某一幅历史名画，`raw/README.md` 与 `meta.license.assets` 必须同时包含：

1. 素材的真实来源（生成、临摹、合成、上游仓库 URL）
2. 一句否定：不是该画的原作扫描，也不是博物馆藏品的数字化文件

`qingming-riverside` 已经这样写了。v2 维持，不改成「宋本」。

validator：

| 检查 | 级别 |
|---|---|
| 缺 `license.assets` 或空串 | 失败（v1 schema 已必填） |
| `raw/README.md` 缺少来源说明 | 失败（`--strict-license`；本地草稿可关） |
| 用标题关键词猜测「盗用名画」 | **不做**自动失败。误伤大，靠清单与人工 |

无授权的二进制不进默认发布。v2 不发明尚未被 validator 读取的 `private` 字段。

### 7.3 上游

`third_party/qingming-riverside` 被 gitignore。进 `contents/` 的文件以包内 README 的许可证摘录为准。不确定公开分发权时，只本地预览。这是 v1 `plan/40` 的结论，继续有效。

## 8. story 薄到什么程度（示例）

```ts
export function registerStory(engine: ScrollEnginePublic): () => void {
  const off = engine.on("bridge:stage", () => {
    // 仅本画：降桅按钮、Esc、文案。船体位置由 vessel 插件负责。
  });
  return () => off();
}
```

同一文件里不应再出现 `document.createElement` 用于船或行人。面板按钮可以有。

## 9. 与现有包的关系

| 包 | v2 之后的角色 |
|---|---|
| `_template` | 复制源 |
| `demo-scroll` | 引擎夹具，可保持 version 1，直到需要一份 v1 兼容测试以外的改动 |
| `qingming-riverside` | 第一个**消费者**，不是 schema 的形状来源 |
| `shanshui-guide` | 第二个剖面，证明插件可关 |
