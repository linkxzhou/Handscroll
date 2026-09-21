import type { GalleryPack } from "./packs.ts";

type HomeCopy = {
  kicker: string;
  title?: string;
  blurb: string;
  note?: string;
  cta: string;
};

const COPY: Record<string, HomeCopy> = {
  "qingming-riverside": {
    kicker: "引擎驱动 · 原创生成",
    blurb:
      "沿河街市可展读：码头唤渡、虹桥过船、时雨夜景与市井行人。此为引擎驱动的原创生成长卷，并非张择端《清明上河图》宋画扫描。",
    note: "画稿源自 xianxie6/qingming-riverside 的原创插画，不是宋画原作扫描。",
    cta: "展卷",
  },
  "demo-scroll": {
    kicker: "技术演示",
    title: "演示卷",
    blurb: "合成长卷，用来验收瓦片、视口与插件。无历史故事，供引擎沙盒对照。",
    cta: "打开演示",
  },
};

function copyFor(pack: GalleryPack): HomeCopy {
  return (
    COPY[pack.id] ?? {
      kicker: pack.era ?? "内容包",
      blurb: pack.description ?? "打开这幅长卷，拖移浏览。",
      cta: "展卷",
    }
  );
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function renderCard(pack: GalleryPack, featured: boolean): HTMLElement {
  const copy = copyFor(pack);
  const card = el(featured ? "article" : "article", featured ? "pack-card pack-card--featured" : "pack-card pack-card--secondary");
  card.setAttribute("data-scroll", pack.id);

  if (pack.coverUrl) {
    const figure = el("figure", "pack-card__cover");
    const img = el("img");
    img.src = pack.coverUrl;
    img.alt = copy.title ?? pack.title;
    img.loading = "lazy";
    img.addEventListener("error", () => figure.remove());
    figure.append(img);
    card.append(figure);
  }

  const body = el("div", "pack-card__body");
  body.append(el("p", "pack-card__kicker", copy.kicker));
  body.append(el("h2", "pack-card__title", copy.title ?? pack.title));
  if (pack.era) body.append(el("p", "pack-card__era", pack.era));
  body.append(el("p", "pack-card__blurb", copy.blurb));
  if (copy.note) body.append(el("p", "pack-card__note", copy.note));

  const cta = el("a", "pack-card__cta", copy.cta);
  cta.href = pack.href;
  body.append(cta);
  card.append(body);
  return card;
}

export function renderGallery(root: HTMLElement, packs: GalleryPack[]): void {
  root.replaceChildren();
  const featured = packs.filter((p) => p.featured);
  const rest = packs.filter((p) => !p.featured);

  const header = el("header", "home-hero");
  header.append(el("p", "home-kicker", "Handscroll"));
  header.append(el("h1", "home-title", "手卷"));
  header.append(el("p", "home-lede", "可展读的长卷引擎。点开一幅画，沿河游走。"));
  root.append(header);

  const featuredSection = el("section", "home-featured");
  featuredSection.setAttribute("aria-label", "已实现长卷");
  if (featured.length === 0 && rest.length === 0) {
    featuredSection.append(el("p", "home-empty", "还没有已发布的内容包。"));
  }
  for (const pack of featured) featuredSection.append(renderCard(pack, true));
  root.append(featuredSection);

  if (rest.length) {
    const more = el("section", "home-more");
    more.append(el("h2", "home-more__title", "其他卷册"));
    const grid = el("div", "home-more__grid");
    for (const pack of rest) grid.append(renderCard(pack, false));
    more.append(grid);
    root.append(more);
  }

  const foot = el("footer", "home-foot");
  foot.append(
    el(
      "p",
      undefined,
      "引擎不绑定某一幅画。新卷放入 contents/<id>/ 并写好 meta.json，主页会自动列出。",
    ),
  );
  root.append(foot);
}
