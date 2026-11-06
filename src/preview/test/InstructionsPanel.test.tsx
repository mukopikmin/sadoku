import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "./testUtils";
import { InstructionsPanel } from "../components/InstructionsPanel";
import type { InstructionScope } from "../models/instruction";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it.each<InstructionScope>([
  { type: "document", documentId: 7 },
  { type: "global" },
])(
  "shows saved text and opens an editor only on request for scope %s",
  async (scope) => {
    const path =
      scope.type === "global"
        ? "/__sadoku/global-instructions"
        : `/__sadoku/documents/${scope.documentId}/instructions`;
    const instruction = {
      id: 2,
      content: "First instruction\n\nMiddle instruction\n\nLast instruction",
      createdAt: "created",
      updatedAt: "updated",
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === "PUT") {
          instruction.content = JSON.parse(String(init.body)).content;
          return Response.json(instruction);
        }
        return Response.json({ instructions: [instruction] });
      }),
    );
    render(<InstructionsPanel scope={scope} open />);
    await screen.findByText(/First instruction/);
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Save instruction" }),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Edit instructions" }));
    const input = screen.getByRole("textbox", { name: "Instruction" });
    expect((input as HTMLTextAreaElement).value).toBe(instruction.content);
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Add Instruction" }),
    ).toBeNull();

    fireEvent.change(input, { target: { value: "Updated instruction" } });
    expect(
      vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method),
    ).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Save instruction" }));
    await screen.findByText("Updated instruction");
    expect(screen.queryByRole("textbox")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Edit instructions" }));
    const reopened = screen.getByRole("textbox", { name: "Instruction" });
    fireEvent.change(reopened, { target: { value: "Discard this draft" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByText("Updated instruction")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Edit instructions" }));
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe(
      "Updated instruction",
    );
    expect(fetch).toHaveBeenCalledWith(
      `${path}/2`,
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ content: "Updated instruction" }),
      }),
    );
  },
);
