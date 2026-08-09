import { dirname, join } from "@std/path";
import { parse, stringify } from "@std/toml";

const appDirectoryName = "sadoku";
const configFileName = "config.toml";

export type SadokuConfig = {
  codeWrapMode?: "scroll" | "wrap";
  commentsDirectory?: string;
  themeMode?: "dark" | "light";
};

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
): Promise<void> =>
  updateConfig({ code_wrap_mode: codeWrap, theme_mode: theme });

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
