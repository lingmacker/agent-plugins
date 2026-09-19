import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const catalogPath = join(root, ".omp-plugin", "marketplace.json");
const pluginsRoot = join(root, "plugins");

type CatalogPlugin = {
  name: string;
  source: string;
  description: string;
  category?: string;
};

type Catalog = {
  name: string;
  description: string;
  plugins: CatalogPlugin[];
};

async function check(catalog: Catalog): Promise<void> {
  if (!Array.isArray(catalog.plugins)) throw new Error(".omp-plugin/marketplace.json: plugins must be an array");

  const names = new Set<string>();
  for (const entry of catalog.plugins) {
    if (!entry.name || names.has(entry.name)) throw new Error(`duplicate plugin name: ${entry.name}`);
    names.add(entry.name);

    const path = resolve(root, entry.source);
    if (relative(root, path).startsWith("..")) throw new Error(`${entry.name}: path escapes the marketplace`);
    const manifest = JSON.parse(await readFile(join(path, "package.json"), "utf8")) as Record<string, unknown>;
    const omp = manifest.omp as { extensions?: unknown } | undefined;
    if (manifest.name !== entry.name) throw new Error(`${entry.name}: package.json name does not match catalog`);
    if (manifest.description !== entry.description) throw new Error(`${entry.name}: description does not match catalog`);
    if (!Array.isArray(omp?.extensions) || omp.extensions.length === 0) {
      throw new Error(`${entry.name}: package.json must declare omp.extensions`);
    }
    for (const extension of omp.extensions) {
      if (typeof extension !== "string") throw new Error(`${entry.name}: extension paths must be strings`);
      await access(join(path, extension));
    }
  }

  console.log(`OK: ${catalog.plugins.length} plugin${catalog.plugins.length === 1 ? "" : "s"}`);
}


async function list(): Promise<void> {
  const catalog = JSON.parse(await readFile(catalogPath, "utf8")) as Catalog;
  for (const plugin of catalog.plugins) {
    const manifest = JSON.parse(await readFile(join(root, plugin.source, "package.json"), "utf8")) as Record<string, unknown>;
    console.log(`${plugin.name}\t${manifest.version ?? "-"}\t${plugin.description}`);
  }
}

async function create(name: string | undefined): Promise<void> {
  if (!name || !/^[a-z0-9][a-z0-9-]*$/.test(name)) {
    throw new Error("usage: bun run new -- <lowercase-plugin-name>");
  }

  const catalog = JSON.parse(await readFile(catalogPath, "utf8")) as Catalog;
  if (catalog.plugins.some((plugin) => plugin.name === name)) throw new Error(`${name}: already in marketplace`);

  const path = join(pluginsRoot, name);
  try {
    await access(path);
    throw new Error(`${name}: directory already exists`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  const description = "An Oh My Pi plugin.";
  await mkdir(path, { recursive: true });
  await writeFile(
    join(path, "package.json"),
    `${JSON.stringify({
      name,
      version: "0.1.0",
      description,
      private: true,
      scripts: { test: "bun test" },
      omp: { extensions: ["./index.ts"] },
    }, null, 2)}\n`,
  );
  await writeFile(
    join(path, "README.md"),
    `# ${name}\n\n${description}\n\nAdd the extension entry point at index.ts, then run bun run check.\n`,
  );

  catalog.plugins.push({ name, source: `./plugins/${name}`, description, category: "productivity" });
  await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
  console.log(`Created plugins/${name}/. Add index.ts, then run bun run check.`);
}

const [command, name] = process.argv.slice(2);
if (command === "list") await list();
else if (command === "check") {
  const catalog = JSON.parse(await readFile(catalogPath, "utf8")) as Catalog;
  await check(catalog);
}
else if (command === "new") await create(name);
else throw new Error("usage: bun run plugins | bun run check | bun run new -- <name>");
