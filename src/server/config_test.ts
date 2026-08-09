import { assertEquals, assertThrows } from "@std/assert";
import { dirname, join } from "@std/path";

import {
  getCommentsDirectoryPath,
  getConfigFilePath,
  readConfig,
  updateCodeWrapConfig,
  updateThemeConfig,
} from "./config.ts";

type ConfigEnvironmentPaths = {
  configFilePath: string;
  defaultConfigFilePath: string;
  root: string;
};

const trackedEnvironmentNames = [
  "APPDATA",
  "HOME",
  "MDVIEW_COMMENTS_DIR",
  "SADOKU_COMMENTS_DIR",
  "XDG_CONFIG_HOME",
  "XDG_DATA_HOME",
] as const;

const withConfigEnvironment = async (
  run: (paths: ConfigEnvironmentPaths) => Promise<void>,
): Promise<void> => {
  const previous = new Map(
    trackedEnvironmentNames.map((name) => [name, Deno.env.get(name)]),
  );
  const root = await Deno.makeTempDir({ prefix: "sadoku-config-" });
  const appData = join(root, "appdata");
  const configHome = join(root, "config");
  const home = join(root, "home");

  Deno.env.set("APPDATA", appData);
  Deno.env.set("HOME", home);
  Deno.env.delete("MDVIEW_COMMENTS_DIR");
  Deno.env.delete("SADOKU_COMMENTS_DIR");
  Deno.env.set("XDG_CONFIG_HOME", configHome);
  Deno.env.set("XDG_DATA_HOME", join(root, "data"));

  const defaultConfigFilePath = Deno.build.os === "windows"
    ? join(appData, "sadoku", "config.toml")
    : join(configHome, "sadoku", "config.toml");

  try {
    await run({
      configFilePath: defaultConfigFilePath,
      defaultConfigFilePath,
      root,
    });
  } finally {
    for (const [name, value] of previous) {
      if (value === undefined) {
        Deno.env.delete(name);
      } else {
        Deno.env.set(name, value);
      }
    }
    await Deno.remove(root, { recursive: true }).catch(() => {});
  }
};

const writeConfig = async (
  configFilePath: string,
  text: string,
): Promise<void> => {
  await Deno.mkdir(dirname(configFilePath), { recursive: true });
  await Deno.writeTextFile(configFilePath, text);
};

Deno.test("resolves the Sadoku config file path", async () => {
  await withConfigEnvironment(async ({ defaultConfigFilePath }) => {
    assertEquals(getConfigFilePath(), defaultConfigFilePath);
  });
});

Deno.test({
  name: "falls back to ~/.config when XDG_CONFIG_HOME is unset",
  ignore: Deno.build.os === "windows",
  fn: async () => {
    await withConfigEnvironment(async ({ root }) => {
      Deno.env.delete("XDG_CONFIG_HOME");

      assertEquals(
        getConfigFilePath(),
        join(root, "home", ".config", "sadoku", "config.toml"),
      );
    });
  },
});

Deno.test("reads comments directory from config", async () => {
  await withConfigEnvironment(async ({ configFilePath, root }) => {
    const commentsDirectory = join(root, "configured-comments");
    await writeConfig(
      configFilePath,
      `commentsDirectory = ${JSON.stringify(commentsDirectory)}\n`,
    );

    assertEquals(readConfig(), { commentsDirectory });
    assertEquals(getCommentsDirectoryPath(), commentsDirectory);
  });
});

Deno.test("prefers the comments directory environment override", async () => {
  await withConfigEnvironment(async ({ root }) => {
    const commentsDirectory = join(root, "environment-comments");
    Deno.env.set("SADOKU_COMMENTS_DIR", commentsDirectory);

    assertEquals(getCommentsDirectoryPath(), commentsDirectory);
  });
});

