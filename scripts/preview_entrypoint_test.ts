import { assert, assertEquals, assertMatch } from "@std/assert";
import { fromFileUrl, join } from "@std/path";

const entrypoint = fromFileUrl(
  new URL("./preview_entrypoint.sh", import.meta.url),
);

for (
  const { name, env, source, exitCode = 0 } of [
    {
      name: "prepares sample documents by default",
      env: {},
      source: undefined,
    },
    {
      name: "prepares samples when the source is empty",
      env: { SADOKU_SOURCE: "" },
      source: undefined,
    },
    {
      name: "skips preparation for an explicit source and preserves storage",
      env: { SADOKU_SOURCE: "/docs/my guide.md" },
      source: "/docs/my guide.md",
    },
    {
      name: "preserves the supplied command's exit status",
      env: { SADOKU_SOURCE: "/docs/my guide.md", PREVIEW_TEST_EXIT: "17" },
      source: "/docs/my guide.md",
      exitCode: 17,
    },
  ]
) {
  Deno.test({
    name: `Preview entrypoint ${name}`,
    ignore: Deno.build.os === "windows",
    async fn() {
      const bin = await Deno.makeTempDir({ prefix: "sadoku entrypoint test-" });
      try {
        // Use a separate command to verify argument forwarding, including
        // spaces in the command path and argument values.
        const command = join(bin, "preview runner");
        await Deno.writeTextFile(
          command,
          `#!/bin/sh
printf '%s\\n' "$SADOKU_SOURCE" "$SADOKU_COMMENTS_DIR" "$@"
exit "\${PREVIEW_TEST_EXIT:-0}"
`,
        );
        await Deno.chmod(command, 0o755);
        await Deno.writeTextFile(join(bin, "sadoku"), "#!/bin/sh\nexit 0\n");
        await Deno.chmod(join(bin, "sadoku"), 0o755);
        const commandArgs = ["--label", "value with spaces"];
        const result = await new Deno.Command("sh", {
          args: [entrypoint, command, ...commandArgs],
          clearEnv: true,
          env: {
            PATH: `${bin}:/usr/bin:/bin`,
            TMPDIR: bin,
            SADOKU_COMMENTS_DIR: join(bin, "configured comments"),
            ...env,
          },
          stdout: "piped",
          stderr: "piped",
        }).output();

        assertEquals(
          result.code,
          exitCode,
          new TextDecoder().decode(result.stderr),
        );
        const [sourcePath, commentsPath, ...args] = new TextDecoder()
          .decode(result.stdout).trim().split("\n");
        assertEquals(args, commandArgs);
        if (source) {
          assertEquals(sourcePath, source);
          assertEquals(commentsPath, join(bin, "configured comments"));
          assertEquals(
            (await Array.fromAsync(Deno.readDir(bin))).some((entry) =>
              entry.name.startsWith("sadoku-preview.")
            ),
            false,
          );
        } else {
          assert(sourcePath.startsWith(`${bin}/sadoku-preview.`));
          assertMatch(sourcePath, /sadoku-preview\.[^/]+\/documents$/);
          assertEquals(commentsPath, join(sourcePath, "../comments"));
          assert((await Deno.stat(join(sourcePath, "00-welcome.md"))).isFile);
          assert(
            (await Deno.stat(join(sourcePath, "examples/japanese.md"))).isFile,
          );
          assertEquals(
            await Deno.stat(join(sourcePath, "03-archived.md")).catch(() =>
              null
            ),
            null,
          );
          assert(
            (await Deno.readTextFile(join(sourcePath, "02-changes.md")))
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
  name: "Preview entrypoint requires a command before preparing samples",
  ignore: Deno.build.os === "windows",
  async fn() {
    const result = await new Deno.Command("sh", {
      args: [entrypoint],
      clearEnv: true,
      stdout: "piped",
      stderr: "piped",
    }).output();
    assertEquals(result.code, 2);
    assertEquals(new TextDecoder().decode(result.stdout), "");
    assertEquals(
      new TextDecoder().decode(result.stderr).trim(),
      "Usage: preview_entrypoint.sh <command> [args...]",
    );
  },
});

Deno.test({
  name: "Preview entrypoint stops and cleans up after a seed failure",
  ignore: Deno.build.os === "windows",
  async fn() {
    const bin = await Deno.makeTempDir({
      prefix: "sadoku-entrypoint-failure-",
    });
    try {
      await Deno.writeTextFile(
        join(bin, "sadoku"),
        "#!/bin/sh\nprintf '%s\\n' 'Sample command failed' >&2\nexit 1\n",
      );
      await Deno.chmod(join(bin, "sadoku"), 0o755);
      const result = await new Deno.Command("sh", {
        args: [
          entrypoint,
          "sh",
          "-c",
          "printf '%s\\n' 'Server must not start'",
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
