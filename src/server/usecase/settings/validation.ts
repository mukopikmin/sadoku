export const isValidExcludedDirectory = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && value !== "." &&
  value !== ".." && !value.includes("/") && !value.includes("\\");

export const isValidExcludedDirectories = (
  value: unknown,
): value is string[] =>
  Array.isArray(value) && value.every(isValidExcludedDirectory) &&
  new Set(value).size === value.length;

export const isValidMarkdownExtension = (value: unknown): value is string =>
  typeof value === "string" && /^\.[^.\\/]+$/.test(value);

export const isValidMarkdownExtensions = (value: unknown): value is string[] =>
  Array.isArray(value) && value.length > 0 &&
  value.every(isValidMarkdownExtension) &&
  new Set(value.map((extension) => extension.toLowerCase())).size ===
    value.length;

export const fontScaleLimits = { min: 0.75, max: 1.5 } as const;

export const isValidFontScale = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) &&
  value >= fontScaleLimits.min && value <= fontScaleLimits.max;
