import { normalize } from "@std/path";
import { notFoundResponse } from "../responses.ts";

const previewAssetRoot = new URL("../../preview/dist/", import.meta.url);

const readAsset = async (
  pathname: string,
  prefix: string,
  root: URL,
): Promise<Uint8Array | undefined> => {
  const relativePath = decodeURIComponent(pathname.slice(prefix.length));
  if (
    !relativePath || relativePath.includes("..") || relativePath.startsWith("/")
  ) {
    return undefined;
  }

  const assetUrl = new URL(normalize(relativePath), root);
  if (!assetUrl.href.startsWith(root.href)) {
    return undefined;
  }

  return await Deno.readFile(assetUrl).catch(() => undefined);
};

export const readPreviewAsset = async (
  pathname: string,
): Promise<Uint8Array | undefined> => {
  return await readAsset(pathname, "/assets/", previewAssetRoot);
};

const assetContentType = (pathname: string): string => {
  if (pathname.endsWith(".css")) return "text/css; charset=utf-8";
  return "text/javascript; charset=utf-8";
};

export const handlePreviewAssetRequest = async (
  pathname: string,
): Promise<Response> => {
  const asset = await readPreviewAsset(pathname);
  if (!asset) return notFoundResponse("Asset not found.");

  const body = asset.buffer.slice(
    asset.byteOffset,
    asset.byteOffset + asset.byteLength,
  ) as ArrayBuffer;
  return new Response(body, {
    headers: {
      "content-type": assetContentType(pathname),
      "cache-control": pathname === "/assets/client.js"
        ? "no-store"
        : "public, max-age=31536000, immutable",
    },
  });
};
