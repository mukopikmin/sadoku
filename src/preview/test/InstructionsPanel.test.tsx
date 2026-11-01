import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "./testUtils";
import { InstructionsPanel } from "../components/InstructionsPanel";
import type { InstructionScope } from "../models/instruction";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it.each<InstructionScope>([7, "global"])(
  "edits instructions in place for scope %s and keeps their order on cancel and save",
  async (documentId) => {
    const path = documentId === "global"
      ? "/__sadoku/global-instructions"
      : `/__sadoku/documents/${documentId}/instructions`;
    const instructions = [
      "First instruction",
      "Middle instruction",
      "Last instruction",
    ]
      .map((content, index) => ({
        id: index + 1,
        content,
        createdAt: "created",
        updatedAt: "updated",
      }));
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === "PUT") {
          instructions[1].content = JSON.parse(String(init.body)).content;
          return Response.json(instructions[1]);
        }
        return Response.json({ instructions });
      }),
    );
    render(<InstructionsPanel documentId={documentId} open />);
    await screen.findByText("Middle instruction");
    fireEvent.click(screen.getAllByRole("button", { name: "Edit" })[1]);
    const input = screen.getByRole("textbox", { name: "Instruction" });
    expect((input as HTMLTextAreaElement).value).toBe("Middle instruction");
    expect(document.activeElement).toBe(input);
    expect(screen.getAllByText("Middle instruction")).toEqual([input]);
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    expect(
      screen.getByText("First instruction").compareDocumentPosition(input) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0);
    expect(
      input.compareDocumentPosition(screen.getByText("Last instruction")) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0);

    fireEvent.change(input, { target: { value: "Unsaved changes" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByText("Middle instruction")).not.toBeNull();
    expect(vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method))
      .toHaveLength(0);

    fireEvent.click(screen.getAllByRole("button", { name: "Edit" })[1]);
    fireEvent.change(screen.getByRole("textbox", { name: "Instruction" }), {
      target: { value: "Updated middle instruction" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save instruction" }));
    await waitFor(() => expect(screen.queryByRole("textbox")).toBeNull());
    const updated = screen.getByText("Updated middle instruction");
    expect(
      screen.getByText("First instruction").compareDocumentPosition(updated) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0);
    expect(
      updated.compareDocumentPosition(screen.getByText("Last instruction")) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0);
    expect(fetch).toHaveBeenCalledWith(
      `${path}/2`,
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ content: "Updated middle instruction" }),
      }),
    );
  },
);
