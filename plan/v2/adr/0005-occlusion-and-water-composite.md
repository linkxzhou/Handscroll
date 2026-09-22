# ADR 0005 — 遮挡与水面合成

- Status: accepted for v2（规划）
- Date: 2026-09-22
- 关系：不推翻 [0001](../../adr/0001-renderer-topology.md) 的双 Canvas，也不推翻 [0002](../../adr/0002-water-effect.md) 的「水面可以是 lazy Three」。  
  取代 0002 后果里的这一句：河上的船优先用 DOM，以免被 Three 盖住。船改由 [0003](./0003-world-actors-pixi.md) 规定为 Pixi 角色。

## 背景

两件不同的「谁挡谁」被 v1 用 DOM 混在一起：

1. **桥洞。** 货船应在拱下短暂被桥面挡住。实现是 `.qingming-bridge-occluder` 渐变条（`bridge.ts` 注释写明假遮挡）。
2. **河面。** Three 画布整层盖在 Pixi 上。0002 因此让船留在 DOM（ui-layer 比两块 canvas 都高）。v2 若把船放进 Pixi，船体（本包约 y=556，高约 64）会落在水带（y=520，高 204）里并被 Three 盖住。

共享 WebGL、按像素的深度交错仍然不做（0001）。

## 决定

### 遮挡

用 Pixi 图层顺序加可选前景精灵。不用真深度，也不再用 DOM 条。

- 角色带 `zIndex`
- 桥面遮挡是一个 `kind: "occluder"` 的 actor（或普通 sprite），zIndex 高于船体，形状来自包内图片或矩形
- 任务需要「进洞才挡住」时，由 story 切换该 occluder 的可见性或透明度，或由路径上的 `ScalarTrack` 驱动透明度
- 不做：2D/3D 像素交错；不在 v2 为桥拱做 stencil。若以后要 stencil，另开 ADR

这与 v1 一样是假遮挡，只是假在场景图里，可以随镜头变换，第二幅画也可以复用成「前景树挡人」。

### 水面

`pluginConfig.water.composite`：

| 值 | 行为 |
|---|---|
| `three-overlay` | 0002 的现状。默认。适合没有 Pixi 船体要压在水上的包 |
| `pixi-underlay` | 河带绘制在瓦片层之上、角色层之下。不把半透明 Three 盖住船体 |

有 vessel actor 且其包围盒与水带相交的包，使用 `pixi-underlay`。`qingming-riverside` 属于这一类。

`pixi-underlay` 的第一版允许是半透明精灵或简单流动。观感不必第一天等于现有 Three 着色器。若观感回退，记缺陷并迭代绘制，禁止把船搬回 DOM。

Three 水面代码保留，给 `three-overlay` 以及 `model3d` 的懒加载。`ensureThree()` 的契约不变。

绘制落点：underlay 由 `renderer-pixi` 执行。water 插件继续只发 `water:set` 与水带矩形，避免插件 import pixi。这与「core 不 import pixi」同一方向：插件也不握有 Pixi 类型。

## 理由

- 0001 已经说复杂交错就改到单一渲染器，而不是再叠一种合成。船与水都在 Pixi 里，是在这条后果之内把重叠内容收回主渲染器。
- 桥洞的产品要求是看起来钻进拱，不是物理深度。前景条足够，且和树、门洞是同一种 actor。
- 保留 Three 模式，没有船的包不必损失现有水面。

## 后果

- 0002 除「DOM 船」一句外仍然有效。无 Three 时的 DOM 水纹 fallback 可以留在 HUD 层（它是效果，不是船体），且不得挡住按钮。
- 换包时 underlay 与 Three 物体都要卸，与现 water 的 `onDestroy` 同一清单。
- 拱的轮廓若只有矩形，会比现在的 `clip-path` 多边形更粗。要多边形就用包内的图，不在引擎里写虹桥轮廓点。
- 一条 6516×204 的半透明是否超预算，待测。超了就改成视口内的一小段，仍放在角色层下面。
