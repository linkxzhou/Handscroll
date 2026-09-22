# ADR 0004 — 场景 schema 版本与迁移

- Status: accepted for v2（Phase 0 起加载器接受 version 1 与 2、拒绝 ≥3；元素形状与 `toSceneV2` 仍待 Phase 1。决策未改）
- Date: 2026-09-22
- 关系：v1 形状即 `packages/scene/src/schema.ts` 的 `version: z.literal(1)`。

## 背景

已发布的内容是 version 1：`demo-scroll`、`qingming-riverside`、`_template`。字段是 meta、background、entities（sprite / animation / hotspot / model3d）、chapters。

v2 需要 paths、actors、zones、spawns、dialogues、triggers。若直接把 literal 改成 2 并要求新字段，现有包会校验失败。若只往 version 1 上无限加可选字段，就没有「拒绝未知主版本」的边界。

## 决定

1. **version 1 永久可加载**（浏览路径：瓦片、热点、章节；未被渲染器使用的旧 sprite 字段也不报错）。
2. **version 2 是超集。** `version: 2` 加上六个数组；缺省 `[]`。v1 的 `entities` 在 v2 中仍然合法。
3. 运行时用纯函数 `toSceneV2` 把 version 1 补成空数组后的 version 2，使模拟只有一条路径。该函数不读 story、不发明行人。
4. **version ≥ 3 拒绝**，错误信息指出版本号。不降级猜测。
5. 同一主版本内只允许可选的向后兼容字段。必填字段或语义变化（例如改变 hotspot 坐标系）必须升主版本并写迁移函数。
6. 内容迁移（把 `coords.ts` 抄进 `paths`）与 schema 迁移分开。前者是包的改动，后者是加载器。

未知的 entity `type` 继续失败，与现 `schema.test.ts` 一致。

## 理由

- 仓库里已经有 version 1 文件。打断它们会把规划变成强制全库改写。
- 超集比并行两套运行时便宜：热点代码可以留在 `entities`。
- 主版本拒绝未知值，避免以后的数据被静默丢字段。

## 后果

- `SceneDocument.version` 的类型变为 `1 | 2`。经 `toSceneV2` 之后，世界系统只见 `2`。
- scaffold 工具改产 version 2。旧包不必为了脚手架而手改，直到该包要 actor。
- 测试夹具至少保留一份 version 1（`demo-scroll` 或等效 fixture）和一份 version 2。
- 六个新数组的坐标与 `meta` 宽高做交叉校验，规则同热点越界。
- version 2 不做对话分支、背包、时间线编辑器数据。对话只是 `id + lineKeys` 桩。需要分支时升 version 3。
