import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "./testUtils";
import { DocumentRevisionsDialog } from "../components/DocumentRevisionsDialog";

afterEach(cleanup);

it("renders current and previous Markdown and closes the revision dialog", async () => {
  const onOpenChange = vi.fn();
  render(
    <DocumentRevisionsDialog
      open
      onOpenChange={onOpenChange}
      markdown={"# Current\n\n**New content**"}
      previousMarkdown={"# Previous\n\n*Old content*\n\n<script>alert(1)</script>"}
      showHtmlComments
      theme="default"
    />,
  );
  const dialog = within(
    await screen.findByRole("dialog", { name: "Document revisions" }),
  );
  expect(dialog.getByRole("heading", { name: "Current" })).not.toBeNull();
  expect(dialog.getByText("New content").tagName).toBe("STRONG");
  expect(dialog.queryByRole("button", { name: "View source diff" })).toBeNull();
  fireEvent.click(dialog.getByRole("tab", { name: "Previous" }));
  expect(await dialog.findByRole("heading", { name: "Previous" })).not
    .toBeNull();
  expect(dialog.getByText("Old content").tagName).toBe("EM");
  await waitFor(() =>
    expect(dialog.queryByRole("heading", { name: "Current" })).toBeNull()
  );
  expect(screen.getByRole("dialog").querySelector("script")).toBeNull();
  expect(dialog.queryByRole("button", { name: /Add comment/ })).toBeNull();
  fireEvent.click(dialog.getByRole("tab", { name: "Current" }));
  expect(await dialog.findByRole("heading", { name: "Current" })).not
    .toBeNull();
  fireEvent.click(
    dialog.getByRole("button", { name: "Close document revisions" }),
  );
  await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
});

it("explains missing history while keeping the current rendering available", async () => {
  render(
    <DocumentRevisionsDialog
      open
      onOpenChange={() => {}}
      markdown="# Current"
      showHtmlComments
      theme="dark"
    />,
  );
  const dialog = within(await screen.findByRole("dialog"));
  expect(dialog.getByRole("tab", { name: "Previous" })).toHaveProperty(
    "disabled",
    true,
  );
  expect(dialog.getByText("No previous revision is available.")).not.toBeNull();
  expect(dialog.queryByRole("switch", { name: "Highlight changes" }))
    .toBeNull();
  expect(dialog.getByRole("heading", { name: "Current" })).not.toBeNull();
});

it("allows a previous revision that was empty", async () => {
  render(
    <DocumentRevisionsDialog
      open
      onOpenChange={() => {}}
      markdown="# Current"
      previousMarkdown=""
      showHtmlComments
      theme="default"
    />,
  );
  const dialog = within(await screen.findByRole("dialog"));
  expect(dialog.getByRole("heading", { name: "Current" }).closest("ins")).not
    .toBeNull();
  fireEvent.click(dialog.getByRole("tab", { name: "Previous" }));
  expect(await dialog.findByRole("tabpanel", { name: "Previous" }))
    .toHaveProperty("textContent", "");
});

it("highlights Current relative to Previous and keeps the comparison baseline plain", async () => {
  render(
    <DocumentRevisionsDialog
      open
      onOpenChange={() => {}}
      markdown={"# Unchanged\n\nUpdated paragraph\n\n- Kept item\n- Added item\n\nKept paragraph"}
      previousMarkdown={"# Unchanged\n\nOriginal paragraph\n\n- Kept item\n- Removed item\n\nKept paragraph"}
      showHtmlComments
      theme="default"
    />,
  );
  const dialog = within(await screen.findByRole("dialog"));
  const toggle = dialog.getByRole("switch", { name: "Highlight changes" });
  expect(toggle).toHaveProperty("checked", true);
  const lineChanges = within(dialog.getByRole("group", {
    name: "Line changes from Previous: 2 added, 2 removed",
  }));
  expect(lineChanges.getByText("+2")).not.toBeNull();
  expect(lineChanges.getByText("-2")).not.toBeNull();
  expect(dialog.getByText("Updated paragraph").closest("ins")).not.toBeNull();
  expect(dialog.getByText("Added item").closest("ins")).not.toBeNull();
  expect(dialog.getByText("Kept item").closest("ins")).toBeNull();
  expect(dialog.getByText("Kept paragraph").closest("ins")).toBeNull();
  expect(dialog.getByRole("heading", { name: "Unchanged" }).closest("ins"))
    .toBeNull();

  fireEvent.click(dialog.getByRole("tab", { name: "Previous" }));
  expect((await dialog.findByText("Original paragraph")).closest("del"))
    .toBeNull();
  expect(dialog.getByText("Removed item").closest("del")).toBeNull();
  expect(dialog.getByText("Kept item").closest("del")).toBeNull();
  expect(dialog.queryByRole("switch", { name: "Highlight changes" }))
    .toBeNull();

  fireEvent.click(dialog.getByRole("tab", { name: "Current" }));
  const currentToggle = await dialog.findByRole("switch", {
    name: "Highlight changes",
  });
  fireEvent.click(currentToggle);
  await waitFor(() => {
    expect(currentToggle).toHaveProperty("checked", false);
    expect(dialog.getByText("Updated paragraph").closest("ins")).toBeNull();
  });
  fireEvent.click(currentToggle);
  await waitFor(() =>
    expect(dialog.getByText("Updated paragraph").closest("ins")).not.toBeNull()
  );
});

