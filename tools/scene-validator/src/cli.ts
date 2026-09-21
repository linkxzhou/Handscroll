import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateContentPack } from "./validate.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const all = process.argv.includes("--all");
const id = (() => {
  const idx = process.argv.findIndex((a) => a === "--content" || a === "--id");
  if (idx >= 0) return process.argv[idx + 1];
  const prefixed = process.argv.find((a) => a.startsWith("--id="));
  return prefixed ? prefixed.slice(5) : undefined;
})();

const ids: string[] = [];
if (all) {
  const contents = path.join(repoRoot, "contents");
  const entries = await fs.readdir(contents, { withFileTypes: true });
  for (const e of entries) {
    if (e.isDirectory() && !e.name.startsWith("_") && !e.name.startsWith(".")) ids.push(e.name);
  }
} else if (id) {
  ids.push(id);
} else {
  console.error("Usage: pnpm content:validate -- --id demo-scroll   |   --all");
  process.exit(1);
}

let failed = 0;
for (const scrollId of ids) {
  const result = await validateContentPack(path.join(repoRoot, "contents", scrollId));
  if (result.ok) {
    console.log(`OK  ${scrollId}`);
  } else {
    failed += 1;
    console.error(`FAIL ${scrollId}`);
    for (const issue of result.issues) {
      console.error(`  - ${issue.path}: ${issue.message}`);
    }
  }
}
process.exit(failed === 0 ? 0 : 1);
