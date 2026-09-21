/** Generic animation clock. Story-specific timelines live in content packs. */
export class AnimationRuntime {
  private time = 0;

  update(dt: number): void {
    this.time += dt;
  }

  getTime(): number {
    return this.time;
  }

  clear(): void {
    this.time = 0;
  }
}