Deno.test("uses the platform data directory for comments by default", async () => {
  await withConfigEnvironment(async ({ root }) => {
    assertEquals(
      getCommentsDirectoryPath(),
      Deno.build.os === "windows"
        ? join(root, "appdata", "sadoku", "comments")
        : join(root, "data", "sadoku", "comments"),
    );
  });
});

Deno.test("reads config without comments directory", async () => {
  await withConfigEnvironment(async ({ configFilePath }) => {
    await writeConfig(configFilePath, "");

    assertEquals(readConfig(), {});
  });
});

Deno.test("ignores missing or malformed config", async () => {
  await withConfigEnvironment(async ({ configFilePath }) => {
    assertEquals(readConfig(), undefined);

    await writeConfig(configFilePath, "{");

    assertEquals(readConfig(), undefined);
  });
});

Deno.test("rejects invalid comments directory config type", async () => {
  await withConfigEnvironment(async ({ configFilePath }) => {
    await writeConfig(
      configFilePath,
      "commentsDirectory = 42\n",
    );

    assertThrows(
      () => readConfig(),
      Error,
      "commentsDirectory in Sadoku config must be a string.",
    );
  });
});

Deno.test("reads and validates theme mode config", async () => {
  await withConfigEnvironment(async ({ configFilePath }) => {
    await writeConfig(configFilePath, 'theme_mode = "dark"\n');
    assertEquals(readConfig(), { themeMode: "dark" });

    for (const invalid of ["true", '"sepia"']) {
      await writeConfig(configFilePath, `theme_mode = ${invalid}\n`);
      assertThrows(
        () => readConfig(),
        Error,
        'theme_mode in Sadoku config must be either "dark" or "light".',
      );
    }
  });
});

Deno.test("reads and validates code wrap mode config", async () => {
  await withConfigEnvironment(async ({ configFilePath }) => {
    await writeConfig(configFilePath, 'code_wrap_mode = "wrap"\n');
    assertEquals(readConfig(), { codeWrapMode: "wrap" });

    for (const invalid of ["true", '"truncate"']) {
      await writeConfig(configFilePath, `code_wrap_mode = ${invalid}\n`);
      assertThrows(
        () => readConfig(),
        Error,
        'code_wrap_mode in Sadoku config must be either "scroll" or "wrap".',
      );
    }
  });
});

for (const theme of ["dark", "light"] as const) {
  Deno.test(`saves theme_mode=${theme} while retaining existing config`, async () => {
    await withConfigEnvironment(async ({ configFilePath, root }) => {
      const commentsDirectory = join(root, "comments");
      await writeConfig(
        configFilePath,
        `commentsDirectory = ${
          JSON.stringify(commentsDirectory)
        }\ncustom = "kept"\n`,
      );

      await updateThemeConfig(theme);

      assertEquals(readConfig(), { commentsDirectory, themeMode: theme });
      const saved = await Deno.readTextFile(configFilePath);
      assertEquals(saved.includes('custom = "kept"'), true);
    });
  });
}

Deno.test("creates the config directory and file when saving a theme", async () => {
  await withConfigEnvironment(async ({ configFilePath }) => {
    await updateThemeConfig("dark");
    assertEquals(readConfig(), { themeMode: "dark" });
    assertEquals(
      await Deno.readTextFile(configFilePath),
      'theme_mode = "dark"\n',
    );
    assertEquals(
      await Deno.stat(configFilePath).then((stat) => stat.isFile),
      true,
    );
  });
});

Deno.test("saves code wrap mode while retaining existing config", async () => {
  await withConfigEnvironment(async ({ configFilePath }) => {
    await writeConfig(configFilePath, 'theme_mode = "dark"\ncustom = "kept"\n');

    await updateCodeWrapConfig("wrap");

    assertEquals(readConfig(), { codeWrapMode: "wrap", themeMode: "dark" });
    assertEquals(
      await Deno.readTextFile(configFilePath),
      'theme_mode = "dark"\ncustom = "kept"\ncode_wrap_mode = "wrap"\n',
    );
  });
});