it("keeps unchanged nested list items clear and preserves tables and code rendering", async () => {
  const previous =
    "- Parent\n  - Same child\n  - Old child\n\n| Name | Value |\n| --- | --- |\n| item | old |\n\n```txt\nold code\n```";
  render(
    <DocumentRevisionsDialog
      open
      onOpenChange={() => {}}
      markdown={previous.replace("Parent", "New parent").replace(
        "Old child",
        "New child",
      ).replace("| old |", "| new |").replace("old code", "new code")}
      previousMarkdown={previous}
      showHtmlComments
      theme="dark"
    />,
  );
  const dialog = within(await screen.findByRole("dialog"));
  expect(dialog.getByText("New parent").closest("ins")).not.toBeNull();
  expect(dialog.getByText("Same child").closest("ins")).toBeNull();
  expect(dialog.getByText("New child").closest("ins")).not.toBeNull();
  expect(dialog.getByRole("table").closest("ins")).not.toBeNull();
  expect(dialog.getByRole("cell", { name: "new" })).not.toBeNull();
  const code = await dialog.findByText("new code");
  expect(code.closest("pre")).not.toBeNull();
  expect(code.closest("ins")).not.toBeNull();
});

it("explains identical revisions and disables the highlight toggle", async () => {
  render(
    <DocumentRevisionsDialog
      open
      onOpenChange={() => {}}
      markdown="# Same"
      previousMarkdown="# Same"
      showHtmlComments
      theme="default"
    />,
  );
  const dialog = within(await screen.findByRole("dialog"));
  expect(dialog.getByText("No changes since the previous revision.")).not
    .toBeNull();
  expect(dialog.getByRole("switch", { name: "Highlight changes" }))
    .toHaveProperty("disabled", true);
  expect(dialog.getByRole("heading", { name: "Same" }).closest("ins"))
    .toBeNull();
});

it("highlights front matter changes without shifting body line numbers", async () => {
  render(
    <DocumentRevisionsDialog
      open
      documentPath="SKILL.md"
      onOpenChange={() => {}}
      markdown={"---\nname: example\ndescription: new\n---\n# Kept\n\nNew body"}
      previousMarkdown={"---\nname: example\ndescription: old\n---\n# Kept\n\nOld body"}
      showHtmlComments
      theme="default"
    />,
  );
  const dialog = within(await screen.findByRole("dialog"));
  expect(dialog.getByTitle("Changed revision metadata").textContent).toBe(
    "descriptionnew",
  );
  expect(dialog.getByText("New body").closest("ins")).not.toBeNull();
  expect(dialog.getByRole("heading", { name: "Kept" }).closest("ins"))
    .toBeNull();
  fireEvent.click(dialog.getByRole("tab", { name: "Previous" }));
  expect((await dialog.findByText("Old body")).closest("del")).toBeNull();
  const previousPanel = await dialog.findByRole("tabpanel", {
    name: "Previous",
  });
  expect(within(previousPanel).queryByTitle("Changed revision metadata"))
    .toBeNull();
});

it("reports removed lines without marking surviving content", async () => {
  render(
    <DocumentRevisionsDialog
      open
      onOpenChange={() => {}}
      markdown="# Kept"
      previousMarkdown={"# Kept\n\nDeleted paragraph"}
      showHtmlComments
      theme="default"
    />,
  );
  const dialog = within(await screen.findByRole("dialog"));
  expect(dialog.getByRole("switch", { name: "Highlight changes" }))
    .toHaveProperty("disabled", false);
  expect(dialog.getByRole("heading", { name: "Kept" }).closest("ins"))
    .toBeNull();
  const lineChanges = within(dialog.getByRole("group", {
    name: "Line changes from Previous: 0 added, 2 removed",
  }));
  expect(lineChanges.getByText("+0")).not.toBeNull();
  expect(lineChanges.getByText("-2")).not.toBeNull();
  fireEvent.click(dialog.getByRole("tab", { name: "Previous" }));
  expect((await dialog.findByText("Deleted paragraph")).closest("del"))
    .toBeNull();
});
