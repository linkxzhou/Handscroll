export class EventBus {
  private readonly listeners = new Map<string, Set<(payload: unknown) => void>>();

  on(event: string, handler: (...args: unknown[]) => void): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    const wrapped = handler as (payload: unknown) => void;
    set.add(wrapped);
    return () => this.off(event, handler);
  }

  off(event: string, handler: (...args: unknown[]) => void): void {
    const set = this.listeners.get(event);
    if (!set) return;
    set.delete(handler as (payload: unknown) => void);
    if (set.size === 0) this.listeners.delete(event);
  }

  emit(event: string, payload?: unknown): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const handler of [...set]) {
      handler(payload);
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}
