import { assertEquals, assertMatch, assertRejects } from "@std/assert";

import {
  createPreviewShutdownScheduler,
  type StartedPreviewServer,
  startPreviewServer,
} from "./server.ts";
import { createTempMarkdown, removeTempMarkdown } from "./test_helpers.ts";

const wait = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const stopServer = async (preview: StartedPreviewServer): Promise<void> => {
  await preview.server.shutdown().catch(() => {});
  await preview.server.finished.catch(() => {});
};

Deno.test("rejects missing local paths", async () => {
  const directory = await Deno.makeTempDir({ prefix: "sadoku-server-" });
  try {
    await assertRejects(
      () =>
        startPreviewServer({
          file: `${directory}/missing.md`,
          host: "127.0.0.1",
          port: 0,
        }),
      Error,
      "Markdown file or directory not found:",
    );
  } finally {
    await Deno.remove(directory, { recursive: true });
  }
});

Deno.test("starts on an ephemeral port and serves a file as a document session", async () => {
  const filePath = await createTempMarkdown("# Server test\n");
  const logs: string[] = [];
  const preview = await startPreviewServer({
    file: filePath,
    host: "127.0.0.1",
    keepAlive: true,
    log: (message) => logs.push(message),
    port: 0,
  });

  try {
    assertEquals(preview.filePath, filePath);
    assertEquals(preview.url.startsWith("http://127.0.0.1:"), true);
    assertEquals(logs.length, 1);
    assertMatch(
      logs[0],
      new RegExp(`^Registered document: id=\\d+ path=${filePath}$`),
    );

    const documentsResponse = await fetch(
      new URL("/__sadoku/documents", preview.url),
    );
    const documents = await documentsResponse.json();
    assertEquals(documents.length, 1);
    assertEquals(documents[0].relativePath, filePath.split("/").at(-1));
    assertEquals(
      new URL(preview.url).pathname,
      `/documents/${documents[0].id}`,
    );
    for (
      const legacyPath of [
        "/__sadoku/document",
        "/__sadoku/comments",
      ]
    ) {
      assertEquals(
        (await fetch(new URL(legacyPath, preview.url))).status,
        404,
      );
    }

    const response = await fetch(
      new URL(`/__sadoku/documents/${documents[0].id}`, preview.url),
    );
    const document = await response.json();
    assertEquals(response.status, 200);
    assertEquals(document.markdown, "# Server test\n");
  } finally {
    await stopServer(preview);
    await removeTempMarkdown(filePath);
  }
});

Deno.test("increments the port when the requested port is in use", async () => {
  const filePath = await createTempMarkdown("# Port fallback test\n");
  let occupiedPort: number;
  let occupiedListener: Deno.TcpListener;

  while (true) {
    occupiedListener = Deno.listen({ hostname: "127.0.0.1", port: 0 });
    occupiedPort = occupiedListener.addr.port;
    if (occupiedPort < 65535) {
      try {
        const nextPort = Deno.listen({
          hostname: "127.0.0.1",
          port: occupiedPort + 1,
        });
        nextPort.close();
        break;
      } catch (error) {
        occupiedListener.close();
        if (error instanceof Deno.errors.AddrInUse) continue;
        throw error;
      }
    }
    occupiedListener.close();
  }

  let preview: StartedPreviewServer | undefined;
  try {
    preview = await startPreviewServer({
      file: filePath,
      host: "127.0.0.1",
      keepAlive: true,
      port: occupiedPort,
    });

    assertEquals(preview.server.addr.port, occupiedPort + 1);
    assertEquals(
      new URL(preview.url).origin,
      `http://127.0.0.1:${occupiedPort + 1}`,
    );
    assertEquals(new URL(preview.url).pathname.startsWith("/documents/"), true);
  } finally {
    occupiedListener.close();
    if (preview) await stopServer(preview);
    await removeTempMarkdown(filePath);
  }
});

Deno.test("shuts down only after the last event stream closes", async () => {
  let shutdowns = 0;
  const scheduler = createPreviewShutdownScheduler({
    delayMs: 20,
    filePath: "/tmp/example.md",
    shutdown: () => {
      shutdowns += 1;
      return Promise.resolve();
    },
  });

  scheduler.onEventStreamOpen();
  scheduler.onEventStreamOpen();
  scheduler.onEventStreamClose();
  await wait(40);
  assertEquals(shutdowns, 0);

  scheduler.onEventStreamClose();
  await wait(40);
  assertEquals(shutdowns, 1);
});

