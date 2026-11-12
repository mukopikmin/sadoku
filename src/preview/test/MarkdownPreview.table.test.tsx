import { afterEach, describe, expect, it, vi } from "vitest";
import type { ActiveComment } from "../models/comment";
import { createComment, fireEvent, screen, waitFor, within } from "./testUtils";
import { renderMarkdown } from "./markdownPreviewTestUtils";

afterEach(() => vi.restoreAllMocks());

const markdown = "| Name | Count |\n| --- | ---: |\n| One | 1 |\n| Two | 2 |";

describe("MarkdownPreview table comments", () => {
  it("floats actions outside the table on small screens and clears them on Escape", async () => {
    vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
      matches: query.includes("0px"),
      media: query,
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent: () => true,
    }));
    const { container } = renderMarkdown(markdown);
    const cell = screen.getByRole("cell", { name: "One" });
    fireEvent.click(cell);
    const actions = await screen.findByLabelText("Comment actions");
    expect(
      within(actions).getByLabelText("Add comment on line 3"),
    ).not.toBeNull();
    expect(screen.getByRole("table").querySelector("button")).toBeNull();
    expect(cell.textContent).toBe("One");
    expect(container.contains(actions)).toBe(false);
    fireEvent.keyDown(actions, { key: "Escape" });
    await waitFor(() =>
      expect(screen.queryByLabelText("Comment actions")).toBeNull(),
    );
  });

  it("opens the row composer from floating actions", async () => {
    vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
      matches: query.includes("0px"),
      media: query,
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent: () => true,
    }));
    renderMarkdown(markdown);
    fireEvent.click(screen.getByRole("cell", { name: "Two" }));
    const actions = await screen.findByLabelText("Comment actions");
    fireEvent.click(within(actions).getByLabelText("Add comment on line 4"));
    expect(
      await screen.findByRole("textbox", { name: "Comment body" }),
    ).not.toBeNull();
    expect(screen.queryByLabelText("Comment actions")).toBeNull();
  });

  it.each([
    ["columnheader", "Name", 1],
    ["cell", "One", 3],
    ["cell", "2", 4],
  ])("comments on the selected %s %s", async (role, name, line) => {
    const onCreateComment = vi.fn(async () => {});
    renderMarkdown(markdown, [], { onCreateComment });
    const cell = screen.getByRole(role, { name });
    const row = cell.closest("tr")!;
    expect(row.getAttribute("data-source-line")).toBe(String(line));
    expect(row.getAttribute("data-source-end-line")).toBe(String(line));

    fireEvent.click(cell);
    fireEvent.click(
      screen.getByRole("button", { name: `Add comment on line ${line}` }),
    );
    const textbox = screen.getByRole("textbox", { name: "Comment body" });
    const threadCell = textbox.closest("td")!;
    expect(threadCell.colSpan).toBe(2);
    expect(threadCell.parentElement?.previousElementSibling).toBe(row);
    expect(screen.getAllByRole("columnheader")).toHaveLength(2);
    expect(screen.getAllByRole("table")).toHaveLength(1);
    fireEvent.change(textbox, { target: { value: "Review this row." } });
    fireEvent.click(screen.getByRole("button", { name: "Add comment" }));
    await waitFor(() =>
      expect(onCreateComment).toHaveBeenCalledWith(
        line,
        "Review this row.",
        line,
      ),
    );
  });

  it.each([
    ["One", "Two", 3, 4],
    ["Two", "One", 3, 4],
    ["Name", "Two", 1, 4],
  ])("selects a range from %s to %s", async (first, last, start, end) => {
    const onCreateComment = vi.fn(async () => {});
    renderMarkdown(markdown, [], { onCreateComment });
    fireEvent.click(screen.getByText(first));
    fireEvent.click(screen.getByText(last), { shiftKey: true });
    const button = screen.getByRole("button", {
      name: `Add comment on lines ${start}-${end}`,
    });
    expect(button.closest("tr")?.getAttribute("data-source-line")).toBe(
      String(end),
    );
    fireEvent.click(button);
    fireEvent.change(screen.getByRole("textbox", { name: "Comment body" }), {
      target: { value: "Review these rows." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add comment" }));
    await waitFor(() =>
      expect(onCreateComment).toHaveBeenCalledWith(
        start,
        "Review these rows.",
        end,
      ),
    );
  });

  it("uses only the selected row for raw Markdown and edit suggestions", async () => {
    renderMarkdown(markdown);
    fireEvent.click(screen.getByRole("cell", { name: "One" }));
    fireEvent.click(
      screen.getByRole("button", { name: "View raw Markdown for line 3" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Raw Markdown — line 3",
    });
    expect(within(dialog).getByText("| One | 1 |")).not.toBeNull();
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fireEvent.click(
      screen.getByRole("button", { name: "Add comment on line 3" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Suggest edit" }));
    expect(
      (
        screen.getByRole("textbox", {
          name: "Comment body",
        }) as HTMLTextAreaElement
      ).value,
    ).toBe("```suggest\n| One | 1 |\n```");
  });

  it("anchors row, separator and legacy whole-table comments without duplicates", () => {
    const comments = [
      createComment({ id: 1, startLine: 3, endLine: 3, body: "Row comment" }),
      createComment({
        id: 2,
        startLine: 1,
        endLine: 4,
        body: "Whole table comment",
      }),
      createComment({
        id: 3,
        startLine: 2,
        endLine: 2,
        body: "Separator comment",
      }),
    ] as ActiveComment[];
    const { container } = renderMarkdown(markdown, comments);
    for (const body of [
      "Row comment",
      "Whole table comment",
      "Separator comment",
    ]) {
      expect(screen.getAllByText(body)).toHaveLength(1);
    }
    expect(
      screen
        .getByText("Row comment")
        .closest("tr")
        ?.previousElementSibling?.getAttribute("data-source-line"),
    ).toBe("3");
    expect(
      screen
        .getByText("Whole table comment")
        .closest("tr")
        ?.previousElementSibling?.getAttribute("data-source-line"),
    ).toBe("4");
    expect(
      screen
        .getByText("Separator comment")
        .closest("tr")
        ?.previousElementSibling?.getAttribute("data-source-line"),
    ).toBe("1");
    expect(
      container.querySelectorAll(
        "table > div, thead > div, tbody > div, tr > div",
      ),
    ).toHaveLength(0);
  });

  it("highlights and selects individual rows without remounting the table", () => {
    const { container } = renderMarkdown(markdown);
    const table = screen.getByRole("table");
    fireEvent.mouseOver(screen.getByText("One"));
    expect(
      container
        .querySelector(".markdown-range-highlight-hover")
        ?.getAttribute("data-start-line"),
    ).toBe("3");
    fireEvent.click(screen.getByText("Two"));
    const highlight = container.querySelector(
      ".markdown-range-highlight-selection",
    );
    expect(highlight?.getAttribute("data-start-line")).toBe("4");
    expect(highlight?.getAttribute("data-end-line")).toBe("4");
    expect(screen.getByRole("table")).toBe(table);
  });
});
