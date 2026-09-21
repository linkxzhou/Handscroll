import { describe, expect, it } from "vitest";
import { isUiPointerTarget } from "./uiTarget.ts";

describe("isUiPointerTarget", () => {
  it("ignores camera gestures that start on a button", () => {
    const target = {
      closest: (selector: string) => (selector.includes("button") ? {} : null),
    };
    expect(isUiPointerTarget(target as unknown as EventTarget)).toBe(true);
  });

  it("allows gestures on the canvas / empty target", () => {
    const canvas = { closest: () => null };
    expect(isUiPointerTarget(canvas as unknown as EventTarget)).toBe(false);
    expect(isUiPointerTarget(null)).toBe(false);
  });
});
