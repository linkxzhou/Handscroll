export type Priority = 0 | 1 | 2 | 3 | 4;

export interface PriorityItem<T> {
  key: string;
  priority: Priority;
  value: T;
}

export class PriorityQueue<T> {
  private readonly items: PriorityItem<T>[] = [];

  push(item: PriorityItem<T>): void {
    this.items.push(item);
    this.items.sort((a, b) => a.priority - b.priority || a.key.localeCompare(b.key));
  }

  pop(): PriorityItem<T> | undefined {
    return this.items.shift();
  }

  peek(): PriorityItem<T> | undefined {
    return this.items[0];
  }

  get length(): number {
    return this.items.length;
  }

  clear(): void {
    this.items.length = 0;
  }
}
