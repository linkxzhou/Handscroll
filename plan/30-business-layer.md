# 业务层详细实现计划

> **v1 baseline（shipped 2026-09）** — 历史基线。内容包 v2 见 [v2/30-content-pack-v2.md](./v2/30-content-pack-v2.md)。

> 对应总览：[01-engine-implementation.md](./01-engine-implementation.md)  
> 关联：[10-core-engine.md](./10-core-engine.md) · [20-plugin-layer.md](./20-plugin-layer.md)

## 1. 目标与非目标

### 目标

定义 **Content Pack（画卷内容包）** 的目录、`meta` / `scene` 数据、`story` 剧情脚本约定，以及作者脚本：**放图 → 切图 → 校验 → 预览 → 写剧情 → 验证**。保证新增长卷 **零修改** `packages/core`。

### 非目标

- 在业务层实现通用渲染/瓦片/视口  
- 首版自动生图 API（人工将图放入 `raw/`）  
- 把可复用能力（天气、音效总线）只写在某一画的 story 而从不升格插件

## 2. Content Pack 布局

```text
contents/
├── _template/                    # 复制用模板
├── demo-scroll/                  # 引擎验收用强剧情 demo（街市向）
├── guide-only-scroll/            # 弱剧情第二包（仅热点解说）
├── gusu-fanhua/                  # 后续：《姑苏繁华图》类
├── nandu-fanhui/
├── kangxi-nanxun/
└── …

contents/<scroll-id>/
├── meta.json
├── raw/                          # 人工放置，工具只读
│   ├── background.webp
│   ├── overlays/
│   └── README.md                 # 提示词、来源、授权
├── tiles/                        # tile-builder 生成（可覆盖）
│   └── manifest.json
├── atlas/                        # atlas-builder 生成（可选）
├── scene.json
├── story/
│   ├── index.ts                  # 必须：export registerStory
│   └── events/                   # 可选：本画事件模块
├── i18n/
│   └── zh-CN.json
└── preview/
    └── cover.webp
```

## 3. Schema

### 3.1 meta.json

```ts
const MetaSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string(),
  era: z.string().optional(),
  description: z.string().optional(),
  width: z.number().positive(),
  height: z.number().positive(),
  defaultViewport: z.object({
    centerX: z.number(),
    centerY: z.number(),
    zoom: z.number().positive(),
  }).optional(),
  plugins: z.array(z.string()).default([]),
  pluginConfig: z.record(z.unknown()).optional(),
  storyEntry: z.string().default("./story/index.ts"),
  license: z.object({
    code: z.string().optional(),
    assets: z.string(),
    notes: z.string().optional(),
  }),
});
```

### 3.2 scene.json

```ts
const HotspotSchema = z.object({
  id: z.string(),
  type: z.literal("hotspot"),
  x: z.number(),
  y: z.number(),
  shape: z.union([
    z.object({ kind: z.literal("rect"), w: z.number(), h: z.number() }),
    z.object({ kind: z.literal("circle"), r: z.number() }),
    z.object({ kind: z.literal("polygon"), points: z.array(z.object({ x: z.number(), y: z.number() })) }),
  ]),
  zIndex: z.number().optional(),
  action: z.object({
    type: z.enum(["openPanel", "emit", "flyTo", "none"]),
    payload: z.unknown().optional(),
  }).optional(),
  i18nKey: z.string().optional(),
});

const SceneSchema = z.object({
  version: z.literal(1),
  meta: z.object({ id: z.string(), width: z.number(), height: z.number() }),
  background: z.object({ manifestUrl: z.string() }),
  entities: z.array(z.discriminatedUnion("type", [
    /* sprite, animation, hotspot, model3d */
  ])),
  chapters: z.array(z.object({
    id: z.string(),
    titleKey: z.string().optional(),
    title: z.string().optional(),
    centerX: z.number(),
    centerY: z.number(),
    zoom: z.number(),
  })).default([]),
});
```

`width/height` 必须与 `meta` 及 tiles manifest 一致（validator 交叉检查）。

## 4. story 契约

