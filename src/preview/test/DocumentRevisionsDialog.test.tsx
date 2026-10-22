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

const recordedAt = "2026-10-22T00:00:00.000Z";
const props = {
  documentId: 7,
  open: true,
  onOpenChange: vi.fn(),
  markdown: "# Current\n\n**New content**",
  showHtmlComments: true,
  theme: "default" as const,
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

it("loads saved bodies only when selected and renders historical and empty Markdown read-only", async () => {
  const bodyRequests: number[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input, init) => {
      const request = new Request(input, init);
      if (request.url.endsWith("/ListDocumentRevisions")) {
        return Response.json({
          revisions: [3, 2, 1].map((id) => ({ id: String(id), recordedAt })),
        });
      }
      const { revisionId } = await request.json();
      bodyRequests.push(Number(revisionId));
      return Response.json({
        id: revisionId,
        recordedAt,
        markdown: Number(revisionId) === 1
          ? ""
          : "# Previous\n\n*Old content*\n\n<script>alert(1)</script>",
      });
    }),
  );
  render(<DocumentRevisionsDialog {...props} />);
  const dialog = within(
    await screen.findByRole("dialog", { name: "Document revisions" }),
  );
  await dialog.findByRole("option", { name: /2 earlier/ });
  expect(dialog.getByRole("heading", { name: "Current" })).not.toBeNull();
  expect(bodyRequests).toEqual([]);
  fireEvent.change(dialog.getByRole("combobox", { name: "Revision" }), {
    target: { value: "2" },
  });
  expect(await dialog.findByRole("heading", { name: "Previous" })).not
    .toBeNull();
  expect(dialog.getByText("Old content").tagName).toBe("EM");
  expect(
    dialog.getByRole("region", { name: "Revision content" }).querySelector(
      "script",
    ),
  ).toBeNull();
  expect(dialog.queryByRole("button", { name: /Add comment/ })).toBeNull();
  fireEvent.change(dialog.getByRole("combobox", { name: "Revision" }), {
    target: { value: "1" },
  });
  await waitFor(() =>
    expect(dialog.getByRole("region", { name: "Revision content" }).textContent)
      .toBe("")
  );
  expect(bodyRequests).toEqual([2, 1]);
  fireEvent.change(dialog.getByRole("combobox", { name: "Revision" }), {
    target: { value: "current" },
  });
  expect(dialog.getByRole("heading", { name: "Current" })).not.toBeNull();
  fireEvent.click(
    dialog.getByRole("button", { name: "Close document revisions" }),
  );
  await waitFor(() => expect(props.onOpenChange).toHaveBeenCalledWith(false));
});

it("keeps the current document visible when there is no saved history", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ revisions: [] })));
  render(<DocumentRevisionsDialog {...props} />);
  expect(await screen.findByText("No saved revisions are available.")).not
    .toBeNull();
  expect(screen.getByRole("heading", { name: "Current" })).not.toBeNull();
  expect(screen.getAllByRole("option")).toHaveLength(1);
});

it("does not fetch while closed and refreshes the list with Current selected when reopened", async () => {
  let newest = 3;
  const fetchMock = vi.fn(async (input, init) => {
    const request = new Request(input, init);
    if (request.url.endsWith("/ListDocumentRevisions")) {
      return Response.json({ revisions: [{ id: String(newest), recordedAt }] });
    }
    return Response.json({ id: "3", recordedAt, markdown: "# Saved" });
  });
  vi.stubGlobal("fetch", fetchMock);
  const { rerender } = render(
    <DocumentRevisionsDialog {...props} open={false} />,
  );
  expect(fetchMock).not.toHaveBeenCalled();
  rerender(<DocumentRevisionsDialog {...props} />);
  await screen.findByRole("option", { name: /Latest saved/ });
  fireEvent.change(screen.getByRole("combobox", { name: "Revision" }), {
    target: { value: "3" },
  });
  await screen.findByRole("heading", { name: "Saved" });
  rerender(<DocumentRevisionsDialog {...props} open={false} />);
  await waitFor(() =>
    expect(screen.queryByRole("dialog", { name: "Document revisions" }))
      .toBeNull()
  );
  newest = 4;
  rerender(<DocumentRevisionsDialog {...props} />);
  await waitFor(() =>
    expect(screen.getByRole("option", { name: /Latest saved/ })).toHaveProperty(
      "value",
      "4",
    )
  );
  expect(screen.getByRole("combobox", { name: "Revision" })).toHaveProperty(
    "value",
    "current",
  );
  expect(screen.getByRole("heading", { name: "Current" })).not.toBeNull();
});

it("explains a history failure and lets the user retry while Current remains available", async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce(
    Response.json({ code: "internal", message: "Unavailable" }, {
      status: 500,
    }),
  ).mockResolvedValue(Response.json({ revisions: [] }));
  vi.stubGlobal("fetch", fetchMock);
  render(<DocumentRevisionsDialog {...props} />);
  expect(await screen.findByRole("alert")).toHaveProperty(
    "textContent",
    "Failed to load saved revisions: 500",
  );
  expect(screen.getByRole("heading", { name: "Current" })).not.toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Retry history" }));
  await screen.findByText("No saved revisions are available.");
});

