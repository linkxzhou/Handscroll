import type { EngineContext, PluginFactory, ScrollPlugin } from "@handscroll/core";

interface AudioConfig {
  defaultMuted?: boolean;
}

export type AmbientKind = "rain" | "water" | "none";

interface PlayPayload {
  id?: string;
  kind?: AmbientKind;
}

const nodes = () => new Map<string, { stop: () => void }>();

export const createAudioPlugin: PluginFactory = (raw): ScrollPlugin => {
  const config = (raw ?? {}) as AudioConfig;
  let muted = config.defaultMuted !== false;
  let unlocked = false;
  let audioCtx: AudioContext | null = null;
  let ctx: EngineContext | null = null;
  const playing = nodes();
  const wanted = new Map<string, AmbientKind>();
  const offs: Array<() => void> = [];

  const unlock = (): void => {
    unlocked = true;
    void audioCtx?.resume();
    if (!muted) startWanted();
  };

  const ensureContext = (): AudioContext | null => {
    if (!unlocked || muted) return null;
    if (typeof AudioContext === "undefined") return null;
    audioCtx ??= new AudioContext();
    return audioCtx;
  };

  const stopId = (id: string): void => {
    playing.get(id)?.stop();
    playing.delete(id);
  };

  const startKind = (id: string, kind: AmbientKind): void => {
    stopId(id);
    if (kind === "none") return;
    const ac = ensureContext();
    if (!ac) return;
    const handle = kind === "rain" ? startNoise(ac, { hp: 800, lp: 4200, gain: 0.04 }) : startNoise(ac, { hp: 80, lp: 480, gain: 0.03 });
    if (handle) playing.set(id, handle);
  };

  const startWanted = (): void => {
    if (muted || !unlocked) return;
    for (const [id, kind] of wanted) startKind(id, kind);
  };

  const stopAll = (): void => {
    for (const id of [...playing.keys()]) stopId(id);
  };

  return {
    id: "audio",
    priority: 20,
    onRegister(next) {
      ctx = next;
      const container = next.engine.getContainer();
      const onPointer = () => unlock();
      if (container && typeof container.addEventListener === "function") {
        container.addEventListener("pointerdown", onPointer, { once: true });
        offs.push(() => container.removeEventListener("pointerdown", onPointer));
      }
      const onVis = (): void => {
        if (typeof document !== "undefined" && document.visibilityState === "hidden") {
          muted = true;
          stopAll();
        }
      };
      if (typeof document !== "undefined") {
        document.addEventListener("visibilitychange", onVis);
        offs.push(() => document.removeEventListener("visibilitychange", onVis));
      }
      offs.push(
        next.engine.events.on("audio:play", (payload) => {
          const parsed = parsePlay(payload);
          if (!parsed) return;
          wanted.set(parsed.id, parsed.kind);
          startKind(parsed.id, parsed.kind);
        }),
      );
      offs.push(
        next.engine.events.on("audio:stop", (payload) => {
          const id = parseId(payload);
          if (!id) return;
          wanted.delete(id);
          stopId(id);
        }),
      );
      offs.push(
        next.engine.events.on("audio:setMuted", (payload) => {
          muted = parseMuted(payload, muted);
          if (muted) stopAll();
          else startWanted();
          ctx?.engine.events.emit("audio:change", { muted });
        }),
      );
    },
    onSceneUnload() {
      stopAll();
      wanted.clear();
    },
    onDestroy() {
      stopAll();
      wanted.clear();
      for (const off of offs) off();
      offs.length = 0;
      void audioCtx?.close();
      audioCtx = null;
      ctx = null;
    },
  };
};

export function isDefaultMuted(config: AudioConfig | undefined): boolean {
  return config?.defaultMuted !== false;
}

function parseId(payload: unknown): string | null {
  if (typeof payload === "string") return payload;
  if (payload && typeof payload === "object" && "id" in payload && typeof (payload as { id: unknown }).id === "string") {
    return (payload as { id: string }).id;
  }
  return null;
}

function parsePlay(payload: unknown): { id: string; kind: AmbientKind } | null {
  if (!payload || typeof payload !== "object") return null;
  const id = parseId(payload);
  if (!id) return null;
  const kind = (payload as PlayPayload).kind ?? "none";
  if (kind !== "rain" && kind !== "water" && kind !== "none") return null;
  return { id, kind };
}

function parseMuted(payload: unknown, fallback: boolean): boolean {
  if (typeof payload === "boolean") return payload;
  if (payload && typeof payload === "object" && "muted" in payload) {
    return Boolean((payload as { muted: unknown }).muted);
  }
  return fallback;
}

function startNoise(
  ac: AudioContext,
  opts: { hp: number; lp: number; gain: number },
): { stop: () => void } | null {
  try {
    const buffer = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const hp = ac.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = opts.hp;
    const lp = ac.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = opts.lp;
    const gain = ac.createGain();
    gain.gain.value = opts.gain;
    src.connect(hp);
    hp.connect(lp);
    lp.connect(gain);
    gain.connect(ac.destination);
    src.start();
    return {
      stop() {
        try {
          src.stop();
        } catch {
          /* already stopped */
        }
        src.disconnect();
        hp.disconnect();
        lp.disconnect();
        gain.disconnect();
      },
    };
  } catch {
    return null;
  }
}
