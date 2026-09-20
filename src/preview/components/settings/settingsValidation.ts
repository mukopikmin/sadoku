export const FONT_SCALES = [
  0.75,
  0.8,
  0.9,
  1,
  1.1,
  1.2,
  1.3,
  1.4,
  1.5,
] as const;

export const getAdjacentFontScales = (fontScale: number) => {
  const firstLargerScale = FONT_SCALES.findIndex((scale) => scale >= fontScale);
  const scaleIndex = firstLargerScale === -1
    ? FONT_SCALES.length - 1
    : firstLargerScale;
  return {
    decrease: FONT_SCALES[Math.max(0, scaleIndex - 1)],
    increase: FONT_SCALES[Math.min(FONT_SCALES.length - 1, scaleIndex + 1)],
  };
};

export const isValidExcludedDirectory = (directory: string) =>
  directory.length > 0 && directory !== "." && directory !== ".." &&
  !directory.includes("/") && !directory.includes("\\");

export const isValidMarkdownExtension = (extension: string) =>
  /^\.[^.\\/]+$/.test(extension);
