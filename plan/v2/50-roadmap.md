# v2.0 路线图

> 排序原则：先让**第二幅不同类型的画**少写代码，再打磨清明上河图的表现，最后才做编辑器。  
> 工作量是相对大小（S/M/L），不是日历。没有历史速度数据，不估周数。

## 实施状态

状态取值：`未开始` | `进行中` | `已完成` | `阻塞`。完成日期按 Asia/Shanghai。

| Phase | 名称 | 状态 | 完成日期 | PR |
|---|---|---|---|---|
| 0 | 冻结 v1 表面 + 版本政策 | 已完成 | 2026-09-22 | （打开 PR 后填入） |
| 1 | 世界实体 + 路径跟随 + scene v2 | 未开始 | — | — |
| 2 | crowd / vessel / atmosphere + 街市离开 DOM | 未开始 | — | — |
| 3 | 非清明上河图类型的第二包 | 未开始 | — | — |
| 4 | 作者打磨 / 轻量拾取 | 未开始 | — | — |

Phase 0 的冻结 API 与 schema 门见 [60-frozen-v1-api.md](./60-frozen-v1-api.md)。ADR 0003 / 0004 / 0005 仍为 accepted，本阶段不重开。

## 1. 阶段

```text
Phase 0  冻结 v1 表面 + 版本政策                         S
Phase 1  世界实体 + 路径跟随 + scene v2                  L
Phase 2  crowd / vessel / atmosphere + 街市离开 DOM      L
Phase 3  非清明上河图类型的第二包                        M
Phase 4  作者打磨 / 轻量拾取                              M
```

Phase 3 的图可以在 Phase 1 之后先切瓦片，但「多画卷成立」的退出条件在 Phase 2 之后：山水包必须能不加载 crowd，且街市包已经不再靠 DOM 扮演角色。先合并一个空文件夹不算 Phase 3 完成。

## 2. Phase 0 — 冻结与版本政策

**做：**

- 把今天的 scene `version: 1` 视为已发布形状
- 采纳 [adr/0004](./adr/0004-scene-schema-versioning.md)：加载器接受 1 与 2；≥3 拒绝
- 采纳 [adr/0003](./adr/0003-world-actors-pixi.md) 与 [adr/0005](./adr/0005-occlusion-and-water-composite.md)。新包不得再增加 DOM 世界角色
- 列一份迁移前不改语义的 API：`loadContent`、`HitResult`、`weather:set`、`camera.flyTo`、`requestContinuous`（全文见 [60-frozen-v1-api.md](./60-frozen-v1-api.md)）
- `test:dep` 继续禁止 core import pixi/three

**不做：** 搬迁街市、加角色层。

**退出：**

- 三份 v2 ADR 状态为 accepted（本计划已如此标记）
- 若本阶段零代码，现有测试保持绿
- review 约定：不把 `street-life.ts` 的 DOM 写法复制到新包

**工作量：** S。

## 3. Phase 1 — 世界能放进画里

**做：**

- `packages/animation` 的 `stepFollower`（算法从 `coords.ts` 的 `pointAlong` 提升，单测跟去）
- `packages/world` 的快照与三态裁剪
- `RendererAdapter.setActors` 与 Pixi `ActorLayer`（精灵与标签）
- scene version 2 与 `toSceneV2`；v1 的 `demo-scroll` 仍能打开
- 触发器：`entity:click`、`zone:enter`（主体为镜头中心）、`chapter:enter`
- `TimeService` 暂停
- 用真实 AABB 索引替换名不副实的 `FlatbushIndex`；现有热点点击结果保持
- 夹具里放 1 个沿路径移动的精灵。不要求正式美术

**不做：** 删除清明上河图 DOM。Phase 1 结束时允许两套并存。新夹具不准再用 DOM 角色。

**退出：**

- [10-core-runtime-v2.md](./10-core-runtime-v2.md) 的 W-U-01..06、W-I-01、W-I-02、W-D-01 有测试且绿
- 夹具精灵随缩放贴在世界上
- `qingming-riverside` 现有路径不回归（DOM 街市还在，直到 Phase 2）
- core 与 world 无画名、无 pixi import

**工作量：** L。渲染适配器、schema、模拟、命中要一起动，否则精灵没有数据来源。

