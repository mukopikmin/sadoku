import { assert, assertEquals, assertNotEquals } from "@std/assert";
import { fromFileUrl, join } from "@std/path";
import { createClient } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";
import { PreviewService } from "../../gen/ts/sadoku/preview/v1/preview_pb.ts";
import { openAppDatabase } from "../../src/server/db/connection.ts";
import { createDirectoryPreviewHandler } from "../../src/server/directory_handler.ts";
import { createDirectorySession } from "../../src/server/directory_session.ts";
import { createSqliteCommentsStore } from "../../src/server/storage/comment/sqlite_storage.ts";
import { createSqliteDocumentStore } from "../../src/server/storage/document/sqlite_storage.ts";
import { createSqliteInstructionStore } from "../../src/server/storage/instruction/sqlite_storage.ts";
import { createSqliteMemoryStore } from "../../src/server/storage/memory/sqlite_storage.ts";
import { serveHandlerInfo } from "../../src/server/test_helpers.ts";

Deno.test({
  name:
    "Cloud Run startup seeds usable review scenarios and isolates each startup",
  ignore: Deno.build.os === "windows",
  async fn() {
    const root = await Deno.makeTempDir({
      prefix: "sadoku preview integration-",
    });
    const databases: Awaited<ReturnType<typeof openAppDatabase>>[] = [];
    try {
      const executable = join(root, "sadoku");
      // Exercise the real CLI during preparation, then inspect its data through
      // the HTTP handler without starting a long-lived server or a browser.
      await Deno.writeTextFile(
        executable,
        `#!/bin/sh
if [ "$1" = start ]; then
  printf '%s\\n' "$2" "$SADOKU_COMMENTS_DIR"
  exit 0
fi
exec "$PREVIEW_TEST_DENO" run --cached-only --no-check --quiet -P=app "$PREVIEW_TEST_MAIN" "$@"
`,
      );
      await Deno.chmod(executable, 0o755);
      const configuredComments = join(root, "configured-comments");
      await Deno.mkdir(configuredComments);
      await Deno.writeTextFile(
        join(configuredComments, "keep.txt"),
        "untouched",
      );

      const startPreview = async () => {
        const result = await new Deno.Command("sh", {
          args: [
            fromFileUrl(
              new URL(
                "../../scripts/cloud_run_preview_entrypoint.sh",
                import.meta.url,
              ),
            ),
          ],
          cwd: fromFileUrl(new URL("../../", import.meta.url)),
          env: {
            PATH: `${root}:/usr/bin:/bin`,
            TMPDIR: root,
            XDG_CONFIG_HOME: join(root, "config"),
            SADOKU_SOURCE: "",
            SADOKU_TRUST_FORWARDED_PREFIX: "false",
            SADOKU_COMMENTS_DIR: configuredComments,
            PREVIEW_TEST_DENO: Deno.execPath(),
            PREVIEW_TEST_MAIN: fromFileUrl(
              new URL("../../src/main.ts", import.meta.url),
            ),
          },
          stdout: "piped",
          stderr: "piped",
        }).output();
        assertEquals(result.code, 0, new TextDecoder().decode(result.stderr));
        const [source, commentsDirectory] = new TextDecoder()
          .decode(result.stdout).trim().split("\n");
        const database = await openAppDatabase({
          path: join(commentsDirectory, "sadoku.sqlite3"),
        });
        databases.push(database);
        const documents = createSqliteDocumentStore(database);
        const session = await createDirectorySession(source, documents);
        const handler = createDirectoryPreviewHandler(
          session,
          createSqliteCommentsStore(database),
          {},
          documents,
          createSqliteInstructionStore(database),
          undefined,
          createSqliteMemoryStore(database),
        );
        const client = createClient(
          PreviewService,
          createConnectTransport({
            baseUrl: "http://127.0.0.1:3334",
            useBinaryFormat: false,
            fetch: async (input, init) =>
              await handler(new Request(input, init), serveHandlerInfo),
          }),
        );
        return { client, source, commentsDirectory };
      };

      const first = await startPreview();
      const { documents } = await first.client.listDocuments({});
      assertEquals(documents.length, 7);
      assertEquals(documents.filter((document) => document.deleted).length, 1);
      const documentId = (relativePath: string) => {
        const document = documents.find((document) =>
          document.relativePath === relativePath
        );
        assert(document, relativePath);
        return document.id;
      };
      const comments = await Promise.all(
        documents.map((document) =>
          first.client.listComments({ documentId: document.id })
        ),
      );
      assertEquals(
        comments.reduce(
          (count, document) => count + document.comments.length,
          0,
        ),
        15,
      );

      const reviewId = documentId("01-review.md");
      const review = await first.client.listComments({ documentId: reviewId });
      assertEquals(review.comments.length, 6);
      assertEquals(review.comments[0].author?.type, "human");
      assertEquals(review.comments[1].author?.type, "bot");
      assertEquals(review.comments[1].replies.length, 2);
      assertEquals(review.comments[1].replies[1].reviewRequested, true);
      assertEquals(review.comments[2].resolved, true);
      assertEquals(review.comments[2].resolvedBy?.type, "human");
      assertEquals(
        (await first.client.listInstructions({ documentId: reviewId }))
          .instructions.length,
        2,
      );
      assertEquals(
        (await first.client.listMemories({ documentId: reviewId })).memories
          .length,
        2,
      );

      const changesId = documentId("02-changes.md");
      const changed = await first.client.getDocument({ documentId: changesId });
      assert(changed.markdown.includes("応答時間の目標は100 msです。"));
      assert(
        changed.previousMarkdown?.includes("応答時間の目標は200 msです。"),
      );
      const changes = await first.client.listComments({
        documentId: changesId,
      });
      assertEquals(
        changes.comments[0].sourceText,
        "応答時間の目標は200 msです。",
      );
      assertEquals(
        changes.comments[0].currentSourceText,
        "応答時間の目標は100 msです。",
      );
      assertEquals(
        changed.markdown.split("\n")[changes.comments[1].startLine - 1],
        "この段落は変更せず、位置だけが移動します。",
      );
      assertEquals(changes.comments[2].sourceDeleted, true);
      assertEquals(changes.comments[2].stale, true);
      assertEquals(changes.comments[3].resolvedBy?.type, "bot");

      const archivedId = documentId("03-archived.md");
      const archived = await first.client.getDocument({
        documentId: archivedId,
      });
      assert(archived.deleted);
      assert(archived.markdown.includes("# 削除済み文書のサンプル"));
      assertEquals(
        (await first.client.listMemories({ documentId: archivedId })).memories
          .length,
        1,
      );
      const emptyId = documentId("04-empty.md");
      assertEquals(
        (await first.client.listComments({ documentId: emptyId })).comments,
        [],
      );
      assertEquals(
        (await first.client.listInstructions({ documentId: emptyId }))
          .instructions,
        [],
      );
      assertEquals(
        (await first.client.listMemories({ documentId: emptyId })).memories,
        [],
      );

      await first.client.createComment({
        documentId: emptyId,
        startLine: 1,
        endLine: 1,
        body: "User-created comment",
      });
      const second = await startPreview();
      assertNotEquals(first.source, second.source);
      assertNotEquals(first.commentsDirectory, second.commentsDirectory);
      const secondEmpty = (await second.client.listDocuments({})).documents
        .find((document) => document.relativePath === "04-empty.md");
      assert(secondEmpty);
      assertEquals(
        (await second.client.listComments({ documentId: secondEmpty.id }))
          .comments,
        [],
      );
      assertEquals(
        (await first.client.listComments({ documentId: emptyId })).comments[0]
          .body,
        "User-created comment",
      );
      assertEquals(
        await Deno.readTextFile(join(configuredComments, "keep.txt")),
        "untouched",
      );
    } finally {
      for (const database of databases) database.close();
      await Deno.remove(root, { recursive: true });
    }
  },
});
