import { afterEach, describe, expect, it, vi } from "vitest";
import { DocumentPreviewPage } from "../pages/DocumentPreviewPage";
import {
  cleanup,
  createComment,
  createCommentActions,
  fireEvent,
  render,
  screen,
  within,
} from "./testUtils";

vi.mock("../markdown/mermaid", () => ({
  initializeMermaid: vi.fn(async () => {}),
}));
vi.mock("../hooks/useComments", () => ({
  useCommentsQuery: () => ({
    data: {
      comments: [
        createComment({
          state: "stale",
          startLine: 1,
          endLine: 1,
          sourceText: "Old text",
          body: "Deleted text review",
        }),
        createComment({
          id: 2,
          state: "resolved",
          startLine: 1,
          endLine: 1,
          sourceText: "Old text",
          body: "Resolved review",
        }),
      ],
    },
  }),
  useCommentActions: () => createCommentActions(),
}));
afterEach(cleanup);

const page = (previousMarkdown?: string) => (
  <DocumentPreviewPage
    document={{
      deleted: false,
      fileUrl: "file:///doc.md",
      markdown: "New text",
      previousMarkdown,
      title: "doc.md",
      tags: [],
    }}
    documentId={1}
    documentNavigationInHeader={false}
    memoryCount={0}
    onChangeView={() => {}}
    onOpenInstructions={() => {}}
    onOpenMemories={() => {}}
    onOpenTags={() => {}}
    onSelectDocument={() => {}}
    onSelectDocuments={() => {}}
    settings={{
      codeWrap: "scroll",
      excludedDirectories: [],
      fontScale: 1,
      showHighlightBoundaries: false,
      markdownExtensions: [".md"],
      maxDepth: 2,
      maxFiles: 20,
      showHtmlComments: true,
      theme: "light",
    }}
    staleCommentCount={0}
    unresolvedCommentCount={0}
    view="preview"
  />
);

describe("document changes option", () => {
  it("passes stale comments to the removed content when changes are shown", () => {
    render(page("Old text"));
    expect(screen.queryByText("Deleted text review")).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Changes since previous snapshot" }),
    );
    expect(
      within(
        screen
          .getByRole("group", { name: "Removed content" })
          .closest(".document-diff-modification")! as HTMLElement,
      ).getByText("Deleted text review"),
    ).not.toBeNull();
    expect(screen.queryByText("Resolved review")).toBeNull();
  });

  it("toggles the rendered diff and line counts from the document action bar", () => {
    render(page("Old text"));
    const toggle = screen.getByRole("button", {
      name: "Changes since previous snapshot",
    });
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    expect(screen.queryByText("Old text")).toBeNull();
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    expect(
      screen.getByRole("group", { name: "Removed content" }).textContent,
    ).toBe("Old");
    expect(
      screen.getByRole("group", { name: "Added content" }).textContent,
    ).toBe("New");
    expect(
      screen.getByRole("status", {
        name: "Changes since previous snapshot: 1 added lines, 1 removed lines",
      }),
    ).not.toBeNull();
    fireEvent.click(toggle);
    expect(screen.queryByText("Old text")).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByText("New text")).not.toBeNull();
  });

  it("disables comparison without a baseline but accepts an empty snapshot", () => {
    const { rerender } = render(page());
    expect(
      screen
        .getByRole("button", { name: "Changes since previous snapshot" })
        .hasAttribute("disabled"),
    ).toBe(true);
    rerender(page(""));
    const toggle = screen.getByRole("button", {
      name: "Changes since previous snapshot",
    });
    expect(toggle.hasAttribute("disabled")).toBe(false);
    fireEvent.click(toggle);
    expect(
      screen.getByRole("group", { name: "Added content" }).textContent,
    ).toContain("New text");
  });
});
