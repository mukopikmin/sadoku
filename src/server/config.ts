import { dirname, join } from "@std/path";
import { parse, stringify } from "@std/toml";

const appDirectoryName = "sadoku";
const legacyAppDirectoryName = "mdview";
const configFileName = "config.toml";

export type SadokuConfig = {
  codeWrapMode?: "scroll" | "wrap";
  commentsDirectory?: string;
  directoryMaxDepth?: number;
  directoryMaxFiles?: number;
  fontScale?: number;
  themeMode?: "dark" | "light";
};

export const fontScaleLimits = { min: 0.75, max: 1.5 } as const;

export const isValidFontScale = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) &&
  value >= fontScaleLimits.min && value <= fontScaleLimits.max;

const getEnv = (name: string): string | undefined => {
  try {
    return Deno.env.get(name);
  } catch (error) {
    if (error instanceof Deno.errors.PermissionDenied) {
      throw new Error(
        "Cannot read Sadoku config without environment access. Allow HOME, XDG_CONFIG_HOME, and APPDATA.",
      );
    }
    throw error;
  }
};

export const getConfigFilePath = (): string | undefined => {
  if (Deno.build.os === "windows") {
    const appData = getEnv("APPDATA");
    if (appData) return join(appData, appDirectoryName, configFileName);
  }

  const xdgConfigHome = getEnv("XDG_CONFIG_HOME");
  if (xdgConfigHome) {
    return join(xdgConfigHome, appDirectoryName, configFileName);
  }

  const home = getEnv("HOME");
  if (home) return join(home, ".config", appDirectoryName, configFileName);

  return undefined;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const parseConfig = (value: unknown): SadokuConfig | undefined => {
  if (!isRecord(value)) return undefined;

  const config: SadokuConfig = {};
  if ("commentsDirectory" in value) {
    const commentsDirectory = value.commentsDirectory;
    if (typeof commentsDirectory !== "string") {
      throw new Error("commentsDirectory in Sadoku config must be a string.");
    }

    if (commentsDirectory) config.commentsDirectory = commentsDirectory;
  }

  if ("theme_mode" in value) {
    if (value.theme_mode !== "dark" && value.theme_mode !== "light") {
      throw new Error(
        'theme_mode in Sadoku config must be either "dark" or "light".',
      );
    }
    config.themeMode = value.theme_mode;
  }

  if ("code_wrap_mode" in value) {
    if (value.code_wrap_mode !== "scroll" && value.code_wrap_mode !== "wrap") {
      throw new Error(
        'code_wrap_mode in Sadoku config must be either "scroll" or "wrap".',
      );
    }
    config.codeWrapMode = value.code_wrap_mode;
  }

  if ("directory_max_depth" in value) {
    if (
      !Number.isInteger(value.directory_max_depth) ||
      (value.directory_max_depth as number) < 0
    ) {
      throw new Error(
        "directory_max_depth in Sadoku config must be a non-negative integer.",
      );
    }
    config.directoryMaxDepth = value.directory_max_depth as number;
  }

  if ("directory_max_files" in value) {
    if (
      !Number.isInteger(value.directory_max_files) ||
      (value.directory_max_files as number) < 1
    ) {
      throw new Error(
        "directory_max_files in Sadoku config must be a positive integer.",
      );
    }
    config.directoryMaxFiles = value.directory_max_files as number;
  }

  if ("font_scale" in value) {
    if (!isValidFontScale(value.font_scale)) {
      throw new Error(
        `font_scale in Sadoku config must be a finite number between ${fontScaleLimits.min} and ${fontScaleLimits.max}.`,
      );
    }
    config.fontScale = value.font_scale;
  }

  return config;
};

const updateConfig = async (
  updates: Record<string, unknown>,
): Promise<void> => {
  const configFilePath = getConfigFilePath();
  if (!configFilePath) {
    throw new Error("Cannot locate the Sadoku config file.");
  }

  let existing: Record<string, unknown> = {};
  try {
    const parsed = parse(await Deno.readTextFile(configFilePath));
    if (!isRecord(parsed)) throw new Error("Sadoku config must be a table.");
    // Validate known settings before preserving them in the rewritten file.
    parseConfig(parsed);
    existing = parsed;
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) throw error;
  }

  await Deno.mkdir(dirname(configFilePath), { recursive: true });
  const temporaryPath = `${configFilePath}.${crypto.randomUUID()}.tmp`;
  try {
    await Deno.writeTextFile(
      temporaryPath,
      stringify({ ...existing, ...updates }),
      { createNew: true },
    );
    await Deno.rename(temporaryPath, configFilePath);
  } finally {
    await Deno.remove(temporaryPath).catch((error) => {
      if (!(error instanceof Deno.errors.NotFound)) throw error;
    });
  }
};

export const updateThemeConfig = (theme: "dark" | "light"): Promise<void> =>
  updateConfig({ theme_mode: theme });

export const updateCodeWrapConfig = (
  codeWrap: "scroll" | "wrap",
): Promise<void> => updateConfig({ code_wrap_mode: codeWrap });

export const updatePreviewConfig = (
  theme: "dark" | "light",
  codeWrap: "scroll" | "wrap",
  directoryMaxDepth?: number,
  directoryMaxFiles?: number,
  fontScale = 1,
): Promise<void> =>
  updateConfig({
    code_wrap_mode: codeWrap,
    ...(directoryMaxDepth === undefined
      ? {}
      : { directory_max_depth: directoryMaxDepth }),
    ...(directoryMaxFiles === undefined
      ? {}
      : { directory_max_files: directoryMaxFiles }),
    font_scale: fontScale,
    theme_mode: theme,
  });

export const readConfig = (): SadokuConfig | undefined => {
  const configFilePath = getConfigFilePath();
  if (!configFilePath) return undefined;

  let parsed: unknown;
  try {
    parsed = parse(Deno.readTextFileSync(configFilePath));
  } catch (error) {
    if (
      error instanceof Deno.errors.NotFound ||
      error instanceof SyntaxError
    ) return undefined;
    throw error;
  }

  return parseConfig(parsed);
};

const getDefaultCommentsDirectoryPath = (directoryName: string): string => {
  if (Deno.build.os === "darwin") {
    const home = getEnv("HOME");
    if (home) {
      return join(
        home,
        "Library",
        "Application Support",
        directoryName,
        "comments",
      );
    }
  }

  if (Deno.build.os === "windows") {
    const appData = getEnv("APPDATA");
    if (appData) return join(appData, directoryName, "comments");
  }

  const xdgDataHome = getEnv("XDG_DATA_HOME");
  if (xdgDataHome) return join(xdgDataHome, directoryName, "comments");

  const home = getEnv("HOME");
  if (home) {
    return join(home, ".local", "share", directoryName, "comments");
  }

  return join(Deno.cwd(), `.${directoryName}`, "comments");
};

export const getCommentsDirectoryPath = (): string => {
  const configuredDirectory = getEnv("SADOKU_COMMENTS_DIR");
  if (configuredDirectory) return configuredDirectory;

  const config = readConfig();
  if (config?.commentsDirectory) return config.commentsDirectory;

  const legacyConfiguredDirectory = getEnv("MDVIEW_COMMENTS_DIR");
  if (legacyConfiguredDirectory) return legacyConfiguredDirectory;

  return getDefaultCommentsDirectoryPath(appDirectoryName);
};

export const getLegacyCommentsDirectoryPath = (): string =>
  getDefaultCommentsDirectoryPath(legacyAppDirectoryName);
