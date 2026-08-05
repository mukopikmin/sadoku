import { assertEquals, assertThrows } from "@std/assert";
import { dirname, join } from "@std/path";

import { getConfigFilePath, parseConfig, readConfig } from "./config.ts";

type ConfigEnvironmentPaths = {
  configFilePath: string;
  defaultConfigFilePath: string;
  root: string;
};

const trackedEnvironmentNames = [
  "APPDATA",
  "HOME",
  "XDG_CONFIG_HOME",
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
  Deno.env.set("XDG_CONFIG_HOME", configHome);

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
  });
});

Deno.test("reads markdown font scale from config", async () => {
  await withConfigEnvironment(async ({ configFilePath }) => {
    await writeConfig(configFilePath, "markdownFontScale = 1.125\n");

    assertEquals(readConfig(), { markdownFontScale: 1.125 });
  });
});

Deno.test("reads comments directory and markdown font scale from config", async () => {
  await withConfigEnvironment(async ({ configFilePath, root }) => {
    const commentsDirectory = join(root, "configured-comments");
    await writeConfig(
      configFilePath,
      `commentsDirectory = ${
        JSON.stringify(commentsDirectory)
      }\nmarkdownFontScale = 1.125\n`,
    );

    assertEquals(readConfig(), { commentsDirectory, markdownFontScale: 1.125 });
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

Deno.test("rejects non-number markdown font scale config", async () => {
  await withConfigEnvironment(async ({ configFilePath }) => {
    await writeConfig(configFilePath, 'markdownFontScale = "large"\n');

    assertThrows(
      () => readConfig(),
      Error,
      "markdownFontScale in Sadoku config must be a number between 0.75 and 2.",
    );
  });
});

Deno.test("rejects too-small markdown font scale config", async () => {
  await withConfigEnvironment(async ({ configFilePath }) => {
    await writeConfig(configFilePath, "markdownFontScale = 0.5\n");

    assertThrows(
      () => readConfig(),
      Error,
      "markdownFontScale in Sadoku config must be a number between 0.75 and 2.",
    );
  });
});

Deno.test("rejects too-large markdown font scale config", async () => {
  await withConfigEnvironment(async ({ configFilePath }) => {
    await writeConfig(configFilePath, "markdownFontScale = 2.5\n");

    assertThrows(
      () => readConfig(),
      Error,
      "markdownFontScale in Sadoku config must be a number between 0.75 and 2.",
    );
  });
});

Deno.test("rejects non-finite markdown font scale config", () => {
  assertThrows(
    () => parseConfig({ markdownFontScale: Number.NaN }),
    Error,
    "markdownFontScale in Sadoku config must be a number between 0.75 and 2.",
  );
  assertThrows(
    () => parseConfig({ markdownFontScale: Number.POSITIVE_INFINITY }),
    Error,
    "markdownFontScale in Sadoku config must be a number between 0.75 and 2.",
  );
  assertThrows(
    () => parseConfig({ markdownFontScale: Number.NEGATIVE_INFINITY }),
    Error,
    "markdownFontScale in Sadoku config must be a number between 0.75 and 2.",
  );
});
