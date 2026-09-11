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
import { afterEach, describe, expect, it } from "vitest";
import { CommentList } from "../pages/comments/CommentList";

afterEach(cleanup);

describe("CommentList", () => {
  it("groups comments, displays counts, and supports tab keyboard navigation", () => {
    render(
      <CommentList
        actions={createCommentActions()}
        comments={[
          createComment({ body: "Active comment.", id: 1 }),
          createComment({
            body: "Stale comment.",
            id: 2,
            sourceText: "Old body",
            state: "stale",
          }),
          createComment({
            body: "Resolved comment.",
            id: 3,
            state: "resolved",
          }),
        ]}
      />,
    );

    const unresolvedTab = screen.getByRole("tab", { name: "Unresolved" });
    const resolvedTab = screen.getByRole("tab", { name: "Resolved" });
    expect(unresolvedTab.getAttribute("aria-selected")).toBe("true");
    expect(within(unresolvedTab).getByText("2").classList).toContain(
      "chakra-badge",
    );
    expect(within(resolvedTab).getByText("1").classList).toContain(
      "chakra-badge",
    );
    expect(screen.getByRole("heading", { name: "Unresolved comments" }))
      .not.toBeNull();
    const unresolvedPanel = screen.getByRole("tabpanel", {
      name: "Unresolved",
    });
    expect(within(unresolvedPanel).getByText("Active comment.")).not.toBeNull();
    expect(within(unresolvedPanel).getByText("Stale comment.")).not.toBeNull();
    expect(within(unresolvedPanel).getByText("Stale")).not.toBeNull();
    expect(within(unresolvedPanel).getByText("Original line")).not.toBeNull();
    expect(within(unresolvedPanel).getByText("Old body")).not.toBeNull();
    expect(unresolvedPanel.querySelectorAll(".chakra-card__root")).toHaveLength(
      2,
    );

    fireEvent.click(resolvedTab);
    expect(screen.getByRole("heading", { name: "Resolved comments" }))
      .not.toBeNull();
    const resolvedPanel = screen.getByRole("tabpanel", { name: "Resolved" });
    expect(within(resolvedPanel).getByText("Resolved comment.")).not.toBeNull();
    expect(within(resolvedPanel).getByText("Resolved")).not.toBeNull();

    fireEvent.keyDown(resolvedTab, { key: "ArrowLeft" });
    expect(screen.getByRole("tabpanel", { name: "Unresolved" })).not.toBeNull();
    expect(document.activeElement).toBe(unresolvedTab);

    fireEvent.keyDown(unresolvedTab, { key: "ArrowLeft" });
    expect(screen.getByRole("tabpanel", { name: "Resolved" })).not.toBeNull();
  });

  it("shows category-specific empty states", () => {
    render(<CommentList actions={createCommentActions()} comments={[]} />);

    expect(screen.getByText("No unresolved comments.")).not.toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "Resolved" }));
    expect(screen.getByText("No resolved comments.")).not.toBeNull();
  });

  it("passes current and original source ranges to comment actions", async () => {
    render(
      <CommentList
        actions={createCommentActions()}
        comments={[
          createComment({ endLine: 5, originalEndLine: 5 }),
          createComment({
            body: "Moved range.",
            endLine: 8,
            id: 2,
            originalEndLine: 3,
            originalStartLine: 2,
            startLine: 7,
          }),
          createComment({
            body: "Stale range.",
            endLine: 9,
            id: 3,
            originalEndLine: 6,
            originalStartLine: 4,
            state: "stale",
          }),
        ]}
      />,
    );

    const menuButtons = screen.getAllByRole("button", { name: "More actions" });
    fireEvent.click(menuButtons[0]);
    expect(await screen.findByText("Lines 3-5")).not.toBeNull();
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    await waitFor(() => expect(document.activeElement).toBe(menuButtons[0]));

    fireEvent.click(menuButtons[1]);
    expect(await screen.findByText("Lines 7-8 (originally lines 2-3)"))
      .not.toBeNull();
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });

    fireEvent.click(menuButtons[2]);
    expect(await screen.findByText("Originally lines 4-6")).not.toBeNull();
  });
});
