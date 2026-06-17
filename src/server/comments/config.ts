import { join } from "@std/path";

const appDirectoryName = "mdview";
const configFileName = "config.json";

const getEnv = (name: string): string | undefined => {
  try {
    return Deno.env.get(name);
  } catch (error) {
    if (error instanceof Deno.errors.PermissionDenied) {
      throw new Error(
        "Cannot read mdview config without environment access. Allow HOME, XDG_CONFIG_HOME, and APPDATA.",
      );
    }
    throw error;
  }
};

export const getConfigFilePath = (): string | undefined => {
  if (Deno.build.os === "darwin") {
    const home = getEnv("HOME");
    if (home) {
      return join(
        home,
        "Library",
        "Application Support",
        appDirectoryName,
        configFileName,
      );
    }
  }

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

export const getConfiguredCommentsDirectory = (): string | undefined => {
  const configFilePath = getConfigFilePath();
  if (!configFilePath) return undefined;

  let parsed: unknown;
  try {
    parsed = JSON.parse(Deno.readTextFileSync(configFilePath));
  } catch (error) {
    if (
      error instanceof Deno.errors.NotFound ||
      error instanceof SyntaxError
    ) return undefined;
    throw error;
  }

  if (typeof parsed !== "object" || parsed === null) return undefined;
  if (!("commentsDirectory" in parsed)) return undefined;

  const commentsDirectory = (parsed as { commentsDirectory: unknown })
    .commentsDirectory;
  if (typeof commentsDirectory !== "string") {
    throw new Error("commentsDirectory in mdview config must be a string.");
  }

  return commentsDirectory || undefined;
};
