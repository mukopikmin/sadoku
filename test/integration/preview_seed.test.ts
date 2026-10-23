import { assertEquals, assertExists, assertStringIncludes } from "@std/assert";
import { fromFileUrl, join } from "@std/path";
// Cache the CLI's module graph so the subprocess can run without network access.
import "../../src/server/app.ts";
import { openAppDatabase } from "../../src/server/db/connection.ts";
import { createSqliteCommentsStore } from "../../src/server/storage/comment/sqlite_storage.ts";
import { createSqliteDocumentStore } from "../../src/server/storage/document/sqlite_storage.ts";
import { listDocumentRevisions } from "../../src/server/usecase/document/list_document_revisions.ts";
import type { DocumentRevision } from "../../src/server/usecase/document/types.ts";

Deno.test({
  name:
    "preview startup seeds browsable revisions and preserves the current document and comments",
  ignore: Deno.build.os === "windows",
  async fn() {
    const root = await Deno.makeTempDir({
      prefix: "sadoku-preview-seed-test-",
    });
    const fixture = new URL("./fixtures/comprehensive.md", import.meta.url);
    const original = await Deno.readTextFile(fixture);
    try {
      const bin = join(root, "bin");
      await Deno.mkdir(bin);
      const executable = join(bin, "sadoku");
      await Deno.writeTextFile(
        executable,
        '#!/bin/sh\nexec "$SADOKU_TEST_DENO" run --quiet --cached-only --config "$SADOKU_TEST_CONFIG" -P=app "$SADOKU_TEST_MAIN" "$@"\n',
      );
      await Deno.chmod(executable, 0o755);
      const result = await new Deno.Command("sh", {
        args: [
          fromFileUrl(
            new URL("../../scripts/preview_entrypoint.sh", import.meta.url),
          ),
          "sh",
          "-c",
          'printf "%s\\n" "$SADOKU_SOURCE" "$SADOKU_COMMENTS_DIR"',
        ],
        env: {
          PATH: `${bin}:${Deno.env.get("PATH")}`,
          TMPDIR: root,
          SADOKU_SOURCE: "",
          DENO_NO_PACKAGE_JSON: "1",
          SADOKU_TEST_DENO: Deno.execPath(),
          SADOKU_TEST_CONFIG: fromFileUrl(
            new URL("../../deno.json", import.meta.url),
          ),
          SADOKU_TEST_MAIN: fromFileUrl(
            new URL("../../src/main.ts", import.meta.url),
          ),
        },
        stdout: "piped",
        stderr: "piped",
      }).output();
      assertEquals(result.code, 0, new TextDecoder().decode(result.stderr));
      const [source, commentsDirectory] = new TextDecoder().decode(
        result.stdout,
      )
        .trim().split("\n");
      const filePath = join(source, "comprehensive.md");
      assertEquals(await Deno.readTextFile(filePath), original);
      assertEquals(await Deno.readTextFile(fixture), original);

      const database = await openAppDatabase({
        path: join(commentsDirectory, "sadoku.sqlite3"),
      });
      try {
        const documents = createSqliteDocumentStore(database);
        const document = await documents.findByFilePath(filePath);
        assertExists(document);
        const { listRevisions, findRevision } = documents;
        assertExists(listRevisions);
        assertExists(findRevision);
        const all = await listRevisions(document.id, 100);
        assertEquals(all.length, 25);
        const visible = await listDocumentRevisions(document.id, {
          listRevisions,
        });
        assertEquals(visible, all.slice(0, 20));

        // The current fixture was restored after 23 drafts, retaining A → B → A.
        const first = await findRevision(document.id, all.at(-1)!.id);
        assertEquals(first?.markdown, original);
        assertEquals(first?.previousMarkdown, undefined);
        const current = await findRevision(document.id, visible[0].id);
        assertEquals(current?.markdown, original);
        for (let index = 1; index < all.length - 1; index++) {
          const draft: DocumentRevision | undefined = await findRevision(
            document.id,
            all[index].id,
          );
          assertExists(draft);
          assertStringIncludes(draft.markdown, `Review draft ${24 - index}:`);
          const previous = await findRevision(document.id, all[index + 1].id);
          assertEquals(draft.previousMarkdown, previous?.markdown);
        }
        const latestDraft = await findRevision(document.id, all[1].id);
        assertEquals(current?.previousMarkdown, latestDraft?.markdown);

        // The oldest visible draft still compares with a hidden predecessor.
        const oldest = await findRevision(document.id, visible[19].id);
        assertStringIncludes(oldest!.markdown, "Review draft 5:");
        assertStringIncludes(oldest!.previousMarkdown!, "Review draft 4:");

        const comments = await createSqliteCommentsStore(database).read(
          filePath,
        );
        assertEquals(comments.sourceSnapshot, original);
        assertEquals(comments.comments.length, 7);
        assertEquals(
          comments.comments[0].sourceText,
          "# Comprehensive Document",
        );
        assertEquals(comments.comments[0].startLine, 1);
        assertEquals(
          comments.comments.some((comment) => comment.sourceDeleted),
          false,
        );
        assertEquals(await listRevisions(document.id, 100), all);
      } finally {
        database.close();
      }
    } finally {
      await Deno.remove(root, { recursive: true });
    }
  },
});
