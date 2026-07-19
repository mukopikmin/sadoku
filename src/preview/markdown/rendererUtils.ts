export const mergeClassNames = (
  ...classNames: Array<string | undefined>
): string | undefined => {
  const merged = classNames.filter(Boolean).join(" ");
  return merged === "" ? undefined : merged;
};
