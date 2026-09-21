# 插件层详细实现计划

> 对应总览：[01-engine-implementation.md](./01-engine-implementation.md)  
> 关联：[10-core-engine.md](./10-core-engine.md) · [30-business-layer.md](./30-business-layer.md)

## 1. 目标与非目标

### 目标

提供 **可插拔、可按画启用/禁用** 的能力层：质量档、导览、音效总线、天气、水效等。插件挂在引擎 `PluginHost` 上，通过生命周期与事件钩子工作，**不修改 core 内核分支**。

### 非目标

- 单画独占剧情（虹桥过船、某铺子对话树）→ `contents/<id>/story`（业务层）
- 在插件里 hardcode 某画的实体 id（除非是 demo 插件且标注 example-only）

**判定口诀：** 换一幅画仍可能复用 → 插件；只有这一幅需要 → 业务 story。

## 2. 插件契约

```ts
// packages/core/src/contracts/plugin.ts
export interface EngineContext {
  engine: ScrollEnginePublic; // 窄接口：events、camera、assets、scheduler、getViewport…
  scene: SceneDocument | null;
  quality: QualityLevel;
}

export interface ScrollPlugin {
  id: string;
  /** 数字越大越先收到 onHit（可拦截） */
  priority?: number;
  onRegister?(ctx: EngineContext): void | Promise<void>;
  onSceneLoad?(scene: SceneDocument): void | Promise<void>;
  onSceneUnload?(): void | Promise<void>;
  onFrame?(dt: number, viewport: ViewportState): void;
  /** 返回 true 表示已处理，停止后续插件与默认分发 */
  onHit?(hit: HitResult): boolean | void;
  onQualityChange?(q: QualityLevel): void;
  onDestroy?(): void | Promise<void>;
}
```

```ts
// PluginHost 行为摘要
class PluginHost {
  use(plugin: ScrollPlugin): void;
  async loadBuiltins(ids: string[]): Promise<void>;
  async broadcastSceneLoad(scene: SceneDocument): Promise<void>;
  broadcastFrame(dt: number, vp: ViewportState): void;
  dispatchHit(hit: HitResult): boolean; // 任一插件 true 则吞掉
  async destroyAll(): Promise<void>;
}
```

### 加载来源

1. **内置插件**：`packages/plugins/<name>`，由 `meta.json` 的 `plugins: string[]` 声明，如 `["quality","guide","audio"]`。  
2. **内容局部插件**：业务 `story/index.ts` 内 `engine.plugins.use(localPlugin)`——允许，但应视为业务的一部分；若逻辑可复用再升格为内置。

```json
// contents/<id>/meta.json 片段
{
  "id": "demo-scroll",
  "plugins": ["quality", "guide", "audio"],
  "pluginConfig": {
    "guide": { "showChapterDots": true },
    "audio": { "defaultMuted": true }
  }
}
```

## 3. 包结构

```text
packages/plugins/
├── src/registry.ts          # id → factory
├── quality/
│   ├── index.ts
│   ├── QualityPlugin.ts
│   └── schema.ts
├── guide/
│   ├── GuidePlugin.ts
│   └── ChapterRail.ts       # DOM overlay，非 canvas
├── audio/
│   ├── AudioPlugin.ts       # WebAudio 总线，默认静音
│   └── unlock.ts            # 手势解锁
├── weather/
│   ├── WeatherPlugin.ts     # 首版 stub：API + 空实现
│   └── types.ts
└── water/
    ├── WaterPlugin.ts       # 依赖 three adapter 或 pixi filter（ADR）
    └── README.md            # 选型说明
```

`registry.ts` 示例：

```ts
export const builtinPlugins: Record<string, (cfg: unknown) => ScrollPlugin> = {
  quality: (cfg) => createQualityPlugin(cfg),
  guide: (cfg) => createGuidePlugin(cfg),
  audio: (cfg) => createAudioPlugin(cfg),
  weather: (cfg) => createWeatherPlugin(cfg),
  water: (cfg) => createWaterPlugin(cfg),
};
```

## 4. 内置插件详细设计

### 4.1 quality（P0，先做）

**职责：** 统一 DPR、预载半径、阴影/后处理开关、瓦片上传限额；响应 `engine.setQuality`。

**配置 schema：**

```ts
z.object({
  default: z.enum(["auto","low","medium","high"]).default("auto"),
  dprMax: z.number().optional(),
})
```

**实现要点：**

- `onRegister`：读 deviceMemory / 移动 UA 粗分档（可保守）。  
- `onQualityChange`：写回 `CachePolicy`、通知 tiles 与 renderers。  
- 不渲染任何可见 UI（或仅暴露事件给 viewer 做按钮）。

**测试：** 切 `low` 后 `maxUploadsPerFrame` 与 dpr 下降；`auto` 在 mock 移动环境选 low/medium。

### 4.2 guide（P0）

**职责：** 章节书签轨、`flyTo` 封装、可选小圆点 DOM。

**配置：** `chapters` 也可来自 `scene.json.chapters`；插件只负责 UI + 调用 `camera.flyTo`。

**实现要点：**

- `ui-layer` 内创建 rail；`pointer-events` 仅按钮可点。  
- `onSceneLoad` 重建按钮；`onSceneUnload` 清空。  
- 不写死章节文案到插件包（文案来自 scene / i18n）。

