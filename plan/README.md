# Handscroll 计划文档

> **v2.0 是当前有效的优化计划**（画卷游戏引擎，面向多幅中国古典长卷）。  
> **v1 文档保留为基线**，标记：**v1 baseline（shipped 2026-09）**。不要删除 v1；实现 v2 时以 `plan/v2/` 为准，v1 只解释「当时为什么这样建、实际落到了哪」。

## 现在读哪份

| 状态 | 路径 | 用途 |
|---|---|---|
| **有效** | [v2/00-overview.md](./v2/00-overview.md) | v2.0 产品定位、与 v1 的取舍、非目标、成功标准 |
| **有效** | [v2/01-gap-analysis-v1.md](./v2/01-gap-analysis-v1.md) | v1 计划 vs 仓库现状 vs 痛点 |
| **有效** | [v2/10-core-runtime-v2.md](./v2/10-core-runtime-v2.md) | 世界实体、裁剪、时间、触发器、路径、scene v2 |
| **有效** | [v2/20-gameplay-plugins-v2.md](./v2/20-gameplay-plugins-v2.md) | crowd / vessel / atmosphere / guide / audio zones |
| **有效** | [v2/30-content-pack-v2.md](./v2/30-content-pack-v2.md) | 多画卷内容包、作者流、第二包、授权 |
| **有效** | [v2/40-migration-qingming.md](./v2/40-migration-qingming.md) | 清明上河图式街市卷如何迁到 v2，而不是继续定义引擎 |
| **有效** | [v2/50-roadmap.md](./v2/50-roadmap.md) | 阶段与退出条件（相对工作量 S/M/L）；顶部有实施状态 |
| **有效** | [v2/60-frozen-v1-api.md](./v2/60-frozen-v1-api.md) | Phase 0 冻结的迁移安全 API 与 scene 版本门 |
| **有效** | [v2/adr/](./v2/adr/) | v2 决策：世界角色用 Pixi、schema 版本、遮挡与水面合成 |

## v1 baseline（shipped 2026-09）

这些文件描述已经落地的浏览引擎与第一个内容包。它们**不是** v2 的施工图。

| 文件 | 当时的角色 |
|---|---|
| [01-engine-implementation.md](./01-engine-implementation.md) | 总计划：多画卷、三层、工作流 |
| [10-core-engine.md](./10-core-engine.md) | 核心运行时（视口、瓦片、双 Canvas） |
| [20-plugin-layer.md](./20-plugin-layer.md) | 插件契约与 quality / guide / audio / weather / water |
| [30-business-layer.md](./30-business-layer.md) | Content pack、scene v1、story |
| [40-qingming-riverside-app.md](./40-qingming-riverside-app.md) | 第一个真实内容包的应用计划 |
| [adr/0001-renderer-topology.md](./adr/0001-renderer-topology.md) | 双 Canvas，v2 仍遵守 |
| [adr/0002-water-effect.md](./adr/0002-water-effect.md) | lazy Three 水面；v2 对「船必须用 DOM」的推论见 [v2/adr/0005](./v2/adr/0005-occlusion-and-water-composite.md) |

v1 索引里点名但仓库中**不存在**的文档：`plan/02-content-workflow.md`、`plan/03-reference-audit.md`、`plan/phase1-metrics.md`。作者短手册的一部分写进了 `contents/README.md`；参考审计写进了 `plan/40`。v2 不补写这些 v1 空位，避免两套「当前计划」。

## 一句话

v1 证明了「长卷能被切块、缩放、热点点开、插件开关」。v2 要证明的是：**同一套游戏向运行时可以换一幅画，而人群、船、路径、触发器不用在 story 里用 DOM 重写一遍。**
