export const parsePublicBasePath = (
  value: string | null,
): string | undefined => {
  if (value === null || value === "") return "";
  if (
    value.length > 2048 ||
    !/^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+$/.test(value)
  ) return undefined;
  return value;
};
