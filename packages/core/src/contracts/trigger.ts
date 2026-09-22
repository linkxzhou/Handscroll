export type TriggerWhen =
  | { type: "zone:enter"; zoneId: string; subject: "camera" | "actor"; actorId?: string }
  | { type: "zone:exit"; zoneId: string; subject: "camera" | "actor"; actorId?: string }
  | { type: "entity:click"; entityId: string }
  | { type: "chapter:enter"; chapterId: string }
  | { type: "custom"; event: string };

export interface TriggerDef {
  id: string;
  when: TriggerWhen;
  /** Bus event name. Core does not interpret the business meaning. */
  emit: string;
  once?: boolean;
  payload?: unknown;
}
