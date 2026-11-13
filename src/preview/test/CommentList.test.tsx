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
  within(screen.getByRole("group", { name: "Bulk comment actions" })).getByRole(
    "button",
    { name },
  );

const getFilterCheckbox = (name: string) =>
  within(screen.getByRole("group", { name: "Comment filters" })).getByRole(
    "checkbox",
    { name },
  );

const toggleFilter = async (name: string) => {
  const input = getFilterCheckbox(name) as HTMLInputElement;
  const checked = input.checked;
  fireEvent.click(input);
  await waitFor(() => expect(input.checked).toBe(!checked));
};

describe("CommentList", () => {
  it("defaults to unresolved comments, combines states, and clears selection on changes", async () => {
    const comments = [
      createComment({ body: "Active comment." }),
      createComment({ id: 2, state: "stale", body: "Stale comment." }),
      createComment({ id: 3, state: "resolved", body: "Resolved comment." }),
    ];
    const { unmount } = render(
      <CommentList actions={createCommentActions()} comments={comments} />,
    );
    expect(getFilterCheckbox("Active")).toBeChecked();
    expect(getFilterCheckbox("Stale")).toBeChecked();
    expect(getFilterCheckbox("Resolved")).not.toBeChecked();
    expect(screen.queryByText("Resolved comment.")).toBeNull();
    fireEvent.click(screen.getByRole("checkbox", { name: "Select all" }));
    await toggleFilter("Resolved");
    expect(screen.getByRole("status")).toHaveTextContent("0 selected");
    expect(screen.getAllByRole("article")).toHaveLength(3);
    await toggleFilter("Active");
    await toggleFilter("Stale");
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(screen.getByText("Resolved comment.")).toBeInTheDocument();
    await toggleFilter("Resolved");
    expect(screen.queryByRole("article")).toBeNull();
    expect(
      screen.getByText("Select a comment state to show comments."),
    ).toBeInTheDocument();
    unmount();
    render(
      <CommentList actions={createCommentActions()} comments={comments} />,
    );
    expect(screen.getAllByRole("article")).toHaveLength(2);
    expect(getFilterCheckbox("Resolved")).not.toBeChecked();
  });

  it.each([
    ["Active", "stale", "No active unresolved comments."],
    ["Stale", "active", "No stale unresolved comments."],
  ] as const)(
    "keeps filters available when %s has no matches",
    async (filter, state, message) => {
      render(
        <CommentList
          actions={createCommentActions()}
          comments={[createComment({ state })]}
        />,
      );
      await toggleFilter(state === "active" ? "Active" : "Stale");
      expect(screen.getByText(message)).toBeInTheDocument();
      expect(screen.getByText("Showing 0 of 1 comments")).toBeInTheDocument();
      expect(
        screen.queryByRole("group", { name: "Bulk comment actions" }),
      ).not.toBeInTheDocument();
      await toggleFilter(state === "active" ? "Active" : "Stale");
      expect(screen.getAllByRole("article")).toHaveLength(1);
    },
  );

  it("locks controls during bulk actions and keeps failed comments selected", async () => {
    let reject!: (error: Error) => void;
    const pending = new Promise<void>(
      (_resolve, rejectPromise) => (reject = rejectPromise),
    );
    render(
      <CommentList
        actions={createCommentActions({
          onResolveComment: async (id) =>
            id === 1 ? await pending : undefined,
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
      expect(screen.getByRole("status")).toHaveTextContent("2 selected"),
    );
    fireEvent.click(getBulkButton("Resolve"));
    for (const checkbox of screen.getAllByRole("checkbox")) {
      expect(checkbox).toBeDisabled();
    }
    for (const button of screen.getAllByRole("button")) {
      expect(button).toBeDisabled();
    }
    expect(getFilterCheckbox("Resolved")).toBeDisabled();
    await act(async () => reject(new Error("Connection lost.")));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not resolve 1 of 2 selected comments. Connection lost.",
    );
    expect(
      screen.getByRole("checkbox", { name: /Select comment 1:/ }),
    ).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: /Select comment 2:/ }),
    ).not.toBeChecked();
    expect(getBulkButton("Resolve")).toBeEnabled();
  });

  it("selects comments within the current filter and reopens selected comments", async () => {
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
      expect(
        screen.getByRole("checkbox", { name: "Select all" }),
      ).toBePartiallyChecked(),
    );
    expect(screen.getByRole("status")).toHaveTextContent("1 selected");
    fireEvent.click(screen.getByRole("checkbox", { name: "Select all" }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("2 selected"),
    );

    await toggleFilter("Active");
    await toggleFilter("Stale");
    await toggleFilter("Resolved");
    expect(screen.getByRole("status")).toHaveTextContent("0 selected");
    fireEvent.click(screen.getByRole("checkbox", { name: "Select all" }));
    await waitFor(() => expect(getBulkButton("Reopen")).toBeEnabled());
    fireEvent.click(getBulkButton("Reopen"));
    await waitFor(() => expect(onReopenComment.mock.calls).toEqual([[3]]));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("0 selected"),
    );
  });

  it("confirms bulk deletion including replies and allows cancellation", async () => {
    const onDeleteComment = vi.fn().mockResolvedValue(undefined);
    render(
      <CommentList
        actions={createCommentActions({ onDeleteComment })}
        comments={[
          createComment(),
          createComment({ id: 2 }),
          createComment({ id: 3, state: "stale" }),
        ]}
      />,
    );
    await toggleFilter("Stale");
    const filterButtons = screen.getAllByRole("checkbox", {
      name: /^(Active|Stale|Resolved)$/,
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "Select all" }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("2 selected"),
    );
    fireEvent.click(getBulkButton("Delete"));
    const dialog = await screen.findByRole("alertdialog", {
      name: "Delete selected comments?",
    });
    expect(dialog).toHaveTextContent(
      "Delete 2 selected comments and their replies?",
    );
    expect(onDeleteComment).not.toHaveBeenCalled();
    for (const button of filterButtons) expect(button).toBeDisabled();
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

  it("resolves only filtered comments through the API and updates the counts", async () => {
    const comments = [
      createComment(),
      { ...createComment({ id: 2 }), stale: true },
      createComment({ id: 3 }),
    ];
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
    await screen.findByRole("checkbox", { name: "Stale" });
    await toggleFilter("Stale");
    fireEvent.click(
      await screen.findByRole("checkbox", { name: "Select all" }),
    );
    await waitFor(() => expect(getBulkButton("Resolve")).toBeEnabled());
    fireEvent.click(getBulkButton("Resolve"));
    expect(
      await screen.findByText("No active unresolved comments."),
    ).toBeInTheDocument();
    expect(screen.getByText("Showing 0 of 3 comments")).toBeInTheDocument();
    expect(
      within(getFilterCheckbox("Stale").parentElement!).getByText("1"),
    ).toBeInTheDocument();
    await toggleFilter("Resolved");
    expect(screen.getAllByRole("article")).toHaveLength(2);
    expect(screen.getByRole("status")).toHaveTextContent("0 selected");
    const mutations = fetchMock.mock.calls.filter(
      ([, init]) => init?.method === "POST",
    );
    expect(mutations.map(([path]) => path)).toEqual([
      "/__sadoku/documents/42/comments/1/resolve",
      "/__sadoku/documents/42/comments/3/resolve",
    ]);
  });

  it("renders both source versions from the API and hides snapshot text for a deleted document", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          filePath: "/tmp/example.md",
          comments: [
            {
              ...createComment({ sourceText: "**Before**" }),
              currentSourceText: "**After**",
            },
          ],
        }),
      ),
    );
    const { rerender } = render(<CommentListPage documentId={42} />);
    expect(await screen.findByText("After")).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "At comment time" }),
    ).toHaveTextContent("Before");
    expect(screen.getByRole("region", { name: "Current" })).toHaveTextContent(
      "After",
    );
    rerender(<CommentListPage documentId={42} documentDeleted />);
    expect(
      screen.getByText("The target lines have been deleted."),
    ).toBeInTheDocument();
    expect(screen.queryByText("After")).toBeNull();
    expect(screen.getByText("Before")).toBeInTheDocument();
  });

  it("shows default and filtered empty states", async () => {
    render(<CommentList actions={createCommentActions()} comments={[]} />);

    expect(
      screen.getByText("No comments matching the selected states."),
    ).not.toBeNull();
    await toggleFilter("Active");
    await toggleFilter("Stale");
    await toggleFilter("Resolved");
    expect(screen.getByText("No resolved comments.")).not.toBeNull();
  });

  it("passes current and original source ranges to comment actions", async () => {
    const cases = [
      [createComment({ endLine: 5, originalEndLine: 5 }), "Lines 3-5"],
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
        <CommentList actions={createCommentActions()} comments={[comment]} />,
      );

      fireEvent.click(screen.getByRole("button", { name: "More actions" }));
      expect(await screen.findByText(lineLabel)).not.toBeNull();
      cleanup();
    }
  });
});
