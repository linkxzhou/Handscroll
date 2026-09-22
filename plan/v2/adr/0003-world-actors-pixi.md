# ADR 0003 — 世界角色用 Pixi，DOM 只做 HUD

- Status: accepted for v2（Phase 1 已落地 `ActorSnapshot` 与 Pixi `ActorLayer`。夜色只乘瓦片、水面 underlay 仍待 Phase 2）
- Date: 2026-09-22
- 关系：扩展 [0001](../../adr/0001-renderer-topology.md)。0001 仍决定双 Canvas。本 ADR 决定什么东西允许出现在 `.ui-layer`。

## 背景

v1 把瓦片放在 Pixi，把行人、船、店铺标签、热点图钉、桥洞遮挡放在 DOM（`contents/qingming-riverside/story/`）。夜色是 ui-layer 里的全屏乘色（z-index 6），行人为了不被盖住升到 z-index 7，天气雨幕也是 7。缩放时 story 自己把世界尺寸乘上 `zoom` 写成 CSS 像素。

结果是：角色不属于场景图，每幅新画都要复制一套 overlay；夜色与角色的上下关系靠样式表而不是图层。

备选：

| 方案 | 说明 |
|---|---|
| A. 继续 DOM 世界角色 | 与 v1 相同。实现快，不能作为多画卷的角色系统 |
| B. Pixi 世界角色，DOM 仅 HUD | 角色挂在现有 world root 上，继承镜头变换 |
| C. 全部画进 Three | 与「Pixi 为主、Three 按需」冲突，且没有 3D 的画也被绑到第二上下文 |

## 决定

**选 B。**

世界角色（人、船、车、世界标签、世界标记、前景遮挡条）由 `renderer-pixi` 的角色层绘制。core 与 world 包只传递 `ActorSnapshot` 纯数据，不 import pixi。

DOM `.ui-layer` 只放 HUD：章节轨、解说面板、任务按钮、暂停、音量、屏幕空间的雨雪雾。

禁止新代码为世界物体每帧写 `style.left` / `style.top`。v1 清明上河图 DOM 在迁移完成前算遗留，见 [40-migration-qingming.md](../40-migration-qingming.md)，不作为新包的范本。

## 理由

1. Pixi world root 已经按视口做了 `scale` 与 `position`（`PixiRenderer.sync`）。角色若是它的子节点，就不用第二套 `worldToScreen`。
2. 裁剪可以让节点不可绘制，而不是把仍在文档里的 div 设为 `hidden`。
3. 夜色可以只乘在瓦片容器上，角色层保持可读，从而去掉 z-index 对抗。
4. 方案 C 会把「没有 3D 的画」也绑到 Three。ADR 0001 的 lazy 边界应保留。

## 后果

- `RendererAdapter` 增加可选 `setActors`。旧测试替身可以不实现。
- 空间索引选定均匀网格（256 世界像素一格，`SpatialIndex`），不引入 rbush / flatbush。点击仍走世界坐标，不打开 Pixi `eventMode`。
- 命中仍走世界坐标拾取，不打开 Pixi `eventMode` 作为第二套点击。
- 标签用渲染器文本，缩小时可能糊。是否改位图字体待测后再定。
- Three 画布仍盖在整个 Pixi 之上。河上的船若要用本 ADR，水面不能无条件用全幅 Three 覆盖。该冲突由 [0005](./0005-occlusion-and-water-composite.md) 解决。默认答案不是把船退回 DOM。
- 跟随世界坐标的 DOM 节点在 review 里算缺陷。
