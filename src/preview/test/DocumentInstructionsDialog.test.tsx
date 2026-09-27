import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "./testUtils";
import { DocumentInstructionsDialog } from "../components/DocumentInstructionsDialog";

const path = "/__sadoku/documents/7/instructions";

describe("DocumentInstructionsDialog", () => {
  beforeEach(() => {
    const instructions: {
      id: number;
      content: string;
      createdAt: string;
      updatedAt: string;
    }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === "POST" || init?.method === "PUT") {
          const instruction = {
            id: 1,
            ...JSON.parse(String(init.body)),
            createdAt: "2026-01-01",
            updatedAt: "2026-01-01",
          };
          instructions.splice(0, instructions.length, instruction);
          return Response.json(instruction);
        }
        if (init?.method === "DELETE") {
          instructions.splice(0);
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

  it("opens a draft with Add Instruction and persists only on Save", async () => {
    render(
      <DocumentInstructionsDialog
        documentId={7}
        open
        onOpenChange={() => {}}
      />,
    );
    await screen.findByText("No instructions have been added.");
    expect(screen.queryByRole("textbox", { name: "Instruction" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Add Instruction" }));
    const input = screen.getByRole("textbox", { name: "Instruction" });
    expect(
      screen.getByRole("button", { name: "Save instruction" }).hasAttribute(
        "disabled",
      ),
    ).toBe(true);
    fireEvent.change(input, { target: { value: "Use short paragraphs." } });
    expect(vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method))
      .toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Save instruction" }));
    await waitFor(() =>
      expect(screen.queryByRole("textbox", { name: "Instruction" })).toBeNull()
    );
    expect(screen.getByText("Use short paragraphs.")).not.toBeNull();
    expect(fetch).toHaveBeenCalledWith(
      path,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ content: "Use short paragraphs." }),
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(
      (screen.getByRole("textbox", {
        name: "Instruction",
      }) as HTMLTextAreaElement).value,
    ).toBe("Use short paragraphs.");
    fireEvent.change(screen.getByRole("textbox", { name: "Instruction" }), {
      target: { value: "Updated instruction" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save instruction" }));
    await waitFor(() =>
      expect(screen.queryByRole("textbox", { name: "Instruction" })).toBeNull()
    );
    expect(fetch).toHaveBeenCalledWith(
      `${path}/1`,
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ content: "Updated instruction" }),
      }),
    );
  });

  it("retains a failed draft and discards it on Cancel", async () => {
    render(
      <DocumentInstructionsDialog
        documentId={7}
        open
        onOpenChange={() => {}}
      />,
    );
    await screen.findByText("No instructions have been added.");
    fireEvent.click(screen.getByRole("button", { name: "Add Instruction" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Instruction" }), {
      target: { value: "Draft" },
    });
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response("Error", { status: 500 }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Save instruction" }));
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Failed to create instruction: 500",
    );
    expect(
      (screen.getByRole("textbox", {
        name: "Instruction",
      }) as HTMLTextAreaElement).value,
    ).toBe("Draft");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("textbox", { name: "Instruction" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Add Instruction" }));
    expect(
      (screen.getByRole("textbox", {
        name: "Instruction",
      }) as HTMLTextAreaElement).value,
    ).toBe("");
    expect(vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method))
      .toHaveLength(1);
  });
  it("requires confirmation before deletion and allows retry after failure", async () => {
    render(
      <DocumentInstructionsDialog
        documentId={7}
        open
        onOpenChange={() => {}}
      />,
    );
    await screen.findByText("No instructions have been added.");
    fireEvent.click(screen.getByRole("button", { name: "Add Instruction" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Instruction" }), {
      target: { value: "Saved instruction" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save instruction" }));
    await waitFor(() =>
      expect(screen.queryByRole("textbox", { name: "Instruction" })).toBeNull()
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Delete", exact: true }),
    );
    await screen.findByRole("alertdialog", { name: "Delete instruction?" });
    expect(
      vi.mocked(fetch).mock.calls.filter(([, init]) =>
        init?.method === "DELETE"
      ),
    ).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(screen.getByText("Saved instruction")).not.toBeNull();
    expect(
      vi.mocked(fetch).mock.calls.filter(([, init]) =>
        init?.method === "DELETE"
      ),
    ).toHaveLength(0);
    fireEvent.click(
      screen.getByRole("button", { name: "Delete", exact: true }),
    );
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response("Error", { status: 500 }),
    );
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Delete instruction",
        exact: true,
      }),
    );
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Failed to delete instruction: 500",
    );
    expect(screen.getByRole("alertdialog")).not.toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Delete instruction", exact: true }),
    );
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(await screen.findByText("No instructions have been added.")).not
      .toBeNull();
    expect(fetch).toHaveBeenCalledWith(`${path}/1`, { method: "DELETE" });
  });
});
