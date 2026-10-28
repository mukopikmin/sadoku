import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "./testUtils";
import { SettingsDialog } from "../components/SettingsDialog";
import { DocumentInstructionsDialog } from "../components/DocumentInstructionsDialog";
const settings = {
  codeWrap: "scroll",
  theme: "light",
  showHtmlComments: true,
  excludedDirectories: [".git", "node_modules"],
  fontScale: 1,
  maxDepth: 2,
  maxFiles: 20,
  markdownExtensions: [".md"],
} as const;

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const note = (content: string) => ({
  id: 1,
  content,
  createdAt: "created",
  updatedAt: "updated",
});

it("shows global guidance separately from editable document instructions", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) =>
      Response.json({
        instructions: [note(
          String(input) === "/__sadoku/global-instructions"
            ? "Shared guidance"
            : "Document guidance",
        )],
      })
    ),
  );
  const manage = vi.fn();
  render(
    <DocumentInstructionsDialog
      documentId={7}
      open
      onOpenChange={() => {}}
      onOpenGlobalInstructions={manage}
    />,
  );
  expect(await screen.findByText("Shared guidance")).not.toBeNull();
  expect(await screen.findByText("Document guidance")).not.toBeNull();
  expect(screen.getAllByRole("button", { name: "Edit" }))
    .toHaveLength(1);
  fireEvent.click(
    screen.getByRole("button", {
      name: "Manage global instructions in Settings",
    }),
  );
  expect(manage).toHaveBeenCalledOnce();
});

it("creates, edits, and deletes shared guidance from Settings", async () => {
  let instructions: ReturnType<typeof note>[] = [];
  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      if (!String(input).startsWith("/__sadoku/global-instructions")) {
        return Response.json({ state: "unavailable" });
      }
      if (init?.method === "POST" || init?.method === "PUT") {
        instructions = [note(JSON.parse(String(init.body)).content)];
        return Response.json(instructions[0]);
      }
      if (init?.method === "DELETE") {
        instructions = [];
        return new Response(null, { status: 204 });
      }
      return Response.json({ instructions });
    },
  );
  vi.stubGlobal("fetch", fetchMock);
  render(
    <SettingsDialog
      open
      onOpenChange={() => {}}
      settings={{
        ...settings,
        excludedDirectories: [...settings.excludedDirectories],
        markdownExtensions: [...settings.markdownExtensions],
      }}
      onCodeWrapModeChange={() => {}}
      onDirectoryLimitsChange={() => {}}
      onExcludedDirectoriesChange={() => {}}
      onFontScaleChange={() => {}}
      onMarkdownExtensionsChange={() => {}}
      onShowHtmlCommentsChange={() => {}}
      onThemeModeChange={() => {}}
    />,
  );
  const section = within(
    screen.getByRole("region", { name: "Global instructions" }),
  );
  await section.findByText("No instructions have been added.");
  expect(section.getByText(/Changes affect every document/)).not.toBeNull();
  fireEvent.click(section.getByRole("button", { name: "Add Instruction" }));
  fireEvent.change(section.getByRole("textbox", { name: "Instruction" }), {
    target: { value: "Shared guidance" },
  });
  fireEvent.click(section.getByRole("button", { name: "Save instruction" }));
  await section.findByText("Shared guidance");
  await waitFor(() => expect(section.queryByRole("textbox")).toBeNull());
  fireEvent.click(section.getByRole("button", { name: "Edit" }));
  fireEvent.change(section.getByRole("textbox", { name: "Instruction" }), {
    target: { value: "Updated shared guidance" },
  });
  fireEvent.click(section.getByRole("button", { name: "Save instruction" }));
  await section.findByText("Updated shared guidance");
  await waitFor(() => expect(section.queryByRole("textbox")).toBeNull());
  fireEvent.click(section.getByRole("button", { name: "Delete" }));
  const confirm = await screen.findByRole("alertdialog", {
    name: "Delete instruction?",
  });
  expect(within(confirm).getByText(/deleted for all documents/)).not.toBeNull();
  expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "DELETE"))
    .toHaveLength(0);
  fireEvent.click(
    within(confirm).getByRole("button", {
      name: "Delete instruction",
    }),
  );
  await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  await section.findByText("No instructions have been added.");
  expect(
    fetchMock.mock.calls.filter(([, init]) => init?.method).map((
      [url, init],
    ) => [url, init?.method]),
  )
    .toEqual([["/__sadoku/global-instructions", "POST"], [
      "/__sadoku/global-instructions/1",
      "PUT",
    ], ["/__sadoku/global-instructions/1", "DELETE"]]);
});
