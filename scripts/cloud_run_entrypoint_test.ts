import { assertEquals } from "@std/assert";
import { fromFileUrl, join } from "@std/path";

for (
  const { name, env, source, port } of [
    {
      name: "opens the repository directory by default",
      env: {},
      source: "/app",
      port: "8080",
    },
    {
      name: "uses defaults for empty environment values",
      env: { SADOKU_SOURCE: "", PORT: "" },
      source: "/app",
      port: "8080",
    },
    {
      name: "honors the source and Cloud Run port overrides",
      env: { SADOKU_SOURCE: "/app/docs/my guide.md", PORT: "9090" },
      source: "/app/docs/my guide.md",
      port: "9090",
    },
  ]
) {
  Deno.test({
    name: `Cloud Run entrypoint ${name}`,
    ignore: Deno.build.os === "windows",
    async fn() {
      const bin = await Deno.makeTempDir({ prefix: "sadoku-entrypoint-test-" });
      try {
        const executable = join(bin, "sadoku");
        await Deno.writeTextFile(
          executable,
          '#!/bin/sh\nprintf "%s\\n" "$@"\n',
        );
        await Deno.chmod(executable, 0o755);
        const result = await new Deno.Command("sh", {
          args: [
            fromFileUrl(new URL("./cloud_run_entrypoint.sh", import.meta.url)),
          ],
          clearEnv: true,
          env: { PATH: `${bin}:/usr/bin:/bin`, ...env },
          stdout: "piped",
          stderr: "piped",
        }).output();

        assertEquals(result.code, 0, new TextDecoder().decode(result.stderr));
        assertEquals(
          new TextDecoder().decode(result.stdout).trim().split("\n"),
          [
            "start",
            source,
            "--host",
            "0.0.0.0",
            "--port",
            port,
            "--no-open",
            "--keep-alive",
          ],
        );
      } finally {
        await Deno.remove(bin, { recursive: true });
      }
    },
  });
}
