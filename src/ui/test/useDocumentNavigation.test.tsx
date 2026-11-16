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
    result.current.setSelectedTagIds([1]);
    result.current.setTagSearch("review");
  });
  expect(result.current.state.filteredDocuments.map(({ id }) => id)).toEqual([
    1,
  ]);
  rerender({ docs: documents.slice(1) });
  expect(result.current.state.activeTagIds).toEqual([]);
  expect(result.current.state.filteredDocuments).toHaveLength(2);
  act(() => result.current.clear());
  expect(result.current.state.tagSearch).toBe("");
  rerender({ docs: [] });
  expect(result.current.state.status).toBe("empty");
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
