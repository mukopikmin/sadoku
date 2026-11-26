import { afterEach, expect, it, vi } from "vitest";
import { useDocumentTree } from "../hooks/useDocumentTree";
import { useDocumentBreadcrumb } from "../hooks/useDocumentBreadcrumb";
import { useDocumentTreeExpansion } from "../hooks/useDocumentTreeExpansion";
import { act, cleanup, renderHook } from "./domTestUtils";
vi.mock("../components/ui/toaster", () => ({ toaster: { create: vi.fn() } }));
afterEach(cleanup);
const tag = { id: 1, name: "reviewed", backgroundColor: "#123456" };
const documents = [
  {
    id: 1,
    relativePath: "docs/one.md",
    title: "one",
    deleted: false,
    tags: [tag],
  },
  {
    id: 2,
    relativePath: "docs/two.md",
    title: "two",
    deleted: false,
    tags: [],
  },
  { id: 3, relativePath: "root.md", title: "root", deleted: false, tags: [] },
];

it("filters documents, reconciles removed tags and clears search with filters", () => {
  const { result, rerender } = renderHook(({ docs }) => useDocumentTree(docs), {
    initialProps: { docs: documents },
  });
  act(() => {
    result.current.selectTag(1);
    result.current.setTagSearch("review");
  });
  expect(result.current.state.filteredDocuments.map(({ id }) => id)).toEqual([
    1,
  ]);
  rerender({ docs: documents.slice(1) });
  expect(result.current.state.selectedTags).toEqual([]);
  expect(result.current.state.filteredDocuments).toHaveLength(2);
  act(() => result.current.clear());
  expect(result.current.state.tagSearch).toBe("");
  rerender({ docs: [] });
  expect(result.current.state.status).toBe("empty");
});

it("matches directory names and nested paths relative to the document root", () => {
  const nested = {
    id: 4,
    relativePath: "docs/setup/guide.md",
    title: "Guide",
    deleted: false,
    tags: [],
  };
  const docs = [...documents, nested];
  const { result } = renderHook(() => useDocumentTree(docs));

  act(() => result.current.setDocumentSearch(" DOCS "));
  expect(result.current.state.filteredDocuments.map(({ id }) => id)).toEqual([
    1, 2, 4,
  ]);

  act(() => result.current.setDocumentSearch("setup/guide.md"));
  expect(result.current.state.filteredDocuments).toEqual([nested]);
});

it("accepts root-relative prefixes and platform path separators", () => {
  const docs = [
    ...documents,
    { ...documents[0], id: 4, relativePath: "archive/docs/one.md" },
    { ...documents[0], id: 5, relativePath: "docs\\one.md" },
  ];
  const { result } = renderHook(() => useDocumentTree(docs));

  act(() => result.current.setDocumentSearch("./docs/one.md"));
  expect(result.current.state.filteredDocuments.map(({ id }) => id)).toEqual([
    1,
  ]);

  act(() => result.current.setDocumentSearch(".\\docs\\one.md"));
  expect(result.current.state.filteredDocuments.map(({ id }) => id)).toEqual([
    1, 5,
  ]);

  act(() => result.current.setDocumentSearch("docs\\one.md"));
  expect(result.current.state.filteredDocuments.map(({ id }) => id)).toEqual([
    1, 4, 5,
  ]);
});

it("searches tag choices, combines selections and removes only the requested filter", () => {
  const urgent = { ...tag, id: 2, name: "urgent" };
  const docs = documents.map((document) => {
    if (document.id === 2) return { ...document, tags: [urgent] };
    return document;
  });
  const { result } = renderHook(() => useDocumentTree(docs));
  act(() => result.current.setTagSearch(" REVIEW "));
  expect(result.current.state.matchingTags).toEqual([tag]);
  act(() => {
    result.current.selectTag(1);
    result.current.selectTag(2);
  });
  expect(result.current.state.tagSearch).toBe("");
  expect(result.current.state.selectedTags).toEqual([tag, urgent]);
  expect(result.current.state.filteredDocuments.map(({ id }) => id)).toEqual([
    1, 2,
  ]);
  act(() => result.current.setTagSearch("urgent"));
  act(() => result.current.removeTag(1));
  expect(result.current.state.selectedTags).toEqual([urgent]);
  expect(result.current.state.filteredDocuments.map(({ id }) => id)).toEqual([
    2,
  ]);
  expect(result.current.state.tagSearch).toBe("urgent");
  act(() => result.current.clear());
  expect(result.current.state.selectedTags).toEqual([]);
  expect(result.current.state.tagSearch).toBe("");
  expect(result.current.state.filteredDocuments).toEqual(docs);
});

it("deselects a selected tag and clears the search when selecting it again", () => {
  const { result } = renderHook(() => useDocumentTree(documents));
  act(() => result.current.selectTag(1));
  act(() => result.current.setTagSearch("review"));
  act(() => result.current.selectTag(1));
  expect(result.current.state.selectedTags).toEqual([]);
  expect(result.current.state.tagSearch).toBe("");
  expect(result.current.state.filteredDocuments).toEqual(documents);
});

it("lists only immediate directory children and closes before navigating", () => {
  const select = vi.fn();
  const { result } = renderHook(() =>
    useDocumentBreadcrumb(documents[0], documents, select),
  );
  act(() => result.current.openDirectory("docs"));
  expect(result.current.directoryDocuments.map(({ id }) => id)).toEqual([1, 2]);
  act(() => result.current.select(2));
  expect(result.current.state.status).toBe("closed");
  expect(select).toHaveBeenCalledWith(2);
  act(() => result.current.openDirectory("missing"));
  expect(result.current.directoryDocuments).toEqual([]);
});

it("expands directories initially and navigates only when a document is selected", () => {
  const select = vi.fn();
  const tree = renderHook(() => useDocumentTree(documents));
  const root = tree.result.current.state.rootNode;
  const { result } = renderHook(() => useDocumentTreeExpansion(root, select));
  expect(result.current.expandedValue).toContain("directory:docs");
  act(() => result.current.select([root]));
  expect(select).not.toHaveBeenCalled();
  act(() => result.current.select([{ ...root, documentId: 2 }]));
  expect(select).toHaveBeenCalledWith(2);
  act(() => result.current.expand([]));
  expect(result.current.expandedValue).toEqual([]);
});