```ts
// contents/<id>/story/index.ts
import type { ScrollEngine } from "@handscroll/core";

export async function registerStory(engine: ScrollEngine): Promise<void> {
  const off = engine.on("entity:click", ({ entityId }) => {
    if (entityId === "dock-east") {
      void startFerry(engine); // 本画 events/
    }
  });

  // 可选：局部插件
  // engine.plugins.use(createBridgeEventPlugin());

  engine.on("scene:unload", () => {
    off();
  });
}
```

约定：

- 必须导出 `registerStory`（async 允许）  
- 副作用可逆：在 unload 取消订阅、停定时器、卸局部插件  
- 禁止 import `packages/renderer-*` 内部文件；只通过 engine 公共 API  
- 禁止 import 其他 `contents/<别的画>/`  

### 常见模式

| 模式 | 做法 |
|---|---|
| 点击热点打开解说 | scene `action.openPanel` + viewer 壳；或 story 听事件 |
| 镜头书签 | `chapters` + guide 插件；story 可 `camera.flyTo` |
| 时间线剧情 | story 内状态机；`scheduler.requestContinuous` 于演出期间 |
| 调用通用能力 | `engine.plugins` 已启用的 audio/weather API |
| 本画独有玩法 | `story/events/*.ts` 局部模块或局部 ScrollPlugin |

## 5. 作者工作流脚本

```bash
# 1) 从模板新建
yarn content:new --id gusu-fanhua --title "姑苏繁华图（示例）"

# 2) 人工：把长图放入 contents/gusu-fanhua/raw/，写 raw/README.md 授权

# 3) 切图
yarn content:tiles --id gusu-fanhua

# 4) 生成空 scene（若尚无）
yarn content:scaffold-scene --id gusu-fanhua

# 5) 校验
yarn content:validate --id gusu-fanhua

# 6) 预览
yarn content:preview
# → apps/viewer/?scroll=gusu-fanhua

# 7) 写 story → 再 validate + preview + e2e（可选）
```

工具实现位置：`tools/scene-scaffold`、`tools/tile-builder`、`tools/scene-validator`；`content:*` 为根脚本别名。

### tile-builder 行为

- 输入：`raw/background.*`（png/webp/tif）  
- 输出：`tiles/{level}/{x}_{y}.webp` + `manifest.json`  
- 校验：输出尺寸与 meta width/height 一致；失败非 0 退出码  

### scene-validator 行为

- Zod 校验 meta/scene  
- 交叉：entity 引用的 atlas/帧存在  
- 交叉：hotspot 在世界矩形内  
- 可选：`story/index.ts` 可被 bundler 解析（smoke import）  
- **架构门禁：** `rg` 检查 `packages/**` 无该 scroll 专有字符串（逆向：业务不进 core）——业务 CI 侧检查 story 不 import 其他 pack  

## 6. 两包验收策略

| Pack | 目的 | 内容 |
|---|---|---|
| `demo-scroll` | 证明引擎+插件+剧情 | 瓦片 + 动画实体 + 热点 + 简单 story 状态机（如「点击码头触发镜头+文案」） |
| `guide-only-scroll` | 证明业务隔离 | 另一尺寸长图 + chapters + 解说热点；**无**复杂事件；plugins 可不同 |

CI：`content:validate --id demo-scroll && content:validate --id guide-only-scroll`；e2e 各开一次。

后续名画 pack（姑苏、南都、南巡、仇英本、清院本、夜宴、货郎、江山等）**只加 contents**，不改引擎里程碑；素材未就绪时仅占位 `meta` + README。

## 7. Viewer 加载伪代码

```ts
async function loadScroll(scrollId: string) {
  const base = `/contents/${scrollId}`;
  const meta = MetaSchema.parse(await fetchJson(`${base}/meta.json`));
  await engine.loadContent({
    scrollId,
    meta,
    sceneUrl: `${base}/scene.json`,
    manifestUrl: `${base}/tiles/manifest.json`,
    storyModule: () => import(/* @vite-ignore */ `${base}/story/index.ts`),
  });
}
```

