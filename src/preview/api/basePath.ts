export const readPreviewBasePath = (
  document: Document | undefined = globalThis.document,
): string => {
  const value =
    document?.getElementById("sadoku-client-root")?.dataset.basePath ??
      "";
  if (
    value !== "" &&
    (value.length > 2048 ||
      !/^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+$/.test(value))
  ) throw new Error("Invalid public base path.");
  return value;
};

export const previewPath = (
  path: string,
  basePath = readPreviewBasePath(),
): string => `${basePath}${path}`;
