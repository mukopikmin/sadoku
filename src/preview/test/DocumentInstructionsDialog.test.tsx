import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "./testUtils";
import { DocumentInstructionsDialog } from "../components/DocumentInstructionsDialog";

const path = "/__sadoku/documents/7/instructions";
const input = () =>
  screen.getByRole("textbox", { name: "Instruction" }) as HTMLTextAreaElement;
const save = () => screen.getByRole("button", { name: "Save instruction" });

describe("DocumentInstructionsDialog", () => {
  beforeEach(() => {
    let instructions: {
      id: number;
      content: string;
      createdAt: string;
      updatedAt: string;
    }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
        if (String(url) === "/__sadoku/global-instructions") {
          return Response.json({ instructions: [] });
        }
        if (init?.method === "POST" || init?.method === "PUT") {
          instructions = [
            {
              id: 1,
              ...JSON.parse(String(init.body)),
              createdAt: "created",
              updatedAt: "updated",
            },
          ];
          return Response.json(instructions[0]);
        }
        if (init?.method === "DELETE") {
          instructions = [];
          return new Response(null, { status: 204 });
        }
        return Response.json({ instructions });
      }),
    );
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("edits a single text value and clears it by saving an empty value", async () => {
    render(
      <DocumentInstructionsDialog
        documentId={7}
        open
        onOpenChange={() => {}}
      />,
    );
    await screen.findByRole("textbox", { name: "Instruction" });
    expect(input().value).toBe("");
    expect(save().hasAttribute("disabled")).toBe(true);
    expect(
      screen.queryByRole("button", { name: "Add Instruction" }),
    ).toBeNull();
    fireEvent.change(input(), { target: { value: "Use short paragraphs." } });
    expect(
      vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method),
    ).toHaveLength(0);
    fireEvent.click(save());
    await waitFor(() => expect(save().hasAttribute("disabled")).toBe(true));
    expect(input().value).toBe("Use short paragraphs.");
    expect(fetch).toHaveBeenCalledWith(
      path,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ content: "Use short paragraphs." }),
      }),
    );
    fireEvent.change(input(), { target: { value: "Updated instruction" } });
    fireEvent.click(save());
    await waitFor(() => expect(save().hasAttribute("disabled")).toBe(true));
    expect(input().value).toBe("Updated instruction");
    expect(fetch).toHaveBeenCalledWith(
      `${path}/1`,
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ content: "Updated instruction" }),
      }),
    );
    fireEvent.change(input(), { target: { value: "" } });
    fireEvent.click(save());
    await waitFor(() => expect(save().hasAttribute("disabled")).toBe(true));
    expect(input().value).toBe("");
    expect(fetch).toHaveBeenCalledWith(`${path}/1`, { method: "DELETE" });
  });
});
