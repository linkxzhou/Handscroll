import { describe, expect, it } from "vitest";
import { formatViewportHud, isQuality, parseScrollId } from "./query.ts";

describe("playground query helpers", () => {
  it("defaults the scroll id and reads ?scroll=", () => {
    expect(parseScrollId("")).toBe("demo-scroll");
    expect(parseScrollId("?scroll=gusu-fanhua")).toBe("gusu-fanhua");
    expect(parseScrollId("scroll=other&x=1")).toBe("other");
  });

  it("accepts only known quality levels", () => {
    expect(isQuality("low")).toBe(true);
    expect(isQuality("auto")).toBe(true);
    expect(isQuality("ultra")).toBe(false);
  });

  it("formats the HUD camera readout", () => {
    expect(formatViewportHud({ zoom: 0.55, centerX: 1163.6, centerY: 512 })).toBe("z 0.55 · (1164, 512)");
  });
});