Deno.test("cancels pending shutdown when an event stream reconnects", async () => {
  let shutdowns = 0;
  const scheduler = createPreviewShutdownScheduler({
    delayMs: 30,
    filePath: "/tmp/example.md",
    shutdown: () => {
      shutdowns += 1;
      return Promise.resolve();
    },
  });

  scheduler.onEventStreamOpen();
  scheduler.onEventStreamClose();
  await wait(10);
  scheduler.onEventStreamOpen();
  await wait(40);
  assertEquals(shutdowns, 0);

  scheduler.onEventStreamClose();
  await wait(50);
  assertEquals(shutdowns, 1);
});

Deno.test("does not schedule shutdown when keepAlive is enabled", async () => {
  let shutdowns = 0;
  const scheduler = createPreviewShutdownScheduler({
    delayMs: 10,
    filePath: "/tmp/example.md",
    keepAlive: true,
    shutdown: () => {
      shutdowns += 1;
      return Promise.resolve();
    },
  });

  scheduler.onEventStreamOpen();
  scheduler.onEventStreamClose();
  await wait(30);

  assertEquals(shutdowns, 0);
});

Deno.test("starts the preview server for a URL source", async () => {
  const source = Deno.serve(
    { hostname: "127.0.0.1", port: 0, onListen: () => {} },
    () => new Response("# Remote server test\n"),
  );
  const sourceUrl = `http://127.0.0.1:${source.addr.port}/remote.md?token=a`;
  const preview = await startPreviewServer({
    file: sourceUrl,
    host: "127.0.0.1",
    keepAlive: true,
    port: 0,
  });

  try {
    assertEquals(preview.filePath, sourceUrl);
    const documents = await (
      await fetch(new URL("/__sadoku/documents", preview.url))
    ).json();
    assertEquals(documents.length, 1);
    assertEquals(documents[0].relativePath, "remote.md");
    assertEquals(
      new URL(preview.url).pathname,
      `/documents/${documents[0].id}`,
    );
    const response = await fetch(
      new URL(`/__sadoku/documents/${documents[0].id}`, preview.url),
    );
    const document = await response.json();

    assertEquals(response.status, 200);
    assertEquals(document.fileUrl, sourceUrl);
    assertEquals(document.markdown, "# Remote server test\n");
  } finally {
    await stopServer(preview);
    await source.shutdown().catch(() => {});
    await source.finished.catch(() => {});
  }
});

Deno.test("GitHub pull head changes invalidate SSE and replace the document list", async () => {
  const encoder = new TextEncoder();
  let headReads = 0;
  const runGitHubCommand = (args: readonly string[]) => {
    const endpoint = args.at(-1)!;
    let value: unknown;
    if (endpoint.endsWith("/pulls/7")) {
      headReads++;
      value = {
        body: "Pull request description",
        head: { sha: headReads === 1 ? "old-sha" : "new-sha" },
        title: "Pull request title",
      };
    } else if (endpoint.includes("/files?")) {
      value = headReads === 1
        ? [{ filename: "old.md", status: "modified" }]
        : [{ filename: "new.md", status: "added" }];
    } else {
      return Promise.resolve({
        code: 0,
        stderr: new Uint8Array(),
        stdout: encoder.encode("# New document\n"),
      });
    }
    return Promise.resolve({
      code: 0,
      stderr: new Uint8Array(),
      stdout: encoder.encode(JSON.stringify(value)),
    });
  };
  const preview = await startPreviewServer({
    file: "https://github.com/octo/repo/pull/7",
    host: "127.0.0.1",
    keepAlive: true,
    port: 0,
    githubPullPollIntervalMs: 100,
    runGitHubCommand,
  });

  try {
    const initial = await (
      await fetch(new URL("/__sadoku/documents", preview.url))
    ).json();
    assertEquals(
      initial.map((item: { relativePath: string }) => item.relativePath),
      [
        "old.md",
      ],
    );
    const events = await fetch(
      new URL(`/__sadoku/documents/${initial[0].id}/events`, preview.url),
    );
    const reader = events.body!.getReader();
    const event = await Promise.race([
      reader.read(),
      wait(2_000).then(() => ({ done: true, value: undefined })),
    ]);
    assertEquals(event.done, false);
    assertEquals(
      new TextDecoder().decode(event.value),
      'event: invalidate\ndata: {"resources":["document","comments"]}\n\n',
    );
    await reader.cancel();

    const refreshed = await (
      await fetch(new URL("/__sadoku/documents", preview.url))
    ).json();
    assertEquals(
      refreshed.map((item: { relativePath: string }) => item.relativePath),
      [
        "new.md",
      ],
    );
    const document = await (
      await fetch(
        new URL(`/__sadoku/documents/${refreshed[0].id}`, preview.url),
      )
    ).json();
    assertEquals(document.markdown, "# New document\n");
  } finally {
    await stopServer(preview);
  }
});

