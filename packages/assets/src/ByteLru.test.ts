import { describe, expect, it } from "vitest";
import { ByteLru } from "./ByteLru.ts";

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
});
