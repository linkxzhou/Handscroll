import { Container, Sprite, Text, Texture } from "pixi.js";
import type { ActorSnapshot } from "@handscroll/core";

interface ActorNode {
  root: Container;
  sprite: Sprite | null;
  label: Text | null;
  imageUrl?: string;
}

/**
 * Sprites and optional labels live under the world root, so they inherit zoom and pan.
 * Positions are world coordinates. Hidden actors are not given a new texture.
 */
export class ActorLayer {
  readonly container: Container;
  private readonly nodes = new Map<string, ActorNode>();

  constructor(parent: Container) {
    this.container = new Container();
    this.container.label = "actor-layer";
    this.container.eventMode = "none";
    this.container.sortableChildren = true;
    parent.addChild(this.container);
  }

  setActors(actors: readonly ActorSnapshot[]): void {
    const seen = new Set<string>();
    for (const actor of actors) {
      seen.add(actor.id);
      let node = this.nodes.get(actor.id);
      if (!node) {
        node = this.createNode(actor);
        this.nodes.set(actor.id, node);
        this.container.addChild(node.root);
      }
      this.apply(node, actor);
    }
    for (const [id, node] of this.nodes) {
      if (seen.has(id)) continue;
      this.container.removeChild(node.root);
      destroyNode(node);
      this.nodes.delete(id);
    }
  }

  clear(): void {
    this.setActors([]);
  }

  private createNode(actor: ActorSnapshot): ActorNode {
    const root = new Container();
    root.eventMode = "none";
    root.label = actor.id;
    let sprite: Sprite | null = null;
    if (actor.kind !== "label") {
      sprite = new Sprite(Texture.WHITE);
      sprite.eventMode = "none";
      root.addChild(sprite);
    }
    return { root, sprite, label: null };
  }

  private apply(node: ActorNode, actor: ActorSnapshot): void {
    node.root.position.set(actor.x, actor.y);
    node.root.zIndex = actor.zIndex;
    node.root.visible = actor.visible;
    node.root.renderable = actor.visible;
    node.root.alpha = actor.alpha ?? 1;

    if (node.sprite) {
      node.sprite.anchor.set(actor.anchorX, actor.anchorY);
      if (actor.tint !== undefined) node.sprite.tint = actor.tint;
      if (actor.visible && actor.imageUrl && node.imageUrl !== actor.imageUrl) {
        node.sprite.texture = Texture.from(actor.imageUrl);
        node.imageUrl = actor.imageUrl;
      } else if (actor.visible && !actor.imageUrl && actor.atlasUrl && node.imageUrl !== actor.atlasUrl) {
        node.sprite.texture = Texture.from(actor.atlasUrl);
        node.imageUrl = actor.atlasUrl;
      }
      const extra = actor.scale ?? 1;
      const flip = actor.flipX ? -1 : 1;
      const texW = Math.max(1, node.sprite.texture.width);
      const texH = Math.max(1, node.sprite.texture.height);
      node.sprite.scale.set((actor.width / texW) * extra * flip, (actor.height / texH) * extra);
    }

    if (actor.label) {
      if (!node.label) {
        node.label = new Text({
          text: actor.label,
          style: { fontSize: 14, fill: 0x2a2118, fontFamily: "sans-serif" },
        });
        node.label.anchor.set(0.5, 1);
        node.label.eventMode = "none";
        node.root.addChild(node.label);
      }
      node.label.text = actor.label;
      node.label.position.set(0, -actor.anchorY * actor.height - 4);
      node.label.visible = actor.visible;
    } else if (node.label) {
      node.label.destroy();
      node.root.removeChild(node.label);
      node.label = null;
    }
  }
}

function destroyNode(node: ActorNode): void {
  node.root.destroy({ children: true });
}
