import { assert, assertEquals, assertMatch } from "@std/assert";
import { fromFileUrl, join } from "@std/path";

for (
  const { name, env, source, port, extraArgs = [] } of [
    {
      name: "prepares sample documents by default",
      env: {},
      source: undefined,
      port: "8080",
    },
    {
      name: "uses defaults for empty environment values",
      env: { SADOKU_SOURCE: "", PORT: "" },
      source: undefined,
      port: "8080",
    },
    {
      name: "honors the source and Cloud Run port overrides",
      env: { SADOKU_SOURCE: "/app/docs/my guide.md", PORT: "9090" },
      source: "/app/docs/my guide.md",
      port: "9090",
    },
    {
      name: "enables forwarded-prefix trust only when requested",
      env: { SADOKU_TRUST_FORWARDED_PREFIX: "true" },
      source: undefined,
      port: "8080",
      extraArgs: ["--trust-forwarded-prefix"],
    },
  ]
) {
  Deno.test({
    name: `Cloud Run preview entrypoint ${name}`,
    ignore: Deno.build.os === "windows",
    async fn() {
      const bin = await Deno.makeTempDir({ prefix: "sadoku entrypoint test-" });
      try {
        const executable = join(bin, "sadoku");
        await Deno.writeTextFile(
          executable,
          `#!/bin/sh
if [ "$1" = start ]; then
  printf '%s\\n' "$SADOKU_COMMENTS_DIR" > "$TEST_STORE"
  printf '%s\\n' "$@"
fi
`,
        );
        await Deno.chmod(executable, 0o755);
        const result = await new Deno.Command("sh", {
          args: [
            fromFileUrl(
              new URL("./cloud_run_preview_entrypoint.sh", import.meta.url),
            ),
          ],
          clearEnv: true,
          env: {
            PATH: `${bin}:/usr/bin:/bin`,
            TMPDIR: bin,
            SADOKU_COMMENTS_DIR: join(bin, "configured comments"),
            TEST_STORE: join(bin, "store-path"),
            ...env,
          },
          stdout: "piped",
          stderr: "piped",
        }).output();

        assertEquals(result.code, 0, new TextDecoder().decode(result.stderr));
        const args = new TextDecoder().decode(result.stdout).trim().split("\n");
        assertEquals(
          args,
          [
            "start",
            source ?? args[1],
            "--host",
            "0.0.0.0",
            "--port",
            port,
            "--no-open",
            "--keep-alive",
            ...extraArgs,
          ],
        );
        const commentsPath = (await Deno.readTextFile(join(bin, "store-path")))
          .trim();
        if (source) {
          assertEquals(commentsPath, join(bin, "configured comments"));
          assertEquals(
            (await Array.fromAsync(Deno.readDir(bin))).some((entry) =>
              entry.name.startsWith("sadoku-preview.")
            ),
            false,
          );
        } else {
          const previewRoot = join(args[1], "..");
          assert(args[1].startsWith(`${bin}/sadoku-preview.`));
          assertMatch(args[1], /sadoku-preview\.[^/]+\/documents$/);
          assertEquals(commentsPath, join(previewRoot, "comments"));
          assert((await Deno.stat(join(args[1], "00-welcome.md"))).isFile);
          assert(
            (await Deno.stat(join(args[1], "examples/japanese.md"))).isFile,
          );
          assertEquals(
            await Deno.stat(join(args[1], "03-archived.md")).catch(() => null),
            null,
          );
          assert(
            (await Deno.readTextFile(join(args[1], "02-changes.md")))
              .includes("応答時間の目標は100 msです。"),
          );
        }
      } finally {
        await Deno.remove(bin, { recursive: true });
      }
    },
  });
}

Deno.test({
  name: "Cloud Run preview entrypoint stops and cleans up after a seed failure",
  ignore: Deno.build.os === "windows",
  async fn() {
    const bin = await Deno.makeTempDir({
      prefix: "sadoku-entrypoint-failure-",
    });
    try {
      await Deno.writeTextFile(
        join(bin, "sadoku"),
        `#!/bin/sh
if [ "$1" = start ]; then
  printf '%s\\n' 'Server must not start'
  exit 0
fi
printf '%s\\n' 'Sample command failed' >&2
exit 1
`,
      );
      await Deno.chmod(join(bin, "sadoku"), 0o755);
      const result = await new Deno.Command("sh", {
        args: [
          fromFileUrl(
            new URL("./cloud_run_preview_entrypoint.sh", import.meta.url),
          ),
        ],
        clearEnv: true,
        env: { PATH: `${bin}:/usr/bin:/bin`, TMPDIR: bin },
        stdout: "piped",
        stderr: "piped",
      }).output();
      assertEquals(result.code, 1);
      assertEquals(new TextDecoder().decode(result.stdout), "");
      assertMatch(
        new TextDecoder().decode(result.stderr),
        /Sample command failed/,
      );
      assertEquals(
        (await Array.fromAsync(Deno.readDir(bin))).map((entry) => entry.name),
        ["sadoku"],
      );
    } finally {
      await Deno.remove(bin, { recursive: true });
    }
  },
});
