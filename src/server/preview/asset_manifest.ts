type ManifestEntry = {
  dynamicImports?: string[];
  file: string;
  imports?: string[];
};

const manifestUrl = new URL(
  "../../preview/dist/.vite/manifest.json",
  import.meta.url,
);

const manifest = JSON.parse(
  await Deno.readTextFile(manifestUrl),
) as Record<string, ManifestEntry>;

export const previewAssetManifest = manifest;

const assetPath = (logicalName: string): string => {
  const file = manifest[logicalName]?.file;
  if (!file || file.includes("..") || file.startsWith("/")) {
    throw new Error(`Missing or invalid preview asset: ${logicalName}`);
  }
  return `/assets/${file}`;
};

export const previewAssetPaths = {
  client: assetPath("main.tsx"),
  favicon: assetPath("assets/favicon.ico"),
  icon: assetPath("assets/icon-512.png"),
};

export const fingerprintedPreviewFiles = new Set(
  Object.values(manifest)
    .map(({ file }) => file)
    .filter((file) => /-[A-Za-z0-9_-]{8}\.[a-z0-9]+$/i.test(file)),
);
