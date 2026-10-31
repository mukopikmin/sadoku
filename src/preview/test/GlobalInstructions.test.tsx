import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "./testUtils";
import { GlobalInstructionsDialog } from "../components/GlobalInstructionsDialog";
import { DocumentInstructionsDialog } from "../components/DocumentInstructionsDialog";
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
        instructions: [
          note(
            String(input) === "/__sadoku/global-instructions"
              ? "Shared guidance"
              : "Document guidance",
          ),
        ],
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
  expect(
    (
      (await screen.findByRole("textbox", {
        name: "Instruction",
      })) as HTMLTextAreaElement
    ).value,
  ).toBe("Document guidance");
  expect(screen.getAllByRole("textbox")).toHaveLength(1);
  fireEvent.click(
    screen.getByRole("button", {
      name: "Manage global instructions",
    }),
  );
  expect(manage).toHaveBeenCalledOnce();
});

it("saves and clears a single shared instruction in its own dialog", async () => {
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
  render(<GlobalInstructionsDialog open onOpenChange={() => {}} />);
  const section = within(
    screen.getByRole("dialog", { name: "Global instructions" }),
  );
  const input = (await section.findByRole("textbox", {
    name: "Instruction",
  })) as HTMLTextAreaElement;
  const save = () => section.getByRole("button", { name: "Save instruction" });
  expect(input.value).toBe("");
  expect(section.getByText(/Changes affect every document/)).not.toBeNull();
  fireEvent.change(input, { target: { value: "Shared guidance" } });
  fireEvent.click(save());
  await waitFor(() => expect(save().hasAttribute("disabled")).toBe(true));
  expect(input.value).toBe("Shared guidance");
  fireEvent.change(input, { target: { value: "Updated shared guidance" } });
  fireEvent.click(save());
  await waitFor(() => expect(save().hasAttribute("disabled")).toBe(true));
  expect(input.value).toBe("Updated shared guidance");
  fireEvent.change(input, { target: { value: "" } });
  fireEvent.click(save());
  await waitFor(() => expect(save().hasAttribute("disabled")).toBe(true));
  expect(input.value).toBe("");
  expect(
    fetchMock.mock.calls
      .filter(([, init]) => init?.method)
      .map(([url, init]) => [url, init?.method]),
  ).toEqual([
    ["/__sadoku/global-instructions", "POST"],
    ["/__sadoku/global-instructions/1", "PUT"],
    ["/__sadoku/global-instructions/1", "DELETE"],
  ]);
});
