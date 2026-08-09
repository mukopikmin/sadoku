import { assertEquals } from "@std/assert";
import { dirname, join } from "@std/path";
import { readConfig } from "../../config.ts";
import { handleSettingsRequest } from "./handler.ts";

const withSettings = async (run: () => Promise<void>) => {
  const previous = Deno.env.get("XDG_CONFIG_HOME");
  const root = await Deno.makeTempDir();
  Deno.env.set("XDG_CONFIG_HOME", root);
  try {
    await run();
  } finally {
    previous === undefined
      ? Deno.env.delete("XDG_CONFIG_HOME")
      : Deno.env.set("XDG_CONFIG_HOME", previous);
    await Deno.remove(root, { recursive: true });
  }
};

const request = (
  method: string,
  body?: unknown,
  contentType = "application/json",
) =>
  new Request("http://localhost/__sadoku/settings", {
    method,
    headers: body === undefined ? undefined : { "content-type": contentType },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

Deno.test("settings handler gets and updates preview settings without losing config", async () => {
  await withSettings(async () => {
    const path = join(
      Deno.env.get("XDG_CONFIG_HOME")!,
      "sadoku",
      "config.toml",
    );
    await Deno.mkdir(dirname(path), { recursive: true });
    await Deno.writeTextFile(path, 'commentsDirectory = "/tmp/comments"\n');

    assertEquals(
      await (await handleSettingsRequest(request("GET"))).json(),
      {},
    );
    const response = await handleSettingsRequest(
      request("PUT", { codeWrap: "scroll", theme: "light" }),
    );
    assertEquals(response.status, 200);
    assertEquals(await response.json(), { codeWrap: "scroll", theme: "light" });
    assertEquals(readConfig(), {
      codeWrapMode: "scroll",
      commentsDirectory: "/tmp/comments",
      themeMode: "light",
    });

    const codeWrapResponse = await handleSettingsRequest(
      request("PUT", { codeWrap: "wrap", theme: "dark" }),
    );
    assertEquals(codeWrapResponse.status, 200);
    assertEquals(await codeWrapResponse.json(), {
      codeWrap: "wrap",
      theme: "dark",
    });
    assertEquals(readConfig(), {
      codeWrapMode: "wrap",
      commentsDirectory: "/tmp/comments",
      themeMode: "dark",
    });
  });
});

Deno.test("settings handler validates method, content type, and JSON shape", async () => {
  await withSettings(async () => {
    assertEquals((await handleSettingsRequest(request("POST"))).status, 405);
    assertEquals(
      (await handleSettingsRequest(
        request("PUT", { theme: "dark" }, "text/plain"),
      )).status,
      400,
    );
    for (
      const body of [
        {},
        { theme: true },
        { theme: "sepia" },
        { codeWrap: true },
        { codeWrap: "truncate" },
        { codeWrap: "wrap", theme: "sepia" },
        { theme: "dark", extra: 1 },
      ]
    ) {
      assertEquals(
        (await handleSettingsRequest(request("PUT", body))).status,
        400,
      );
    }
  });
});
