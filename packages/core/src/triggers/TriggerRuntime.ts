import type { EventBus } from "../EventBus.ts";
import type { TriggerDef, TriggerWhen } from "../contracts/trigger.ts";
import type { ZoneDef } from "../contracts/world.ts";
import { pointInZone } from "./zone.ts";

export interface TriggerSample {
  cameraX: number;
  cameraY: number;
  zones: readonly ZoneDef[];
  actorPosition(id: string): { x: number; y: number } | null;
}

/**
 * Declarative triggers. The first sample only records inside/outside;
 * a zone event fires on a later crossing, not because the camera loaded inside.
 */
export class TriggerRuntime {
  private triggers: TriggerDef[] = [];
  private readonly onceFired = new Set<string>();
  private readonly inside = new Map<string, boolean>();
  private unsubs: Array<() => void> = [];

  constructor(private readonly events: EventBus) {}

  load(triggers: readonly TriggerDef[]): void {
    this.reset();
    this.triggers = [...triggers];
    for (const trigger of this.triggers) {
      if (trigger.when.type !== "custom") continue;
      const name = trigger.when.event;
      this.unsubs.push(this.events.on(name, () => this.fire(trigger)));
    }
  }

  /** Drop once-latches and zone memory. Called on pack switch. */
  reset(): void {
    for (const off of this.unsubs) off();
    this.unsubs = [];
    this.onceFired.clear();
    this.inside.clear();
    this.triggers = [];
  }

  update(sample: TriggerSample): void {
    for (const trigger of this.triggers) {
      const when = trigger.when;
      if (when.type !== "zone:enter" && when.type !== "zone:exit") continue;
      const zone = sample.zones.find((item) => item.id === when.zoneId);
      const point = zone ? this.subjectPoint(when, sample) : null;
      if (!zone || !point) continue;
      const now = pointInZone(point.x, point.y, zone);
      const key = insideKey(trigger);
      const was = this.inside.get(key);
      this.inside.set(key, now);
      if (was === undefined) continue;
      if (when.type === "zone:enter" && !was && now) this.fire(trigger);
      if (when.type === "zone:exit" && was && !now) this.fire(trigger);
    }
  }

  onEntityClick(payload: unknown): void {
    const entityId = readId(payload, "entityId");
    if (!entityId) return;
    for (const trigger of this.triggers) {
      if (trigger.when.type === "entity:click" && trigger.when.entityId === entityId) this.fire(trigger);
    }
  }

  onChapterArrive(payload: unknown): void {
    const id = readId(payload, "id");
    if (!id) return;
    if (payload && typeof payload === "object" && "completed" in payload && (payload as { completed?: unknown }).completed === false) {
      return;
    }
    for (const trigger of this.triggers) {
      if (trigger.when.type === "chapter:enter" && trigger.when.chapterId === id) this.fire(trigger);
    }
  }

  private subjectPoint(when: Extract<TriggerWhen, { type: "zone:enter" | "zone:exit" }>, sample: TriggerSample) {
    if (when.subject === "camera") return { x: sample.cameraX, y: sample.cameraY };
    if (!when.actorId) return null;
    return sample.actorPosition(when.actorId);
  }

  private fire(trigger: TriggerDef): void {
    if (this.onceFired.has(trigger.id)) return;
    if (trigger.once) this.onceFired.add(trigger.id);
    this.events.emit(trigger.emit, trigger.payload);
  }
}

function insideKey(trigger: TriggerDef): string {
  const when = trigger.when;
  if (when.type === "zone:enter" || when.type === "zone:exit") {
    return `${trigger.id}:${when.subject}:${when.actorId ?? ""}`;
  }
  return trigger.id;
}

function readId(payload: unknown, key: string): string {
  if (!payload || typeof payload !== "object" || !(key in payload)) return "";
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}
