import { assertEquals } from "@std/assert";
import {
  buildFileVersion,
  createPreviewHandler,
} from "../../src/preview/server.ts";

Deno.test("builds file version from mtime and size", () => {
  const stat = {
    mtime: new Date(1234),
    size: 42,
  } as Deno.FileInfo;

  assertEquals(buildFileVersion(stat), "1234:42");
});

Deno.test("serves markdown file status for hot reload", async () => {
  const filePath = await Deno.makeTempFile({ suffix: ".md" });
  try {
    await Deno.writeTextFile(filePath, "# one\n");
    const response = await createPreviewHandler(filePath)(
      new Request("http://127.0.0.1:3334/__mdview/status"),
      {} as Deno.ServeHandlerInfo<Deno.NetAddr>,
    );

    assertEquals(response.status, 200);
    assertEquals(response.headers.get("cache-control"), "no-store");
    const body = await response.json();
    assertEquals(typeof body.version, "string");
  } finally {
    await Deno.remove(filePath).catch(() => undefined);
  }
});
