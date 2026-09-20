import { describe, expect, it } from "vitest";
import type { DocumentSummary } from "../models/document";
import {
  collectDocumentTags,
  createDocumentTree,
  filterDocumentsByTags,
  filterTagsBySearch,
  getDirectoryValues,
  reconcileSelectedTagIds,
} from "../models/documentTree";

const document = (
  id: number,
  relativePath: string,
  options: Partial<DocumentSummary> = {},
): DocumentSummary => ({
  deleted: false,
  id,
  relativePath,
  tags: [],
  title: relativePath,
  ...options,
});

describe("document tree model", () => {
  it("nests paths and sorts directories before files at every level", () => {
    const root = createDocumentTree([
      document(1, "zeta.md"),
      document(2, "alpha/zeta.md"),
      document(3, "alpha/nested/alpha.md"),
      document(4, "alpha.md"),
      document(5, "beta/alpha.md"),
      document(6, "alpha/beta.md"),
    ]);

    expect(root.children?.map(({ name }) => name)).toEqual([
      "alpha",
      "beta",
      "alpha.md",
      "zeta.md",
    ]);
    expect(root.children?.[0].children?.map(({ name }) => name)).toEqual([
      "nested",
      "beta.md",
      "zeta.md",
    ]);
    expect(root.children?.[0].children?.[0].children?.map(({ name }) => name))
      .toEqual(["alpha.md"]);
    expect(getDirectoryValues(root)).toEqual([
      "directory:alpha",
      "directory:alpha/nested",
      "directory:beta",
    ]);
  });

  it("retains deleted state and tags on document nodes", () => {
    const tags = [{ backgroundColor: "#123456", id: 1, name: "API" }];
    const root = createDocumentTree([
      document(7, "archive/deleted.md", { deleted: true, tags }),
    ]);

    expect(root.children?.[0].children?.[0]).toMatchObject({
      deleted: true,
      documentId: 7,
      name: "deleted.md",
      tags,
      value: "document:7",
    });
  });

  it("collects unique tags by id and sorts them by name", () => {
    const api = { backgroundColor: "#123456", id: 1, name: "API" };
    const guide = { backgroundColor: "#abcdef", id: 2, name: "Guide" };

    expect(collectDocumentTags([
      document(1, "one.md", { tags: [guide, api] }),
      document(2, "two.md", { tags: [api] }),
    ])).toEqual([api, guide]);
  });

  it("filters tags using trimmed, case-insensitive substring matching", () => {
    const tags = [
      { backgroundColor: "#123456", id: 1, name: "API Reference" },
      { backgroundColor: "#abcdef", id: 2, name: "Guide" },
    ];

    expect(filterTagsBySearch(tags, "  referENCE ")).toEqual([tags[0]]);
    expect(filterTagsBySearch(tags, " ")).toBe(tags);
  });

  it("matches documents that have any active tag", () => {
    const documents = [
      document(1, "api.md", {
        tags: [{ backgroundColor: "#123456", id: 1, name: "API" }],
      }),
      document(2, "guide.md", {
        tags: [{ backgroundColor: "#abcdef", id: 2, name: "Guide" }],
      }),
      document(3, "notes.md"),
    ];

    expect(filterDocumentsByTags(documents, [1, 2])).toEqual(
      documents.slice(0, 2),
    );
    expect(filterDocumentsByTags(documents, [])).toBe(documents);
    expect(filterDocumentsByTags(documents, [3])).toEqual([]);
  });

  it("reconciles selected tag ids when available tags change", () => {
    expect(reconcileSelectedTagIds([3, 1, 2], [
      { backgroundColor: "#123456", id: 1, name: "API" },
      { backgroundColor: "#abcdef", id: 2, name: "Guide" },
    ])).toEqual([1, 2]);
  });
});
