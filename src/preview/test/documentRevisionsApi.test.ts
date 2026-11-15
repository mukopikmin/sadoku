import { afterEach, expect, it, vi } from "vitest";
import { create } from "@bufbuild/protobuf";
import {
  DocumentRevisionSchema,
  DocumentRevisionSummarySchema,
} from "../gen/sadoku/preview/v1/preview_pb";
import {
  loadDocumentRevision,
  loadDocumentRevisions,
  restoreDocumentRevision,
  toDocumentRevision,
  toDocumentRevisions,
  toDocumentRevisionSummary,
} from "../api/documentRevisions";

const recordedAt = "2026-10-22T00:00:00.000Z";
afterEach(() => vi.unstubAllGlobals());

it("restores through Connect, preserving empty expected content and server errors", async () => {
  const requests: unknown[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input, init) => {
      const request = new Request(input, init);
      expect(request.url).toContain("/RestoreDocumentRevision");
      requests.push(await request.json());
      return requests.length === 1
        ? Response.json({})
        : Response.json(
            { code: "aborted", message: "The file has changed." },
            {
              status: 409,
            },
          );
    }),
  );
  await restoreDocumentRevision(7, 4, "");
  await expect(restoreDocumentRevision(7, 4, undefined)).rejects.toThrow(
    "The file has changed.",
  );
  expect(requests).toEqual([
    {
      documentId: "7",
      revisionId: "4",
      expectedMarkdown: "",
    },
    { documentId: "7", revisionId: "4" },
  ]);
});

it("converts safe revision IDs and preserves empty saved Markdown", () => {
  expect(
    toDocumentRevision(
      create(DocumentRevisionSchema, { id: 2n, recordedAt, markdown: "" }),
    ),
  ).toEqual({
    id: 2,
    recordedAt,
    markdown: "",
  });
  expect(
    toDocumentRevision(
      create(DocumentRevisionSchema, {
        id: 2n,
        recordedAt,
        markdown: "new",
        previousMarkdown: "",
      }),
    ),
  ).toEqual({
    id: 2,
    recordedAt,
    markdown: "new",
    previousMarkdown: "",
  });
  expect(
    toDocumentRevisions([
      create(DocumentRevisionSchema, {
        id: 3n,
        recordedAt,
        markdown: "ignored",
      }),
      create(DocumentRevisionSummarySchema, { id: 2n, recordedAt }),
    ]),
  ).toEqual([
    { id: 3, recordedAt },
    { id: 2, recordedAt },
  ]);
});

it.each([
  { name: "zero ID", id: 0n, recordedAt },
  {
    name: "unsafe ID",
    id: BigInt(Number.MAX_SAFE_INTEGER) + 1n,
    recordedAt,
  },
  { name: "missing timestamp", id: 1n, recordedAt: "" },
  { name: "malformed timestamp", id: 1n, recordedAt: "invalid" },
  {
    name: "invalid calendar date",
    id: 1n,
    recordedAt: "2026-02-30T00:00:00.000Z",
  },
])("rejects saved revision metadata with $name", ({ id, recordedAt }) => {
  expect(() =>
    toDocumentRevisionSummary(
      create(DocumentRevisionSummarySchema, { id, recordedAt }),
    ),
  ).toThrow("Invalid saved revision response.");
});

it.each([
  { name: "duplicate IDs", ids: [2n, 2n] },
  { name: "out-of-order IDs", ids: [1n, 2n] },
  {
    name: "more than 20 entries",
    ids: Array.from({ length: 21 }, (_, i) => BigInt(21 - i)),
  },
])("rejects revision lists with $name", ({ ids }) => {
  expect(() =>
    toDocumentRevisions(
      ids.map((id) =>
        create(DocumentRevisionSummarySchema, { id, recordedAt }),
      ),
    ),
  ).toThrow("Invalid saved revisions response.");
});

it("requests document-scoped revision metadata and bodies through Connect", async () => {
  const requests: unknown[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input, init) => {
      const request = new Request(input, init);
      requests.push(await request.json());
      return Response.json(
        request.url.endsWith("/ListDocumentRevisions")
          ? { revisions: [{ id: "4", recordedAt }] }
          : { id: "4", recordedAt, markdown: "# Saved" },
      );
    }),
  );
  expect(await loadDocumentRevisions(7)).toEqual([{ id: 4, recordedAt }]);
  expect(await loadDocumentRevision(7, 4)).toEqual({
    id: 4,
    recordedAt,
    markdown: "# Saved",
  });
  expect(requests).toEqual([
    { documentId: "7" },
    {
      documentId: "7",
      revisionId: "4",
    },
  ]);
});

it("reports missing bodies and rejects a mismatched response ID", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(
        Response.json(
          { code: "not_found", message: "Missing" },
          { status: 404 },
        ),
      )
      .mockResolvedValue(
        Response.json({ id: "9", recordedAt, markdown: "wrong" }),
      ),
  );
  await expect(loadDocumentRevision(7, 4)).rejects.toThrow(
    "Failed to load saved revision: 404",
  );
  await expect(loadDocumentRevision(7, 4)).rejects.toThrow(
    "Invalid saved revision response.",
  );
});