## 4. Phase 2 — 玩法系统，并让街市离开 DOM

**做：**

- 插件 `crowd`、`vessel`
- `atmosphere:night` 只乘瓦片层；雨仍走 weather
- 有船的包使用 `water.composite = "pixi-underlay"`
- guide 在飞镜结束时发 `chapter:arrive`
- audio 接受由 zone 触发器发出的 play/stop（插件不读几何）
- 按 [40-migration-qingming.md](./40-migration-qingming.md) 迁茶市 / 虹桥 / 城门 / 渡船 / 过桥船体
- 删除世界 DOM 与 story 私有 rAF。HUD 留下

**不做：** 第二幅名画的正式素材；141 人。

**退出：**

- Q2-M-01..08 中能自动化的部分为绿；目视项有记录
- [20-gameplay-plugins-v2.md](./20-gameplay-plugins-v2.md) 的 G-U-01..05、G-I-01..02 为绿
- `street-life.ts` 不再创建 `.qingming-walker`
- 换包后上述世界 class 不在 document。堆内存仍可标待测

**工作量：** L。插件是其中一块，迁移与回归是另一块。

## 5. Phase 3 — 第二内容包（非街市）

**做：**

- `contents/shanshui-guide`：合成山水、章节、热点、雾、可选一条船
- 不启用 `crowd`
- story 为空，或只接一个章节事件
- README 与 license 写明不是名画扫描
- 画廊出现这张卡。viewer 已扫描 `contents/*/meta.json`，预期不用改应用；若要改，只限卡片文案

**不做：** 姑苏 / 南都 / 南巡的空目录；生图 API。

**退出：**

- 另一个人能按 [30-content-pack-v2.md](./30-content-pack-v2.md) 从模板做到可浏览
- 相对 Phase 2 结束时的 `packages/core` **零改动**。若必须改 core，记成 Phase 1/2 的漏洞并回去修，不在包里 fork
- 与清明上河图互切，满足 Q2-M-08 的 DOM 断言
- 作者工时目标 ≤ 5 个工作日（导览型）。做完后把实际天数写回 [00-overview.md](./00-overview.md)。做完前保持待测

**工作量：** M。前提是 crowd 真能关掉。若第二包仍要数百行 DOM，说明边界失败，工作量不再是 M。

## 6. Phase 4 — 作者打磨

**做：**

- 若 Phase 2 仍靠手写帧表，此阶段补 `tools/atlas-builder` 与 `content:atlas`
- validator：i18n 缺键警告、路径引用、spawn 上限
- 可选拾取器：把点到的世界坐标导出为 path / hotspot JSON。不要求撤销栈
- 把 5 日 / 8 日目标对照真实记录写回总览（8 日指插件就绪后的第二套街市向彩排，不是 Phase 3 的山水包）

**不做：** 完整关卡编辑器、生图、共享 WebGL 深度。

**退出：**

- 新包可以不手写帧 json；若手写格式仍支持，工具 README 写明
- 拾取器若做了：导出的点能通过 validator，并出现在所点的位置

**工作量：** M。

## 7. 依赖

```text
Phase 0 ──► Phase 1 ──► Phase 2 ──► Phase 3 ──► Phase 4
                 │                      ▲
                 └── 合成图可先切瓦片 ───┘   （不算 Phase 3 完成）
```

- vessel 依赖 Phase 1 的 follower 与 ActorLayer
- 夜色离开 DOM 依赖 ActorLayer，否则没有「瓦片层 / 角色层」可分
- Phase 3 依赖 crowd 可禁用

## 8. 和 v1 日历的关系

v1 `plan/01` 用了「1–2 天 / 1–1.5 周」，并假设 Phase 3 就有路径、遮挡与第二包。游戏向原语没有按那个日历落地。v2 不用同一套天数复述。在本文件内部：Phase 0 最小，Phase 1 与 Phase 2 最大。

## 9. 算作 v2.0 交付的条件

同时成立才算交付，文档写完不算：

1. 清明上河图的行人与船在 Pixi 世界里；茶市 / 虹桥 / 城门可见；夜色不再与 DOM 角色抢 z-index
2. 存在一个非街市包，且 core 无分叉
3. scene v1 仍可浏览
4. core 无 pixi/three、无画名
5. 性能数字要么有实测，要么继续标待测
