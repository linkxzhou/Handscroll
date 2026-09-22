import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { EventBus } from "@handscroll/core";
import type { EngineContext, TileGrade } from "@handscroll/core";
import { createAtmospherePlugin, sampleGradient } from "./AtmospherePlugin.ts";

describe("atmosphere plugin", () => {
  it("grades tiles and does not create a fullscreen night node (G-U-04)", async () => {
    const events = new EventBus();
    const grades: TileGrade[] = [];
    const ui = { children: [] as unknown[], appendChild(node: unknown) { this.children.push(node); return node; } };
    const ctx: EngineContext = {
      engine: {
        events,
        camera: { getState: () => ({ centerX: 0, centerY: 0, zoom: 1, screenWidth: 1, screenHeight: 1 }), flyTo: () => {}, interruptTransition: () => {} },
        scheduler: { requestFrame: () => {}, wake: () => {}, requestContinuous: () => {}, releaseContinuous: () => {} },
        getViewport: () => ({ centerX: 0, centerY: 0, zoom: 1, screenWidth: 1, screenHeight: 1 }),
        setQuality: () => {},
        getQuality: () => "auto",
        getCachePolicy: () => ({ gpuBudgetBytes: 1, decodedBudgetBytes: 1, maxConcurrentRequests: 1, maxUploadsPerFrame: 1 }),
        setCachePolicy: () => {},
        getContainer: () => ({}) as HTMLElement,
        getUiLayer: () => ui as unknown as HTMLElement,
        getDpr: () => 1,
        getScrollId: () => null,
        ensureThree: async () => null,
        setTileGrade(grade) {
          grades.push(grade);
        },
      },
      scene: null,
      quality: "auto",
    };
    const plugin = createAtmospherePlugin({ gradeActors: false, nightDarkness: 0.55 });
    await plugin.onRegister?.(ctx);
    events.emit("atmosphere:night", { enabled: true });
    expect(grades.at(-1)).toEqual({ darkness: 0.55, gradeActors: false });
    expect(ui.children).toEqual([]);
    events.emit("atmosphere:grade", { darkness: 0.2 });
    expect(grades.at(-1)?.darkness).toBeCloseTo(0.2);
    expect(grades.at(-1)?.gradeActors).toBe(false);
    events.emit("atmosphere:night", { enabled: false });
    expect(grades.at(-1)?.darkness).toBe(0);
    await plugin.onSceneUnload?.();
    expect(grades.at(-1)?.darkness).toBe(0);
  });

  it("maps time of day through a configured gradient", async () => {
    const events = new EventBus();
    const grades: number[] = [];
    const ctx: EngineContext = {
      engine: {
        events,
        camera: { getState: () => ({ centerX: 0, centerY: 0, zoom: 1, screenWidth: 1, screenHeight: 1 }), flyTo: () => {}, interruptTransition: () => {} },
        scheduler: { requestFrame: () => {}, wake: () => {}, requestContinuous: () => {}, releaseContinuous: () => {} },
        getViewport: () => ({ centerX: 0, centerY: 0, zoom: 1, screenWidth: 1, screenHeight: 1 }),
        setQuality: () => {},
        getQuality: () => "auto",
        getCachePolicy: () => ({ gpuBudgetBytes: 1, decodedBudgetBytes: 1, maxConcurrentRequests: 1, maxUploadsPerFrame: 1 }),
        setCachePolicy: () => {},
        getContainer: () => ({}) as HTMLElement,
        getUiLayer: () => ({}) as HTMLElement,
        getDpr: () => 1,
        getScrollId: () => null,
        ensureThree: async () => null,
        setTileGrade(grade) {
          grades.push(grade.darkness);
        },
      },
      scene: null,
      quality: "auto",
    };
    const plugin = createAtmospherePlugin({
      gradient: [
        { t: 0, darkness: 0.8 },
        { t: 1, darkness: 0 },
      ],
    });
    await plugin.onRegister?.(ctx);
    events.emit("time:ofday", 0.25);
    expect(grades.at(-1)).toBeCloseTo(0.6);
    expect(sampleGradient([{ t: 0, darkness: 0 }, { t: 1, darkness: 1 }], 0.5)).toBeCloseTo(0.5);
  });

  it("keeps painting names out of plugin sources (G-U-05)", () => {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
    const hits: string[] = [];
    const banned = new RegExp(`${"qing"}${"ming"}|${String.fromCodePoint(0x8679, 0x6865)}|${"tea"}${"house"}`, "i");
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) {
          if (banned.test(fs.readFileSync(full, "utf8"))) hits.push(path.relative(root, full));
        }
      }
    };
    walk(root);
    expect(hits).toEqual([]);
  });
});