const selectComparison = async (
  markdown: string,
  saved: string,
  documentPath?: string,
) => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input, init) => {
      const request = new Request(input, init);
      return Response.json(
        request.url.endsWith("/ListDocumentRevisions")
          ? { revisions: [{ id: "1", recordedAt }] }
          : { id: "1", recordedAt, markdown: saved },
      );
    }),
  );
  render(
    <DocumentRevisionsDialog
      {...props}
      markdown={markdown}
      documentPath={documentPath}
    />,
  );
  await screen.findByRole("option", { name: /Latest saved/ });
  fireEvent.change(screen.getByRole("combobox", { name: "Revision" }), {
    target: { value: "1" },
  });
  await waitFor(() =>
    expect(screen.queryByText("Loading revision...")).toBeNull()
  );
  const savedPanel = screen.getByRole("tabpanel", { name: "Saved revision" });
  expect(savedPanel.querySelector("ins, del")).toBeNull();
  fireEvent.click(screen.getByRole("tab", { name: "Current" }));
  await screen.findByRole("switch", { name: "Highlight changes" });
};

it("compares Current with the selected saved baseline and toggles highlights without hiding counts", async () => {
  await selectComparison(
    "# Unchanged\n\nUpdated paragraph\n\n- Kept item\n- Added item\n\nKept paragraph",
    "# Unchanged\n\nOriginal paragraph\n\n- Kept item\n- Removed item\n\nKept paragraph",
  );
  const toggle = screen.getByRole("switch", { name: "Highlight changes" });
  expect(toggle).toHaveProperty("checked", true);
  expect(screen.getByRole("group", {
    name: "Line changes from selected revision: 2 added, 2 removed",
  })).not.toBeNull();
  expect(screen.getByText("Updated paragraph").closest("ins")).not.toBeNull();
  expect(screen.getByText("Added item").closest("ins")).not.toBeNull();
  expect(screen.getByText("Kept item").closest("ins")).toBeNull();
  expect(screen.getByText("Kept paragraph").closest("ins")).toBeNull();
  expect(screen.getByRole("heading", { name: "Unchanged" }).closest("ins"))
    .toBeNull();
  fireEvent.click(toggle);
  await waitFor(() =>
    expect(screen.getByText("Updated paragraph").closest("ins")).toBeNull()
  );
  expect(screen.getByText("+2")).not.toBeNull();
  expect(screen.getByText("-2")).not.toBeNull();
  fireEvent.click(toggle);
  await waitFor(() =>
    expect(screen.getByText("Updated paragraph").closest("ins")).not.toBeNull()
  );
  fireEvent.click(screen.getByRole("tab", { name: "Saved revision" }));
  expect((await screen.findByText("Original paragraph")).closest("del"))
    .toBeNull();
  expect(screen.queryByRole("switch", { name: "Highlight changes" }))
    .toBeNull();
});

it.each([
  { current: "# Same", saved: "# Same", added: 0, removed: 0 },
  { current: "# Current", saved: "", added: 1, removed: 0 },
  {
    current: "# Kept",
    saved: "# Kept\n\nDeleted paragraph",
    added: 0,
    removed: 2,
  },
])(
  "handles identical, empty and deletion-only baselines ($added/$removed)",
  async ({ current, saved, added, removed }) => {
    await selectComparison(current, saved);
    const toggle = screen.getByRole("switch", { name: "Highlight changes" });
    expect(toggle).toHaveProperty("disabled", added + removed === 0);
    const heading = screen.getByRole("heading", { name: current.slice(2) });
    expect(heading.closest("ins") !== null).toBe(added > 0);
    if (added + removed === 0) {
      expect(screen.getByText("No changes from the selected revision.")).not
        .toBeNull();
    } else {
      expect(screen.getByRole("group", {
        name:
          `Line changes from selected revision: ${added} added, ${removed} removed`,
      })).not.toBeNull();
    }
  },
);

it("preserves nested list, table and code highlighting against a saved revision", async () => {
  const saved =
    "- Parent\n  - Same child\n  - Old child\n\n| Name | Value |\n| --- | --- |\n| item | old |\n\n```txt\nold code\n```";
  await selectComparison(
    saved.replace("Parent", "New parent").replace("Old child", "New child")
      .replace("| old |", "| new |").replace("old code", "new code"),
    saved,
  );
  expect(screen.getByText("New parent").closest("ins")).not.toBeNull();
  expect(screen.getByText("Same child").closest("ins")).toBeNull();
  expect(screen.getByText("New child").closest("ins")).not.toBeNull();
  expect(screen.getByRole("table").closest("ins")).not.toBeNull();
  expect((await screen.findByText("new code")).closest("ins")).not.toBeNull();
});

it("compares front matter without shifting body line numbers", async () => {
  await selectComparison(
    "---\nname: example\ndescription: new\n---\n# Kept\n\nNew body",
    "---\nname: example\ndescription: old\n---\n# Kept\n\nOld body",
    "SKILL.md",
  );
  expect(screen.getByTitle("Changed revision metadata").textContent).toBe(
    "descriptionnew",
  );
  expect(screen.getByText("New body").closest("ins")).not.toBeNull();
  expect(screen.getByRole("heading", { name: "Kept" }).closest("ins"))
    .toBeNull();
  fireEvent.click(screen.getByRole("tab", { name: "Saved revision" }));
  expect((await screen.findByText("Old body")).closest("del")).toBeNull();
  expect(screen.queryByTitle("Changed revision metadata")).toBeNull();
});
