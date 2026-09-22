export type { SceneMeta, ViewportState, FlyToOptions } from "./contracts/viewport.ts";
export type { HitResult, HitRenderer } from "./contracts/hit.ts";
export type { AabbItem, AabbRect, SpatialQuery } from "./contracts/spatial.ts";
export type { TimeState } from "./contracts/time.ts";
export type { TriggerDef, TriggerWhen } from "./contracts/trigger.ts";
export type {
  ActorDef,
  ActorKind,
  ActorLabelDef,
  ActorSnapshot,
  DialogueStub,
  FollowMode,
  PathDef,
  SpawnDef,
  ArrivalNotice,
  LabelTrack,
  VesselSummonCommand,
  WorldLoadOptions,
  WorldScene,
  WorldSystem,
  ZoneDef,
  ZoneShape,
} from "./contracts/world.ts";
export type {
  EngineConfig,
  EngineCreateOptions,
  CachePolicy,
  SchedulerMode,
  QualityLevel,
  ContentResolver,
  ContentMeta,
  SceneDocument,
  SceneEntity,
  HotspotEntity,
  VisibleTile,
  RendererAdapter,
  RendererFactories,
  ThreeOverlayHost,
  TileGrade,
  UnderlayBand,
  ScrollEnginePublic,
  StoryModule,
  SchedulerLike,
  EventBusLike,
} from "./contracts/engine.ts";
export { DEFAULT_CACHE_POLICY } from "./contracts/engine.ts";
export type { ScrollPlugin, EngineContext, PluginFactory } from "./contracts/plugin.ts";

export { ScrollEngine } from "./Engine.ts";
export type { EngineServices } from "./contracts/engine.ts";
export { EventBus } from "./EventBus.ts";
export { PluginHost } from "./PluginHost.ts";
export { ViewportController } from "./viewport/ViewportController.ts";
export { InputManager } from "./input/InputManager.ts";
export { GestureState, DRAG_THRESHOLD_PX } from "./input/GestureState.ts";
export { RenderScheduler } from "./scheduler/RenderScheduler.ts";
export { TimeService } from "./time/TimeService.ts";
export { TriggerRuntime } from "./triggers/TriggerRuntime.ts";
export type { TriggerSample } from "./triggers/TriggerRuntime.ts";
