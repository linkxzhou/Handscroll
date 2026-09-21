# Water plugin

This built-in plugin is a **stub** until `plan/adr/0002-water-effect.md` is decided.

Candidates:

- **A.** Three.js transparent overlay (depends on `renderer-three`, loaded lazily)
- **B.** PixiJS filter / custom shader on the 2D world root

Default `meta.plugins` must **not** include `water` until that ADR lands. The registry still accepts the id so content packs can experiment without crashing.
