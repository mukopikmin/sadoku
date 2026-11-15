import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "./testUtils";
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

  it("keeps global management available without loading or showing its body", async () => {
    const onOpenGlobalInstructions = vi.fn();
    render(
      <DocumentInstructionsDialog
        documentId={7}
        open
        onOpenChange={() => {}}
        onOpenGlobalInstructions={onOpenGlobalInstructions}
      />,
    );
    await screen.findByRole("button", { name: "Edit instructions" });
    expect(
      screen.queryByRole("region", { name: "Global instruction text" }),
    ).toBeNull();
    expect(
      vi
        .mocked(fetch)
        .mock.calls.some(([url]) =>
          String(url).includes("global-instructions"),
        ),
    ).toBe(false);
    fireEvent.click(
      screen.getByRole("button", { name: "Manage global instructions" }),
    );
    expect(onOpenGlobalInstructions).toHaveBeenCalledOnce();
  });

  it("edits a single text value and clears it by saving an empty value", async () => {
    render(
      <DocumentInstructionsDialog
        documentId={7}
        open
        onOpenChange={() => {}}
      />,
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Edit instructions" }),
    );
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
    await screen.findByText("Use short paragraphs.");
    expect(screen.queryByRole("textbox")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Edit instructions" }));
    expect(fetch).toHaveBeenCalledWith(
      path,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ content: "Use short paragraphs." }),
      }),
    );
    fireEvent.change(input(), { target: { value: "Updated instruction" } });
    fireEvent.click(save());
    await screen.findByText("Updated instruction");
    fireEvent.click(screen.getByRole("button", { name: "Edit instructions" }));
    expect(fetch).toHaveBeenCalledWith(
      `${path}/1`,
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ content: "Updated instruction" }),
      }),
    );
    fireEvent.change(input(), { target: { value: "" } });
    fireEvent.click(save());
    await screen.findByText("No instructions have been added.");
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(fetch).toHaveBeenCalledWith(`${path}/1`, { method: "DELETE" });
  });
});