Vite 需配置 `contents/**` 为静态资源或显式 glob 导入映射（实现时定一种，写入 viewer README）。

## 8. 验证脚本汇总

```json
{
  "scripts": {
    "content:new": "node tools/content-new.mjs",
    "content:tiles": "node tools/tile-builder/cli.mjs",
    "content:scaffold-scene": "node tools/scene-scaffold/cli.mjs",
    "content:validate": "node tools/scene-validator/cli.mjs",
    "content:validate:all": "node tools/scene-validator/cli.mjs --all",
    "content:preview": "node tools/content-preview.mjs",
    "test:content": "vitest run tools/scene-validator packages/scene",
    "test:e2e:content": "playwright test e2e/content-packs.spec.ts"
  }
}
```

手工作者清单：

1. 只放 raw、不写 story → 能平移缩放看全图  
2. 加 hotspot + openPanel → 点击出 HTML 面板  
3. 写 registerStory → 自定义点击逻辑生效  
4. 切换到另一 pack → 前画 story 卸载，无残留监听  
5. 故意改错 width → `content:validate` 失败且报交叉错误  

## 9. 测试用例

| ID | 类型 | 目标 | 步骤 | 期望 |
|---|---|---|---|---|
| B-U-01 | unit | MetaSchema | 缺 license.assets | 校验失败 |
| B-U-02 | unit | SceneSchema | 非法 entity type | 失败 |
| B-U-03 | unit | 交叉校验 | meta 宽 ≠ manifest | 失败并指出字段 |
| B-U-04 | unit | 交叉校验 | hotspot 越界 | 失败 |
| B-U-05 | unit | content:new | 执行后 | 目录结构完整 |
| B-I-01 | integration | load demo | registerStory 调用 | mock 计数 +1 |
| B-I-02 | integration | 切换 pack | 旧 story unload | 监听器移除 |
| B-I-03 | integration | 无 story 文件 | storyEntry 缺失 | 仍可仅浏览（或显式空模块） |
| B-E-01 | e2e | demo-scroll | 点击剧情热点 | UI/镜头变化 |
| B-E-02 | e2e | guide-only | 章节点 | flyTo；无 demo 专有事件 |
| B-E-03 | e2e | 仅 raw+tiles | 无 entities | 可浏览 |
| B-R-01 | regression | core | `rg` 业务实体名 | packages/core 无命中 |
| B-R-02 | regression | story | import 路径 | 无 cross-content import |
| B-L-01 | license | raw/README | validate --strict-license | 缺授权说明失败（可配置） |

## 10. i18n 与合规

- 面板文案优先 `i18nKey` → `i18n/zh-CN.json`  
- 每 pack `license.assets` + `raw/README.md` 必填来源  
- 无授权素材不得进入默认 CI 发布路径（可 `private: true` 本地 pack）  

## 11. Definition of Done

- `_template` + `content:new/tiles/validate/preview` 可用  
- `demo-scroll` 与 `guide-only-scroll` 均 validate + e2e 绿  
- B-R-01/02 进 CI  
- 作者手册：`contents/README.md`（可从本文 5–8 节压缩）  
- 总览 01 中「本周下一步」与业务工具对齐  

## 12. 排期

| 顺序 | 项 |
|---|---|
| 1 | `_template` + meta/scene Zod + validate CLI |
| 2 | tile-builder + demo raw 样例（可小图） |
| 3 | viewer `?scroll=` + 无 story 浏览 |
| 4 | story loader + demo 最小剧情 |
| 5 | guide-only 第二包 + 隔离测试 |
| 6 | 作者手册与名画 pack 占位目录 |

## 13. 与引擎/插件的接口清单（防扯皮）

| 业务需要 | 调用 |
|---|---|
| 看图 | tiles + viewport（引擎） |
| 章节点 | scene.chapters + guide 插件 |
| 点击解说 | hotspot + viewer 面板 / story |
| 音效 | audio 插件 API |
| 水面 | water 插件（meta 启用） |
| 独有玩法 | story/events 或局部插件 |
