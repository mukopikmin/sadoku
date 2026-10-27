import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "./testUtils";
import { DocumentTitle } from "../components/DocumentTitle";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("shows the file title and saves edits without submitting Markdown", async () => {
  const fetch = vi.fn(async () =>
    Response.json({ id: "1", title: "guide.md", displayTitle: "Changed" })
  );
  vi.stubGlobal("fetch", fetch);
  render(<DocumentTitle documentId={1} title="File title" />);
  expect(screen.getByRole("heading", { name: "File title", level: 1 }))
    .toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Edit title" }));
  fireEvent.change(await screen.findByRole("textbox", { name: "Title" }), {
    target: { value: "Changed" },
  });
  fireEvent.click(await screen.findByRole("button", { name: "Save" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  const [input, init] = fetch.mock.calls[0] as unknown as [
    RequestInfo,
    RequestInit,
  ];
  expect(String(input)).toContain("/UpdateDocumentTitle");
  expect(await new Request(input, init).json()).toEqual({
    documentId: "1",
    title: "Changed",
  });
});

it("offers title setup without displaying a heading when unset", () => {
  render(<DocumentTitle documentId={1} />);
  expect(screen.queryByRole("heading")).toBeNull();
  expect(screen.getByRole("button", { name: "Set title" })).toBeTruthy();
});

it("keeps the editor open with an error after a failed save", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({ code: "internal", message: "Save failed" }, {
        status: 500,
      })
    ),
  );
  render(<DocumentTitle documentId={1} title="Existing" />);
  fireEvent.click(screen.getByRole("button", { name: "Edit title" }));
  fireEvent.click(await screen.findByRole("button", { name: "Save" }));
  expect(await screen.findByRole("alert")).toHaveProperty(
    "textContent",
    "Save failed",
  );
  expect(screen.getByRole("dialog")).toBeTruthy();
  expect(await screen.findByRole("textbox", { name: "Title" })).toHaveProperty(
    "value",
    "Existing",
  );
});

it("clears a title by saving an empty value", async () => {
  const fetch = vi.fn(async () =>
    Response.json({ id: "1", title: "guide.md" })
  );
  vi.stubGlobal("fetch", fetch);
  render(<DocumentTitle documentId={1} title="Existing" />);
  fireEvent.click(screen.getByRole("button", { name: "Edit title" }));
  fireEvent.change(await screen.findByRole("textbox", { name: "Title" }), {
    target: { value: "" },
  });
  fireEvent.click(await screen.findByRole("button", { name: "Save" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  const [input, init] = fetch.mock.calls[0] as unknown as [
    RequestInfo,
    RequestInit,
  ];
  const body = await new Request(input, init).json();
  expect(body.documentId).toBe("1");
  expect(body.title ?? "").toBe("");
});
