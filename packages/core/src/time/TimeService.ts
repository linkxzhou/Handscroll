import type { TimeService as TimeServiceContract, TimeState } from "../contracts/time.ts";
import type { EventBus } from "../EventBus.ts";

/**
 * Wall-clock frames stay on the scheduler.
 * This service only turns them into a simulation step.
 * While paused, gameDt is 0 — paused frames are not stored and replayed later.
 */
export class TimeService implements TimeServiceContract {
  private paused = false;
  private scale = 1;
  private timeOfDay: number | null = null;
  private state: TimeState = {
    gameDt: 0,
    wallDt: 0,
    paused: false,
    scale: 1,
    timeOfDay: null,
  };

  constructor(private readonly events: EventBus) {}

  getState(): TimeState {
    return this.state;
  }

  gameDt(wallDt: number): number {
    if (this.paused) return 0;
    return wallDt * this.scale;
  }

  beginFrame(wallDt: number): TimeState {
    this.state = {
      gameDt: this.gameDt(wallDt),
      wallDt,
      paused: this.paused,
      scale: this.scale,
      timeOfDay: this.timeOfDay,
    };
    return this.state;
  }

  setPaused(paused: boolean): void {
    if (this.paused === paused) return;
    this.paused = paused;
    this.state = { ...this.state, paused };
    this.events.emit(paused ? "time:pause" : "time:resume");
  }

  setScale(scale: number): void {
    this.scale = scale;
    this.state = { ...this.state, scale };
  }

  setTimeOfDay(value: number | null): void {
    if (this.timeOfDay === value) return;
    this.timeOfDay = value;
    this.state = { ...this.state, timeOfDay: value };
    this.events.emit("time:ofday", value);
  }
}
