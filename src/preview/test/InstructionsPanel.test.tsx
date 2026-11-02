import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "./testUtils";
import { InstructionsPanel } from "../components/InstructionsPanel";
import type { InstructionScope } from "../models/instruction";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it.each<InstructionScope>([7, "global"])(
  "loads the saved text directly into a single editor for scope %s",
  async (documentId) => {
    const path = documentId === "global"
      ? "/__sadoku/global-instructions"
      : `/__sadoku/documents/${documentId}/instructions`;
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
    render(<InstructionsPanel documentId={documentId} open />);
    const input = await screen.findByRole("textbox", { name: "Instruction" });
    expect((input as HTMLTextAreaElement).value).toBe(instruction.content);
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Add Instruction" }))
      .toBeNull();

    fireEvent.change(input, { target: { value: "Updated instruction" } });
    expect(vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method))
      .toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Save instruction" }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Save instruction" }).hasAttribute(
          "disabled",
        ),
      ).toBe(true)
    );
    expect((input as HTMLTextAreaElement).value).toBe("Updated instruction");
    expect(fetch).toHaveBeenCalledWith(
      `${path}/2`,
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ content: "Updated instruction" }),
      }),
    );
  },
);
