import "@testing-library/jest-dom/vitest";
import {
  act,
  cleanup,
  createComment,
  createCommentActions,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "./testUtils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CommentList, CommentListPage } from "../pages/comments/CommentList";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("CommentList", () => {
  it("locks controls during bulk actions and keeps failed comments selected", async () => {
    let reject!: (error: Error) => void;
    const pending = new Promise<void>((_resolve, rejectPromise) =>
      reject = rejectPromise
    );
    render(
      <CommentList
        actions={createCommentActions({
          onResolveComment: async (id) => id === 1 ? await pending : undefined,
        })}
        comments={[createComment(), createComment({ id: 2 })]}
      />,
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "Select all" }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("2 selected")
    );
    fireEvent.click(screen.getByRole("button", { name: "Resolve selected" }));
    for (const checkbox of screen.getAllByRole("checkbox")) {
      expect(checkbox).toBeDisabled();
    }
    for (const button of screen.getAllByRole("button")) {
      expect(button).toBeDisabled();
    }
    expect(screen.getByRole("tab", { name: "Resolved" })).toBeDisabled();
    await act(async () => reject(new Error("Connection lost.")));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not resolve 1 of 2 selected comments. Connection lost.",
    );
    expect(screen.getByRole("checkbox", { name: /Select comment 1:/ }))
      .toBeChecked();
    expect(screen.getByRole("checkbox", { name: /Select comment 2:/ })).not
      .toBeChecked();
    expect(screen.getByRole("button", { name: "Resolve selected" }))
      .toBeEnabled();
  });

  it("selects comments within the current tab and reopens selected comments", async () => {
    const onReopenComment = vi.fn().mockResolvedValue(undefined);
    render(
      <CommentList
        actions={createCommentActions({ onReopenComment })}
        comments={[
          createComment(),
          createComment({ id: 2, state: "stale" }),
          createComment({ id: 3, state: "resolved" }),
        ]}
      />,
    );
    expect(screen.getByRole("button", { name: "Resolve selected" }))
      .toBeDisabled();
    fireEvent.click(
      screen.getByRole("checkbox", { name: /Select comment 1:/ }),
    );
    await waitFor(() =>
      expect(screen.getByRole("checkbox", { name: "Select all" }))
        .toBePartiallyChecked()
    );
    expect(screen.getByRole("status")).toHaveTextContent("1 selected");
    fireEvent.click(screen.getByRole("checkbox", { name: "Select all" }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("2 selected")
    );

    fireEvent.click(screen.getByRole("tab", { name: "Resolved" }));
    expect(screen.getByRole("status")).toHaveTextContent("0 selected");
    fireEvent.click(screen.getByRole("checkbox", { name: "Select all" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Reopen selected" }))
        .toBeEnabled()
    );
    fireEvent.click(screen.getByRole("button", { name: "Reopen selected" }));
    await waitFor(() => expect(onReopenComment.mock.calls).toEqual([[3]]));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("0 selected")
    );
  });

  it("confirms bulk deletion including replies and allows cancellation", async () => {
    const onDeleteComment = vi.fn().mockResolvedValue(undefined);
    render(
      <CommentList
        actions={createCommentActions({ onDeleteComment })}
        comments={[createComment(), createComment({ id: 2 })]}
      />,
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "Select all" }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("2 selected")
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete selected" }));
    const dialog = await screen.findByRole("alertdialog", {
      name: "Delete selected comments?",
    });
    expect(dialog).toHaveTextContent(
      "Delete 2 selected comments and their replies?",
    );
    expect(onDeleteComment).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(onDeleteComment).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("2 selected");

    fireEvent.click(screen.getByRole("button", { name: "Delete selected" }));
    fireEvent.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: "Delete",
      }),
    );
    await waitFor(() => expect(onDeleteComment.mock.calls).toEqual([[1], [2]]));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  });

  it("resolves comments through the API and moves them to the resolved tab", async () => {
    const comments = [createComment(), createComment({ id: 2 })];
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const path = String(input);
        if (path === "/__sadoku/documents/42/comments") {
          return Response.json({ filePath: "/tmp/example.md", comments });
        }
        const match = path.match(/\/comments\/(\d+)\/resolve$/);
        if (match && init?.method === "POST") {
          return Response.json({
            ...comments[Number(match[1]) - 1],
            resolved: true,
          });
        }
        return new Response("Not found.", { status: 404 });
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<CommentListPage documentId={42} />);
    fireEvent.click(
      await screen.findByRole("checkbox", { name: "Select all" }),
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Resolve selected" }))
        .toBeEnabled()
    );
    fireEvent.click(screen.getByRole("button", { name: "Resolve selected" }));
    expect(await screen.findByText("No unresolved comments."))
      .toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Resolved" }));
    expect(screen.getAllByRole("article")).toHaveLength(2);
    expect(screen.getByRole("status")).toHaveTextContent("0 selected");
    const mutations = fetchMock.mock.calls.filter(([, init]) =>
      init?.method === "POST"
    );
    expect(mutations.map(([path]) => path)).toEqual([
      "/__sadoku/documents/42/comments/1/resolve",
      "/__sadoku/documents/42/comments/2/resolve",
    ]);
  });

  it("groups comments, displays counts, and supports tab keyboard navigation", () => {
    const expectSectionOrder = (panel: HTMLElement, title: string) => {
      const heading = within(panel).getByRole("heading", { name: title });
      const selectAll = within(panel).getByRole("checkbox", {
        name: "Select all",
      });
      const firstComment = within(panel).getAllByRole("article")[0];
      expect(
        heading.compareDocumentPosition(selectAll) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      )
        .not.toBe(0);
      expect(
        selectAll.compareDocumentPosition(firstComment) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      )
        .not.toBe(0);
    };
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
    expectSectionOrder(unresolvedPanel, "Unresolved comments");
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
    expectSectionOrder(resolvedPanel, "Resolved comments");
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
