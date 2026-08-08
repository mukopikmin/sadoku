import { dirname, join } from "@std/path";
import { parse, stringify } from "@std/toml";

const appDirectoryName = "sadoku";
const configFileName = "config.toml";

export type SadokuConfig = {
  commentsDirectory?: string;
  theme?: "dark" | "light";
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

  if ("theme" in value) {
    if (value.theme !== "dark" && value.theme !== "light") {
      throw new Error(
        'theme in Sadoku config must be either "dark" or "light".',
      );
    }
    config.theme = value.theme;
  }

  return config;
};

export const updateThemeConfig = async (
  theme: "dark" | "light",
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
      stringify({ ...existing, theme }),
      { createNew: true },
    );
    await Deno.rename(temporaryPath, configFilePath);
  } finally {
    await Deno.remove(temporaryPath).catch((error) => {
      if (!(error instanceof Deno.errors.NotFound)) throw error;
    });
  }
};

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
