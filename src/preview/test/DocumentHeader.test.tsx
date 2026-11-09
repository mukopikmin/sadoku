import type { ComponentProps, FunctionComponent } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { DocumentActionBar } from "../components/DocumentActionBar";
import { DocumentHeader } from "../components/DocumentHeader";
import { DocumentNavigation } from "../components/DocumentNavigation";
import { DocumentTitle } from "../components/DocumentTitle";
import { TableOfContents } from "../pages/markdown/TableOfContents";
import { cleanup, fireEvent, render, screen, within } from "./testUtils";

// Observe the real memoized components' render functions, rather than DOM reuse.
const titleComponent = DocumentTitle as typeof DocumentTitle & {
  type: FunctionComponent<ComponentProps<typeof DocumentTitle>>;
};
const tocComponent = TableOfContents as typeof TableOfContents & {
  type: FunctionComponent<ComponentProps<typeof TableOfContents>>;
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("updates view controls without rendering the title or table of contents again", () => {
  const titleRender = vi.spyOn(titleComponent, "type");
  const tocRender = vi.spyOn(tocComponent, "type");
  const header = (
    view: "preview" | "comments",
    title = "Guide",
    markdown = "# Introduction",
  ) => (
    <>
      <DocumentHeader
        documentId={1}
        title={title}
        onOpenTags={() => {}}
        tags={[]}
        trailingAction={
          <DocumentNavigation
            onChangeView={() => {}}
            staleCommentCount={0}
            unresolvedCommentCount={0}
            view={view}
          />
        }
      />
      <DocumentActionBar
        markdown={markdown}
        memoryCount={0}
        onOpenInstructions={() => {}}
        onOpenMemories={() => {}}
        onOpenRevisions={() => {}}
      />
    </>
  );
  const { rerender } = render(header("preview"));
  const titleCalls = titleRender.mock.calls.length;
  const tocCalls = tocRender.mock.calls.length;
  expect(titleCalls).toBeGreaterThan(0);
  expect(tocCalls).toBeGreaterThan(0);
  const tocButton = screen.getByRole("button", { name: "Table of contents" });

  rerender(header("comments"));
  expect(
    screen
      .getByRole("tab", { name: "Comments, 0 unresolved" })
      .getAttribute("aria-selected"),
  ).toBe("true");
  expect(screen.getByRole("button", { name: "Table of contents" })).toBe(
    tocButton,
  );
  expect(titleRender).toHaveBeenCalledTimes(titleCalls);
  expect(tocRender).toHaveBeenCalledTimes(tocCalls);

  rerender(header("preview"));
  expect(titleRender).toHaveBeenCalledTimes(titleCalls);
  expect(tocRender).toHaveBeenCalledTimes(tocCalls);

  rerender(header("preview", "Updated guide", "# Updated introduction"));
  expect(screen.getByRole("heading", { name: "Updated guide" })).toBeTruthy();
  expect(titleRender.mock.calls.length).toBeGreaterThan(titleCalls);
  expect(tocRender.mock.calls.length).toBeGreaterThan(tocCalls);
  expect(
    within(
      screen.getByRole("group", { name: "Document title actions" }),
    ).getByRole("button", { name: "Edit title" }),
  ).toBeTruthy();
});

it("shows tags below the title and keeps the editor available without tags", () => {
  const onOpenTags = vi.fn();
  const header = (tags: ComponentProps<typeof DocumentHeader>["tags"]) => (
    <DocumentHeader
      documentId={1}
      title="Guide"
      tags={tags}
      onOpenTags={onOpenTags}
    />
  );
  const { rerender } = render(
    header([
      { id: 1, name: "reviewed", backgroundColor: "#3182ce" },
      { id: 2, name: "documentation", backgroundColor: "#38a169" },
    ]),
  );
  const region = screen.getByRole("region", { name: "Document header" });
  const tags = within(region).getByRole("group", { name: "Document tags" });
  expect(within(tags).getByText("reviewed")).toBeTruthy();
  expect(within(tags).getByText("documentation")).toBeTruthy();
  expect(
    within(region)
      .getByRole("heading", { name: "Guide" })
      .compareDocumentPosition(tags) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  fireEvent.click(within(tags).getByRole("button", { name: "Edit tags" }));
  expect(onOpenTags).toHaveBeenCalledOnce();

  rerender(header([]));
  expect(screen.queryByText("reviewed")).toBeNull();
  expect(screen.queryByText("documentation")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Add tags" }));
  expect(onOpenTags).toHaveBeenCalledTimes(2);
});