Deno.test("serves pull request Markdown at the head SHA as a multi-document session", async () => {
  const encoder = new TextEncoder();
  const runGitHubCommand = (args: readonly string[]) => {
    const endpoint = args.at(-1)!;
    let output: unknown;
    if (endpoint.endsWith("/pulls/23")) {
      output = {
        body: "Line one\nLine two",
        head: { sha: "fixed-head" },
        title: "Improve docs",
      };
    } else if (endpoint.includes("/pulls/23/files")) {
      output = [
        { filename: "README.md", status: "modified" },
        { filename: "docs/guide.markdown", status: "added" },
        { filename: "deleted.md", status: "removed" },
      ];
    } else if (endpoint.includes("/contents/README.md?ref=fixed-head")) {
      output = "# PR readme\n";
    } else if (
      endpoint.includes("/contents/docs/guide.markdown?ref=fixed-head")
    ) {
      output = "# PR guide\n";
    } else {
      return Promise.resolve({
        code: 1,
        stderr: encoder.encode("not found"),
        stdout: new Uint8Array(),
      });
    }
    return Promise.resolve({
      code: 0,
      stderr: new Uint8Array(),
      stdout: encoder.encode(
        typeof output === "string" ? output : JSON.stringify(output),
      ),
    });
  };
  const preview = await startPreviewServer({
    file: "https://github.com/octo/repo/pull/23?token=must-not-persist",
    runGitHubCommand,
    host: "127.0.0.1",
    keepAlive: true,
    port: 0,
  });

  try {
    assertEquals(new URL(preview.url).pathname, "/");
    const sessionResponse = await fetch(
      new URL("/__sadoku/session", preview.url),
    );
    assertEquals(sessionResponse.status, 200);
    assertEquals(sessionResponse.headers.get("cache-control"), "no-store");
    assertEquals(await sessionResponse.json(), {
      pullRequest: {
        description: "Line one\nLine two",
        number: 23,
        title: "Improve docs",
        url: "https://github.com/octo/repo/pull/23",
      },
    });
    const documents =
      await (await fetch(new URL("/__sadoku/documents", preview.url))).json();
    assertEquals(
      documents.map((document: { relativePath: string }) =>
        document.relativePath
      ),
      ["README.md", "docs/guide.markdown"],
    );
    const contents = await Promise.all(
      documents.map(async (document: { id: number }) =>
        await (await fetch(
          new URL(`/__sadoku/documents/${document.id}`, preview.url),
        )).json()
      ),
    );
    assertEquals(
      contents.map((document: { markdown: string }) => document.markdown),
      ["# PR readme\n", "# PR guide\n"],
    );
    const commentResponse = await fetch(
      new URL(`/__sadoku/documents/${documents[0].id}/comments`, preview.url),
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: "Review this", endLine: 1, startLine: 1 }),
      },
    );
    assertEquals(commentResponse.status, 200);
  } finally {
    await stopServer(preview);
  }
});

Deno.test("keeps the root URL for a directory containing one document", async () => {
  const directory = await Deno.makeTempDir({ prefix: "sadoku-server-" });
  await Deno.writeTextFile(`${directory}/only.md`, "# Only document\n");
  const preview = await startPreviewServer({
    file: directory,
    host: "127.0.0.1",
    keepAlive: true,
    port: 0,
  });

  try {
    let status: { state: string; detected: number; registered: number };
    do {
      status = await (await fetch(
        new URL("/__sadoku/directory-status", preview.url),
      )).json();
      if (status.state === "loading") await wait(5);
    } while (status.state === "loading");
    assertEquals(status, { state: "ready", detected: 1, registered: 1 });
    const documents = await (
      await fetch(new URL("/__sadoku/documents", preview.url))
    ).json();
    assertEquals(documents.length, 1);
    assertEquals(new URL(preview.url).pathname, "/");
  } finally {
    await stopServer(preview);
    await Deno.remove(directory, { recursive: true });
  }
});

Deno.test("server shutdown drains directory background processing", async () => {
  const directory = await Deno.makeTempDir({ prefix: "sadoku-server-stop-" });
  for (let index = 0; index < 40; index += 1) {
    await Deno.writeTextFile(
      `${directory}/${index}.md`,
      `# Document ${index}\n${"content\n".repeat(100)}`,
    );
  }

  const preview = await startPreviewServer({
    file: directory,
    host: "127.0.0.1",
    keepAlive: true,
    port: 0,
  });

  await stopServer(preview);
  // Removing the source immediately after shutdown would race any queue work
  // that had survived the server lifecycle.
  await Deno.remove(directory, { recursive: true });
  await wait(20);
  assertEquals(await Deno.stat(directory).catch(() => undefined), undefined);
});
