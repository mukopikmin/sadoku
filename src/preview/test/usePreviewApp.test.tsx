import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { usePreviewApp } from "../hooks/usePreviewApp";
import { act, cleanup, renderHook } from "./domTestUtils";

const mocks = vi.hoisted(() => {
  const query = (data: unknown) => ({
    data,
    error: null as Error | null,
    isPending: false,
    isSuccess: true,
    isFetching: false,
    refetch: vi.fn(async () => ({ isSuccess: true })),
  });
  return {
    route: {
      documentId: 7 as number | undefined,
      isDocumentList: false,
      pathname: "/documents/7",
      rawDocumentId: "7" as string | undefined,
      view: "preview" as const,
    },
    documents: query([
      { id: 7, relativePath: "doc.md", title: "doc", tags: [], deleted: false },
    ]),
    document: query({
      markdown: "# Title",
      title: "doc",
      tags: [],
      deleted: false,
    }),
    comments: query({ comments: [], filePath: "doc.md" }),
    directory: query({ state: "ready" }),
    session: query({ canCreateDocuments: true }),
    navigate: vi.fn(),
    saveScroll: vi.fn(),
    clearReload: vi.fn(),
    disconnect: vi.fn(),
    keepAlive: vi.fn(),
    sync: true,
  };
});
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mocks.navigate,
}));
vi.mock("../hooks/usePreviewRoute", () => ({
  usePreviewRoute: () => mocks.route,
}));
vi.mock("../hooks/useDocuments", () => ({
  useDocumentsQuery: () => mocks.documents,
  useDirectoryStatusQuery: () => mocks.directory,
  usePreviewDocumentQuery: () => mocks.document,
}));
vi.mock("../hooks/useComments", () => ({
  useCommentsQuery: () => mocks.comments,
}));
vi.mock("../hooks/useMemories", () => ({
  useMemoriesQuery: () => ({ data: [] }),
}));
vi.mock("../hooks/useSession", () => ({
  useSessionQuery: () => mocks.session,
}));
vi.mock("../hooks/useDocumentCreator", () => ({
  useDocumentCreator: () => ({ state: { status: "closed" }, open: vi.fn() }),
}));
vi.mock("../hooks/usePreviewSettings", () => ({
  usePreviewSettings: () => ({ state: { status: "ready", settings: {} } }),
}));
vi.mock("../hooks/useConnection", () => ({ useConnection: () => false }));
vi.mock("../hooks/useHotReload", () => ({
  useHotReload: () => ({
    reloadAvailable: true,
    clearReloadAvailable: mocks.clearReload,
  }),
}));
vi.mock("../hooks/useScrollPosition", () => ({
  useScrollPosition: () => mocks.saveScroll,
}));
vi.mock("../hooks/useCollapsedDocumentHeader", () => ({
  useCollapsedDocumentHeader: () => ({ collapsed: false }),
}));
vi.mock("../api/hotReload", () => ({
  isSyncEnabled: () => mocks.sync,
  connectPreviewKeepAlive: mocks.keepAlive,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.keepAlive.mockReturnValue(mocks.disconnect);
  mocks.documents.isPending = false;
  mocks.documents.error = null;
  mocks.route.documentId = 7;
  mocks.route.isDocumentList = false;
  mocks.route.rawDocumentId = "7";
  mocks.route.pathname = "/documents/7";
  mocks.sync = true;
  mocks.document.refetch.mockResolvedValue({ isSuccess: true });
  mocks.comments.refetch.mockResolvedValue({ isSuccess: true });
});
afterEach(cleanup);

it("exposes loading, failure, not-found, list and document screens through its return type", () => {
  mocks.documents.isPending = true;
  const { result, rerender } = renderHook(usePreviewApp);
  expect(result.current.status).toBe("loading");
  mocks.documents.isPending = false;
  mocks.documents.error = new Error("Offline");
  rerender();
  expect(result.current).toMatchObject({
    status: "error",
    message: "Error: Offline",
  });
  mocks.documents.error = null;
  mocks.route.rawDocumentId = "bad";
  mocks.route.documentId = undefined;
  rerender();
  expect(result.current.status).toBe("not-found");
  expect(document.title).toBe("Not Found — Sadoku");
  mocks.route.isDocumentList = true;
  mocks.route.pathname = "/";
  rerender();
  expect(result.current.status).toBe("list");
  mocks.route.documentId = 7;
  mocks.route.isDocumentList = false;
  mocks.route.rawDocumentId = "7";
  mocks.route.pathname = "/documents/7";
  rerender();
  expect(result.current.status).toBe("document");
  expect(document.title).toBe("doc — Sadoku");
});

it("clears reload availability only when both refreshes succeed", async () => {
  const { result } = renderHook(usePreviewApp);
  mocks.clearReload.mockClear();
  mocks.comments.refetch.mockResolvedValueOnce({ isSuccess: false });
  if (result.current.status !== "document")
    throw new Error("Expected document");
  await act(result.current.header.onReloadPreview);
  expect(mocks.clearReload).not.toHaveBeenCalled();
  await act(() =>
    result.current.status === "document"
      ? result.current.header.onReloadPreview()
      : Promise.resolve(),
  );
  expect(mocks.clearReload).toHaveBeenCalledOnce();
});

it("refreshes discovery and session without sync, saves scroll before navigation, and releases keepalive", async () => {
  mocks.sync = false;
  const { result, unmount } = renderHook(usePreviewApp);
  if (result.current.status !== "document")
    throw new Error("Expected document");
  await act(result.current.header.onReloadPreview);
  expect(mocks.documents.refetch).toHaveBeenCalled();
  expect(mocks.directory.refetch).toHaveBeenCalled();
  expect(mocks.session.refetch).toHaveBeenCalled();
  act(() => {
    if (result.current.status === "document")
      result.current.page.onSelectDocuments();
  });
  expect(mocks.saveScroll).toHaveBeenCalledOnce();
  expect(mocks.navigate).toHaveBeenCalledWith({ to: "/" });
  unmount();
  expect(mocks.disconnect).toHaveBeenCalledOnce();
});
