import { assertEquals, assertRejects } from "@std/assert";
import { fetchPreviewDocument } from "./release_verification.ts";

Deno.test("fetches the release verification document through the document API", async () => {
  const requestedPaths: string[] = [];
  const fetcher = (input: string | URL | Request): Promise<Response> => {
    const url = input instanceof Request ? input.url : input.toString();
    const path = new URL(url).pathname;
    requestedPaths.push(path);
    if (path === "/__sadoku/documents") {
      return Promise.resolve(Response.json([{ id: 42 }]));
    }
    return Promise.resolve(Response.json({ markdown: "# Preview\n" }));
  };

  assertEquals(
    await fetchPreviewDocument("http://127.0.0.1:39731/", fetcher),
    { markdown: "# Preview\n" },
  );
  assertEquals(requestedPaths, [
    "/__sadoku/documents",
    "/__sadoku/documents/42",
  ]);
});

Deno.test("rejects an empty release verification document list", async () => {
  await assertRejects(
    () =>
      fetchPreviewDocument(
        "http://127.0.0.1:39731/",
        () => Promise.resolve(Response.json([])),
      ),
    Error,
    "Preview document list was empty.",
  );
});

Deno.test("reports release verification API failures before parsing JSON", async () => {
  await assertRejects(
    () =>
      fetchPreviewDocument(
        "http://127.0.0.1:39731/",
        () => Promise.resolve(new Response("Not found.", { status: 404 })),
      ),
    Error,
    "Preview document list request failed with 404.",
  );
});
