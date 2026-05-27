import { normalize } from "@std/path";

const mermaidAssetRoot = new URL("../vendor/mermaid/", import.meta.url);

export const readMermaidAsset = async (pathname: string): Promise<Uint8Array | undefined> => {
  const relativePath = decodeURIComponent(pathname.slice("/assets/".length));
  if (!relativePath || relativePath.includes("..") || relativePath.startsWith("/")) {
    return undefined;
  }

  const assetUrl = new URL(normalize(relativePath), mermaidAssetRoot);
  if (!assetUrl.href.startsWith(mermaidAssetRoot.href)) {
    return undefined;
  }

  return await Deno.readFile(assetUrl).catch(() => undefined);
};
