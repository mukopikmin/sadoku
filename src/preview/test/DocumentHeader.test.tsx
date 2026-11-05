import type { ComponentProps, FunctionComponent } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { DocumentActionBar } from "../components/DocumentActionBar";
import { DocumentHeader } from "../components/DocumentHeader";
import { DocumentNavigation } from "../components/DocumentNavigation";
import { DocumentTitle } from "../components/DocumentTitle";
import { TableOfContents } from "../pages/markdown/TableOfContents";
import { cleanup, render, screen, within } from "./testUtils";

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
        instructionCount={0}
        memoryCount={0}
        onOpenInstructions={() => {}}
        onOpenMemories={() => {}}
        onOpenRevisions={() => {}}
        onOpenTags={() => {}}
        tagCount={0}
        tags={[]}
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
