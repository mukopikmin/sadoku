import { assertEquals } from "@std/assert";
import { dirname, fromFileUrl, join, relative } from "@std/path";
import { openAppDatabase } from "../src/server/db/connection.ts";
import { createSqliteDocumentStore } from "../src/server/storage/document/sqlite_storage.ts";
import { createSqliteTagStore } from "../src/server/storage/tag/sqlite_storage.ts";

Deno.test({
  name: "preview seed creates shared, archived, unused, and untagged samples",
  ignore: Deno.build.os === "windows",
  async fn() {
    const root = await Deno.makeTempDir({ prefix: "sadoku-preview-seed-" });
    const repository = fromFileUrl(new URL("../", import.meta.url));
    try {
      const bin = join(root, "bin");
      await Deno.mkdir(bin);
      const executable = join(bin, "sadoku");
      await Deno.writeTextFile(
        executable,
        `#!/bin/sh
exec "$SEED_DENO" run --quiet --no-prompt -P=app "$SEED_MAIN" "$@"
`,
      );
      await Deno.chmod(executable, 0o755);
      const result = await new Deno.Command("sh", {
        args: [join(repository, "scripts/preview_seed.sh"), root],
        cwd: repository,
        env: {
          PATH: `${bin}:${dirname(Deno.execPath())}:${Deno.env.get("PATH")}`,
          DENO_NO_PACKAGE_JSON: "1",
          SADOKU_COMMENTS_DIR: join(root, "comments"),
          SEED_DENO: Deno.execPath(),
          SEED_MAIN: join(repository, "src/main.ts"),
        },
        stdout: "piped",
        stderr: "piped",
      }).output();
      assertEquals(result.code, 0, new TextDecoder().decode(result.stderr));

      const database = await openAppDatabase({
        path: join(root, "comments/sadoku.sqlite3"),
      });
      try {
        const tags = createSqliteTagStore(database);
        assertEquals(
          (await tags.list()).map(({ name, documentCount }) => ({
            name,
            documentCount,
          })),
          [
            { name: "Archived", documentCount: 1 },
            { name: "Markdown", documentCount: 2 },
            { name: "Needs review", documentCount: 2 },
            { name: "Unassigned", documentCount: 0 },
          ],
        );
        const documents = await createSqliteDocumentStore(database).list();
        const documentTags: Record<string, string[]> = {};
        for (const document of documents) {
          documentTags[relative(join(root, "documents"), document.filePath)] =
            (await tags.listForDocument(document.id)).map(({ name }) => name);
        }
        assertEquals(documentTags, {
          "comprehensive.md": ["Markdown", "Needs review"],
          "second.md": ["Needs review"],
          "japanese.md": ["Markdown"],
          "guides/overview.md": ["Archived"],
          "guides/setup/local.md": [],
        });
        assertEquals(
          await Deno.stat(join(root, "documents/guides/overview.md"))
            .then(() => true, () => false),
          false,
        );
      } finally {
        database.close();
      }
    } finally {
      await Deno.remove(root, { recursive: true });
    }
  },
});
