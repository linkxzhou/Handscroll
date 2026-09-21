import { describe, expect, it } from "vitest";
import { ByteLru } from "./ByteLru.ts";
import { PriorityQueue } from "./PriorityQueue.ts";

describe("ByteLru E-U-09", () => {
  it("evicts unpinned LRU entries and keeps pinned tiles", () => {
    const lru = new ByteLru<string>(10);
    lru.set("a", "A", 4, false);
    lru.set("b", "B", 4, true);
    lru.set("c", "C", 4, false);
    expect(lru.has("b")).toBe(true);
    expect(lru.has("a")).toBe(false);
    expect(lru.get("b")).toBe("B");
  });

  it("does not evict pinned entries even when over budget", () => {
    const lru = new ByteLru<string>(4);
    lru.set("a", "A", 4, true);
    lru.set("b", "B", 4, true);
    expect(lru.has("a")).toBe(true);
    expect(lru.has("b")).toBe(true);
    expect(lru.bytes).toBe(8);
  });
});

describe("PriorityQueue", () => {
  it("pops lower priority numbers first", () => {
    const q = new PriorityQueue<string>();
    q.push({ key: "p2", priority: 2, value: "edge" });
    q.push({ key: "p0", priority: 0, value: "visible" });
    q.push({ key: "p1", priority: 1, value: "actor" });
    expect(q.pop()?.value).toBe("visible");
    expect(q.pop()?.value).toBe("actor");
    expect(q.pop()?.value).toBe("edge");
  });
});
