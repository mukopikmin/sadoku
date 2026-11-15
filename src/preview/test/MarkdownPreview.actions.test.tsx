import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "./testUtils";
import { renderMarkdown } from "./markdownPreviewTestUtils";

beforeEach(() => {
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
});
afterEach(() => vi.restoreAllMocks());

describe("shared comment actions", () => {
  it.each([
    ["# Heading", "h1", "line 1"],
    ["Paragraph", "p", "line 1"],
    ["- Item", "li .commentable-content", "line 1"],
    ["> Quote", "blockquote", "line 1"],
    ["```ts\nconst value = 1;\n```", "pre", "lines 1-3"],
  ])(
    "floats actions for %s outside the document content",
    async (markdown, selector, label) => {
      const { container } = renderMarkdown(markdown);
      const element = container.querySelector(selector)!;
      fireEvent.click(element);
      // JSDOM has no anchor geometry; browser checks cover visibility and placement.
      const actions = await screen.findByLabelText("Comment actions");
      expect(
        within(actions).getByLabelText(`Add comment on ${label}`),
      ).not.toBeNull();
      expect(container.contains(actions)).toBe(false);
      expect(container.querySelector(".comment-line-gutter")).toBeNull();
      expect(container.querySelector(selector)).toBe(element);
      fireEvent.keyDown(actions, { key: "Escape" });
      await waitFor(() =>
        expect(screen.queryByLabelText("Comment actions")).toBeNull(),
      );
    },
  );

  it.each([
    ["# Heading", "h1", "line 1"],
    ["Paragraph", "p", "line 1"],
    ["- Item", "li .commentable-content", "line 1"],
    ["> Quote", "blockquote", "line 1"],
    ["```ts\nconst value = 1;\n```", "pre", "lines 1-3"],
  ])(
    "portals desktop actions for %s outside the document",
    async (markdown, selector, label) => {
      vi.mocked(window.matchMedia).mockImplementation((query) => ({
        matches: true,
        media: query,
        onchange: null,
        addEventListener() {},
        removeEventListener() {},
        addListener() {},
        removeListener() {},
        dispatchEvent: () => true,
      }));
      const { container } = renderMarkdown(markdown);
      fireEvent.click(container.querySelector(selector)!);
      const actions = await screen.findByLabelText("Comment actions");
      expect(
        within(actions).getByLabelText(`Add comment on ${label}`),
      ).not.toBeNull();
      expect(container.contains(actions)).toBe(false);
      expect(container.querySelector(".comment-line-gutter")).toBeNull();
      fireEvent.keyDown(actions, { key: "Escape" });
      await waitFor(() =>
        expect(screen.queryByLabelText("Comment actions")).toBeNull(),
      );
    },
  );

  it("moves actions to the end of a range and submits its original source lines", async () => {
    const onCreateComment = vi.fn(async () => {});
    const { container } = renderMarkdown("# Heading\n\nParagraph", [], {
      onCreateComment,
    });
    fireEvent.click(container.querySelector("h1")!);
    fireEvent.click(container.querySelector("p")!, { shiftKey: true });
    const actions = await screen.findByLabelText("Comment actions");
    expect(screen.getAllByLabelText("Comment actions")).toHaveLength(1);
    fireEvent.click(within(actions).getByLabelText("Add comment on lines 1-3"));
    expect(screen.queryByLabelText("Comment actions")).toBeNull();
    fireEvent.change(screen.getByRole("textbox", { name: "Comment body" }), {
      target: { value: "Review range" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Add comment", exact: true }),
    );
    await waitFor(() =>
      expect(onCreateComment).toHaveBeenCalledWith(1, "Review range", 3),
    );
  });

  it("keeps heading links available in the floating controls", async () => {
    renderMarkdown("# Heading");
    fireEvent.click(screen.getByRole("heading", { name: "Heading" }));
    const actions = await screen.findByLabelText("Comment actions");
    fireEvent.click(
      within(actions).getByLabelText("Update URL with heading link"),
    );
    expect(location.hash).toBe("#heading");
  });
});
