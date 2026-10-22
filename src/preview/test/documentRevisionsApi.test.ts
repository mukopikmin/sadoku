import { afterEach, expect, it, vi } from "vitest";
import {
  loadDocumentRevision,
  loadDocumentRevisions,
  toDocumentRevision,
  toDocumentRevisions,
  toDocumentRevisionSummary,
} from "../api/documentRevisions";

const recordedAt = "2026-10-22T00:00:00.000Z";
afterEach(() => vi.unstubAllGlobals());

it("converts safe revision IDs and preserves empty saved Markdown", () => {
  expect(toDocumentRevision({ id: 2n, recordedAt, markdown: "" })).toEqual({
    id: 2,
    recordedAt,
    markdown: "",
  });
  expect(
    toDocumentRevisions([{ id: 3n, recordedAt, markdown: "ignored" }, {
      id: 2n,
      recordedAt,
    }]),
  ).toEqual([{ id: 3, recordedAt }, { id: 2, recordedAt }]);
});

it.each([
  null,
  {},
  { id: 0, recordedAt },
  { id: 1.5, recordedAt },
  { id: Number.MAX_SAFE_INTEGER + 1, recordedAt },
  { id: "1", recordedAt },
  { id: 1, recordedAt: "invalid" },
  { id: 1, recordedAt: "2026-02-30T00:00:00.000Z" },
])("rejects malformed saved revision metadata: %j", (value) => {
  expect(() => toDocumentRevisionSummary(value)).toThrow(
    "Invalid saved revision response.",
  );
});

it("rejects oversized, duplicate, and out-of-order revision lists and invalid Markdown", () => {
  for (
    const ids of [
      [2, 2],
      [1, 2],
      Array.from({ length: 21 }, (_, i) => 21 - i),
    ]
  ) {
    expect(() => toDocumentRevisions(ids.map((id) => ({ id, recordedAt }))))
      .toThrow("Invalid saved revisions response.");
  }
  expect(() => toDocumentRevision({ id: 1, recordedAt, markdown: null }))
    .toThrow("Invalid saved revision response.");
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
  expect(requests).toEqual([{ documentId: "7" }, {
    documentId: "7",
    revisionId: "4",
  }]);
});

it("reports missing bodies and rejects a mismatched response ID", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValueOnce(
      Response.json({ code: "not_found", message: "Missing" }, { status: 404 }),
    ).mockResolvedValue(
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
