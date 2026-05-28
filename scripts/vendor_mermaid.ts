import { dirname, join } from "@std/path";

const sourceRoot = join(Deno.cwd(), "node_modules", "mermaid", "dist");
const vendorRoot = join(Deno.cwd(), "src", "vendor", "mermaid");

const requiredSources = [
  "mermaid.esm.min.mjs",
  join("chunks", "mermaid.esm.min"),
];

const exists = async (path: string): Promise<boolean> => {
  try {
    await Deno.stat(path);
    return true;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return false;
    throw error;
  }
};

const copyRecursive = async (
  source: string,
  destination: string,
): Promise<void> => {
  const sourceStat = await Deno.stat(source);
  if (sourceStat.isDirectory) {
    await Deno.mkdir(destination, { recursive: true });
    for await (const entry of Deno.readDir(source)) {
      await copyRecursive(
        join(source, entry.name),
        join(destination, entry.name),
      );
    }
    return;
  }

  await Deno.mkdir(dirname(destination), { recursive: true });
  await Deno.copyFile(source, destination);
};

if (!(await exists(sourceRoot))) {
  console.error(
    "Missing node_modules/mermaid. Run `npm install` before vendoring Mermaid.",
  );
  Deno.exit(1);
}

await Deno.remove(vendorRoot, { recursive: true }).catch((error) => {
  if (!(error instanceof Deno.errors.NotFound)) throw error;
});

for (const relativePath of requiredSources) {
  const source = join(sourceRoot, relativePath);
  const destination = join(vendorRoot, relativePath);
  await Deno.mkdir(dirname(destination), { recursive: true });
  await copyRecursive(source, destination);
}

console.log(`Vendored Mermaid assets to ${vendorRoot}`);
