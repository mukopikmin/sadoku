import { assertEquals, assertRejects } from "@std/assert";

import { getUnixInstallPath, installUnix } from "./install_unix.ts";

Deno.test("rejects unsupported operating systems", async () => {
  await assertRejects(
    () =>
      installUnix({
        home: "/tmp/sadoku-home",
        os: "windows",
      }),
    Error,
    "This installer supports only macOS and Linux.",
  );
});

Deno.test("installs an executable compiled binary", async () => {
  const home = await Deno.makeTempDir({ prefix: "sadoku-install-test-" });

  try {
    const installPath = await installUnix({
      compileArgs: ["--version", "1.2.3"],
      compileBinary: async (buildPath, compileArgs) => {
        assertEquals(compileArgs, ["--version", "1.2.3"]);
        await Deno.writeTextFile(buildPath, "compiled sadoku");
      },
      home,
      os: "linux",
    });

    assertEquals(installPath, getUnixInstallPath(home));
    assertEquals(await Deno.readTextFile(installPath), "compiled sadoku");
    assertEquals((await Deno.stat(installPath)).mode! & 0o777, 0o755);
  } finally {
    await Deno.remove(home, { recursive: true });
  }
});
