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

const getBulkButton = (name: string) =>
  within(screen.getByRole("group", { name: "Bulk comment actions" }))
    .getByRole("button", { name });

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
    for (const action of ["Resolve", "Delete"]) {
      const button = getBulkButton(action);
      expect(button).toHaveTextContent(new RegExp(`^${action}$`));
      expect(button.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    }
    fireEvent.click(screen.getByRole("checkbox", { name: "Select all" }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("2 selected")
    );
    fireEvent.click(getBulkButton("Resolve"));
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
    expect(getBulkButton("Resolve")).toBeEnabled();
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
    expect(getBulkButton("Resolve")).toBeDisabled();
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
      expect(getBulkButton("Reopen")).toBeEnabled()
    );
    fireEvent.click(getBulkButton("Reopen"));
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
    fireEvent.click(getBulkButton("Delete"));
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

    fireEvent.click(getBulkButton("Delete"));
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
      expect(getBulkButton("Resolve")).toBeEnabled()
    );
    fireEvent.click(getBulkButton("Resolve"));
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

  it("renders both source versions from the API and hides snapshot text for a deleted document", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          filePath: "/tmp/example.md",
          comments: [{
            ...createComment({ sourceText: "**Before**" }),
            currentSourceText: "**After**",
          }],
        })
      ),
    );
    const { rerender } = render(<CommentListPage documentId={42} />);
    expect(await screen.findByText("After")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "At comment time" }))
      .toHaveTextContent("Before");
    expect(screen.getByRole("region", { name: "Current" })).toHaveTextContent(
      "After",
    );
    rerender(<CommentListPage documentId={42} documentDeleted />);
    expect(screen.getByText("The target lines have been deleted."))
      .toBeInTheDocument();
    expect(screen.queryByText("After")).toBeNull();
    expect(screen.getByText("Before")).toBeInTheDocument();
  });

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
    expect(within(unresolvedTab).getByText("2")).not.toBeNull();
    expect(within(resolvedTab).getByText("1")).not.toBeNull();
    const unresolvedPanel = screen.getByRole("tabpanel", {
      name: "Unresolved",
    });
    expect(within(unresolvedPanel).getByText("Active comment.")).not.toBeNull();
    expect(within(unresolvedPanel).getByText("Stale comment.")).not.toBeNull();
    expect(within(unresolvedPanel).getByText("Stale")).not.toBeNull();
    expect(
      within(screen.getByText("Stale comment.").closest("article")!).getByText(
        "At comment time",
      ),
    ).not.toBeNull();
    expect(within(unresolvedPanel).getByText("Old body")).not.toBeNull();
    expect(within(unresolvedPanel).getAllByRole("article")).toHaveLength(2);

    fireEvent.click(resolvedTab);
    const resolvedPanel = screen.getByRole("tabpanel", { name: "Resolved" });
    expect(within(resolvedPanel).getAllByRole("article")).toHaveLength(1);
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
    const cases = [
      [
        createComment({ endLine: 5, originalEndLine: 5 }),
        "Lines 3-5",
      ],
      [
        createComment({
          body: "Moved range.",
          endLine: 8,
          id: 2,
          originalEndLine: 3,
          originalStartLine: 2,
          startLine: 7,
        }),
        "Lines 7-8 (originally lines 2-3)",
      ],
      [
        createComment({
          body: "Stale range.",
          endLine: 9,
          id: 3,
          originalEndLine: 6,
          originalStartLine: 4,
          state: "stale",
        }),
        "Originally lines 4-6",
      ],
    ] as const;

    for (const [comment, lineLabel] of cases) {
      render(
        <CommentList
          actions={createCommentActions()}
          comments={[comment]}
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: "More actions" }));
      expect(await screen.findByText(lineLabel)).not.toBeNull();
      cleanup();
    }
  });
});
