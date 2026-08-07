import { join } from "@std/path";
import { readConfig } from "../../config.ts";

const commentsDirectoryName = "sadoku";
const legacyCommentsDirectoryName = "mdview";

const getEnv = (name: string): string | undefined => {
  try {
    return Deno.env.get(name);
  } catch (error) {
    if (error instanceof Deno.errors.PermissionDenied) {
      throw new Error(
        `Cannot determine comments directory without environment access. Allow HOME, XDG_CONFIG_HOME, XDG_DATA_HOME, APPDATA, SADOKU_COMMENTS_DIR, and MDVIEW_COMMENTS_DIR.`,
      );
    }
    throw error;
  }
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

  return getDefaultCommentsDirectoryPath(commentsDirectoryName);
};

export const getLegacyCommentsDirectoryPath = (): string =>
  getDefaultCommentsDirectoryPath(legacyCommentsDirectoryName);
