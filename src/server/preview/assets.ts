import { normalize } from "@std/path";
import { noStoreCacheControl, notFoundResponse } from "../responses.ts";
import { fingerprintedPreviewFiles } from "./asset_manifest.ts";

const previewAssetRoot = new URL("../../preview/dist/", import.meta.url);

const contentTypeForPath = (pathname: string): string => {
  if (pathname.endsWith(".ico")) return "image/x-icon";
  if (pathname.endsWith(".png")) return "image/png";
  if (pathname.endsWith(".json")) return "application/json; charset=utf-8";
  return "text/javascript; charset=utf-8";
};

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

export const handlePreviewAssetRequest = async (
  pathname: string,
): Promise<Response> => {
  const asset = await readPreviewAsset(pathname);
  if (!asset) return notFoundResponse("Asset not found.");

  const body = asset.buffer.slice(
    asset.byteOffset,
    asset.byteOffset + asset.byteLength,
  ) as ArrayBuffer;
  const relativePath = decodeURIComponent(pathname.slice("/assets/".length));
  return new Response(body, {
    headers: {
      "content-type": contentTypeForPath(pathname),
      "cache-control": fingerprintedPreviewFiles.has(relativePath)
        ? "public, max-age=31536000, immutable"
        : noStoreCacheControl,
    },
  });
};