**测试：** 点击章节 → viewport 动画到目标；切换 scroll 后旧按钮移除。

### 4.3 audio（P1）

**职责：** 总线（BGM / SFX 通道）、默认静音、首次用户手势 unlock、页面 hidden 时静音。

**API：** `audio.play(id)` / `stop` / `setMuted`；资源 URL 来自 scene 或业务 story 注册。

**禁止：** 在插件内捆绑某画 mp3 文件名作为唯一路径（demo 除外）。

**测试：** 默认 muted；unlock 前 play 不抛错；hidden → mute。

### 4.4 weather（P2 stub）

**职责：** 定义 `setWeather("clear"|"rain"|…)` 与 `onFrame` 扩展点；首版可只改 CSS 滤镜或发事件，供业务/后续视觉实现。

**测试：** API 可调用；未实现视觉时不崩。

### 4.5 water（P2，需 ADR）

**职责：** 河面/水面特效。对照参考项目 `water-three.js`，在 playground 对比：

- A：Three 透明层（插件依赖 `renderer-three`）  
- B：Pixi filter / shader  

**决策写入** `plan/adr/0002-water-effect.md` 后再填实现。在此之前 registry 可注册但 `meta.plugins` 默认不包含。

**测试（决策后）：** 启用水面与世界坐标漂移 ≤ 阈值；关插件零 three 水相关 draw。

## 5. 插件与渲染/实体协作

允许：

- 向 `EntityRegistry` 注册 **临时装饰实体**（须带 `ownerPluginId`，unload 时清理）  
- 在 DOM `ui-layer` 挂覆盖物  
- 调用 `scheduler.requestContinuous(reason)` / `releaseContinuous(reason)`  
- 订阅 `entity:click`（优先用 `onHit` 或 events）

禁止：

- 直接改 Viewport 私有字段（走 `camera` API）  
- 绕过 AssetManager 私自 `new Image()` 且不计入预算（至少登记）  
- 在 `onFrame` 分配大量短生命周期对象导致 GC 尖峰（指南）

## 6. 切换画卷时的隔离

`loadContent` 顺序：

```text
onSceneUnload / destroy content-local plugins
→ clear entities / tiles（引擎）
→ loadBuiltins(newMeta.plugins)（diff：卸载去掉的，加载新增的）
→ load scene
→ import story → registerStory（可 use 局部插件）
→ onSceneLoad
```

内置插件若两画都启用：**复用实例**并 `onSceneUnload`→`onSceneLoad`，或销毁重建（首版建议 **销毁重建**，实现简单、少串状态）。

## 7. 验证脚本

```json
{
  "scripts": {
    "test:plugins": "vitest run packages/plugins packages/core/src/PluginHost*",
    "playground:plugins": "pnpm --filter playground dev -- --plugin-demo",
    "test:e2e:plugins": "playwright test e2e/plugins.spec.ts"
  }
}
```

手工：

1. meta 仅 `["quality"]` → 无 guide DOM。  
2. 加上 `guide` → rail 出现；去掉再加载 → rail 消失。  
3. story 里 `use(localPlugin)`，切换画卷后局部插件 `onDestroy` 被调用（用 debug flag / 计数器）。  
4. `onHit` 返回 true 时，默认面板不打开。

## 8. 测试用例

| ID | 类型 | 目标 | 步骤 | 期望 |
|---|---|---|---|---|
| P-U-01 | unit | PluginHost | use 两个插件 broadcastFrame | 均调用；顺序按 priority |
| P-U-02 | unit | PluginHost | onHit 前插件返回 true | 后插件与默认逻辑不执行 |
| P-U-03 | unit | PluginHost | destroyAll | 均 onDestroy；再次 frame 不调 |
| P-U-04 | unit | registry | 未知 id | 抛可读错 / 跳过并 warn（二选一，文档钉死） |
| P-U-05 | unit | quality | setQuality('low') | policy 字段变化 |
| P-U-06 | unit | guide | scene 无 chapters | 不渲染空点；不抛错 |
| P-U-07 | unit | audio | 默认 muted | play 为 no-op 或静音通路 |
| P-I-01 | integration | loadContent | plugins 列表变更 | 旧卸新装 |
| P-I-02 | integration | 局部插件 | A story use → 切 B | A 局部插件已 destroy |
| P-E-01 | e2e | guide | 点章节点 | URL/镜头到达 bookmarked 区 |
| P-E-02 | e2e | quality | UI 切 low | 画布 buffer 尺寸下降或 dpr 降 |
| P-R-01 | regression | 架构 | grep packages/plugins | 无 `qingming`/`虹桥` 等业务硬编码 |

## 9. Definition of Done

- PluginHost 单测 P-U-01..03 绿  
- quality + guide 可经 meta 启用，e2e 冒烟绿  
- audio 总线默认静音可用  
- weather/water：stub 或 ADR 完成后再标完成  
- P-R-01 进 CI  

## 10. 排期

| 顺序 | 项 |
|---|---|
| 1 | PluginHost + registry + quality |
| 2 | guide |
| 3 | audio 总线 |
| 4 | weather stub |
| 5 | water ADR + 实现 |

业务侧如何写 story 调插件：见 [30-business-layer.md](./30-business-layer.md)。
