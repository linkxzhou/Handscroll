export interface TimeState {
  /** Simulation step for this frame. Zero while paused. */
  gameDt: number;
  /** Unpaused, unscaled frame interval. The scheduler has already clamped it. */
  wallDt: number;
  paused: boolean;
  /** 1 is normal speed. Affects gameDt only. */
  scale: number;
  /**
   * 0–1 time of day. The engine does not advance this.
   * null means the pack does not use it.
   */
  timeOfDay: number | null;
}

export interface TimeService {
  getState(): TimeState;
  gameDt(wallDt: number): number;
  setPaused(paused: boolean): void;
  setScale(scale: number): void;
  setTimeOfDay(value: number | null): void;
}
