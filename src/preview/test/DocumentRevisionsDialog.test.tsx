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
  fireEvent.click(dialog.getByRole("tab", { name: "Previous" }));
  expect(await dialog.findByRole("tabpanel", { name: "Previous" }))
    .toHaveProperty("textContent", "");
});
