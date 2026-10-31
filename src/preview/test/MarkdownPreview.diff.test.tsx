import { afterEach, describe, expect, it, vi } from "vitest";
import type { ActiveComment } from "../models/comment";
import { MarkdownPreview } from "../pages/markdown/MarkdownPreview";
import {
  cleanup,
  createComment,
  createCommentActions,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "./testUtils";

vi.mock("../markdown/mermaid", () => ({
  initializeMermaid: vi.fn(async () => {}),
}));
afterEach(cleanup);

const preview = (
  markdown: string,
  previousMarkdown?: string,
  documentPath?: string,
) => (
  <MarkdownPreview
    actions={createCommentActions()}
    comments={[]}
    documentPath={documentPath}
    markdown={markdown}
    previousMarkdown={previousMarkdown}
    showHtmlComments
    theme="default"
  />
);

describe("rendered document diff", () => {
  it("shows old content before new content at the change, leaving context unchanged", () => {
    const { container, rerender } = render(
      preview("# Title\n\nNew text\n\nEnd", "# Title\n\nOld text\n\nEnd"),
    );
    const removed = screen.getByRole("group", { name: "Removed content" });
    const added = screen.getByRole("group", { name: "Added content" });
    expect(removed.textContent).toContain("Old text");
    expect(added.textContent).toContain("New text");
    expect(
      removed.compareDocumentPosition(added) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getAllByRole("heading", { name: "Title" })).toHaveLength(1);
    expect(screen.getAllByText("End")).toHaveLength(1);
    expect(removed.querySelector("[data-source-line]")).toBeNull();
    expect(
      container.querySelector('[data-source-line="3"]')?.textContent,
    ).toContain("New text");
    rerender(preview("# Title\n\nNew text\n\nEnd"));
    expect(screen.queryByText("Old text")).toBeNull();
    expect(screen.queryByRole("group", { name: "Added content" })).toBeNull();
  });

  it.each([
    ["", "Removed paragraph", 0, 1],
    ["Added paragraph", "", 1, 0],
    ["Same", "Same", 0, 0],
    ["New\n\nSame\n\nTail", "Old\n\nSame\n\nDeleted tail", 2, 2],
  ])(
    "handles empty sources, unchanged content and separated changes",
    (current, previous, additions, deletions) => {
      render(preview(current, previous));
      expect(
        screen.queryAllByRole("group", { name: "Added content" }),
      ).toHaveLength(additions);
      expect(
        screen.queryAllByRole("group", { name: "Removed content" }),
      ).toHaveLength(deletions);
    },
  );

  it.each([
    ["- New\n  - Nested", "- Old\n  - Nested", "list"],
    ["| Name |\n| --- |\n| New |", "| Name |\n| --- |\n| Old |", "table"],
  ])("keeps changed Markdown structures intact", (current, previous, role) => {
    render(preview(current, previous));
    expect(
      within(
        screen.getByRole("group", { name: "Removed content" }),
      ).getAllByRole(role).length,
    ).toBeGreaterThan(0);
    expect(
      within(screen.getByRole("group", { name: "Added content" })).getAllByRole(
        role,
      ).length,
    ).toBeGreaterThan(0);
  });

  it("preserves reference links when their target changes", () => {
    render(
      preview(
        "[Link][target]\n\n[target]: https://new.example",
        "[Link][target]\n\n[target]: https://old.example",
      ),
    );
    const removed = screen.getByRole("group", { name: "Removed content" });
    const added = screen.getByRole("group", { name: "Added content" });
    expect(
      within(removed).getByRole("link", { name: "Link" }).getAttribute("href"),
    ).toBe("https://old.example");
    expect(
      within(added).getByRole("link", { name: "Link" }).getAttribute("href"),
    ).toBe("https://new.example");
  });

  it("renders changed fenced code and Mermaid as complete old and new blocks", async () => {
    const current =
      "```js\nconst value = 2;\n```\n\n```mermaid\ngraph TD; A-->C;\n```";
    const previous =
      "```js\nconst value = 1;\n```\n\n```mermaid\ngraph TD; A-->B;\n```";
    const { container } = render(preview(current, previous));
    expect(
      screen.getAllByRole("group", { name: "Removed content" }),
    ).toHaveLength(2);
    expect(
      screen.getAllByRole("group", { name: "Added content" }),
    ).toHaveLength(2);
    await waitFor(() =>
      expect(container.textContent).toContain("const value = 2;"),
    );
    expect(
      [...container.querySelectorAll("pre.mermaid")].map(
        (node) => node.textContent,
      ),
    ).toEqual(["graph TD; A-->B;", "graph TD; A-->C;"]);
  });

  it("preserves an unfinished comment when changes are toggled", () => {
    const { container, rerender } = render(preview("New text"));
    fireEvent.click(container.querySelector('[data-source-line="1"] p')!);
    fireEvent.click(
      screen.getByRole("button", { name: "Add comment on line 1" }),
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Comment body" }), {
      target: { value: "Unfinished review" },
    });
    rerender(preview("New text", "Old text"));
    expect(
      (
        screen.getByRole("textbox", {
          name: "Comment body",
        }) as HTMLTextAreaElement
      ).value,
    ).toBe("Unfinished review");
    rerender(preview("New text"));
    expect(
      (
        screen.getByRole("textbox", {
          name: "Comment body",
        }) as HTMLTextAreaElement
      ).value,
    ).toBe("Unfinished review");
  });

  it("renders old agent metadata safely and preserves current body line numbers", () => {
    const { container } = render(
      preview(
        "---\nname: New\n---\n\nBody",
        "---\nname: Old\n---\n\nBody",
        "SKILL.md",
      ),
    );
    expect(
      within(screen.getByRole("group", { name: "Removed content" })).getByText(
        "Old",
      ),
    ).not.toBeNull();
    expect(
      within(screen.getByRole("group", { name: "Added content" })).getByText(
        "New",
      ),
    ).not.toBeNull();
    expect(container.querySelector('[data-source-line="5"]')?.textContent).toBe(
      "Body",
    );
  });

  it("keeps comments attached to current lines and allows commenting on additions", async () => {
    const onCreateComment = vi.fn(async () => {});
    const { container } = render(
      <MarkdownPreview
        actions={createCommentActions({ onCreateComment })}
        comments={[
          createComment({
            id: 1,
            startLine: 3,
            endLine: 3,
            body: "Existing comment",
          }) as ActiveComment,
        ]}
        markdown={"# Title\n\nNew text"}
        previousMarkdown={"# Title\n\nOld text"}
        showHtmlComments
        theme="default"
      />,
    );
    expect(screen.getByText("Existing comment")).not.toBeNull();
    const removed = screen.getByRole("group", { name: "Removed content" });
    fireEvent.click(within(removed).getByText("Old text"));
    expect(screen.queryByRole("button", { name: /Add comment on/ })).toBeNull();
    fireEvent.click(container.querySelector('[data-source-line="3"] p')!);
    fireEvent.click(
      screen.getByRole("button", { name: "Add comment on line 3" }),
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Comment body" }), {
      target: { value: "Review addition" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add comment" }));
    await waitFor(() =>
      expect(onCreateComment).toHaveBeenCalledWith(3, "Review addition", 3),
    );
  });
});
