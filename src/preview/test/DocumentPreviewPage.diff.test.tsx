import { afterEach, describe, expect, it, vi } from "vitest";
import { DocumentPreviewPage } from "../pages/DocumentPreviewPage";
import {
  cleanup,
  createCommentActions,
  fireEvent,
  render,
  screen,
} from "./testUtils";

vi.mock("../markdown/mermaid", () => ({
  initializeMermaid: vi.fn(async () => {}),
}));
vi.mock("../hooks/useComments", () => ({
  useCommentsQuery: () => ({ data: { comments: [] } }),
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
    instructionCount={0}
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
    ).toContain("Old text");
    expect(
      screen.getByRole("group", { name: "Added content" }).textContent,
    ).toContain("New text");
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
