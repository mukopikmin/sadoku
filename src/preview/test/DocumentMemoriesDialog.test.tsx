import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "./testUtils";
import { DocumentMemoriesDialog } from "../components/DocumentMemoriesDialog";

describe("DocumentMemoriesDialog", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === "DELETE") {
          return new Response(null, { status: 204 });
        }
        return Response.json({
          memories: [
            {
              id: 2,
              documentId: 7,
              content: "The audience is maintainers.",
              createdAt: "2026-09-11T00:00:00.000Z",
              updatedAt: "2026-09-11T01:00:00.000Z",
            },
          ],
        });
      }),
    );
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("allows people to review and confirm deletion without editing", async () => {
    render(
      <DocumentMemoriesDialog documentId={7} onOpenChange={() => {}} open />,
    );
    expect(
      await screen.findByText("The audience is maintainers."),
    ).not.toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button", { name: /edit/i })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(
      await screen.findByRole("alertdialog", { name: "Delete memory?" }),
    ).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Delete memory" }));
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith("/__sadoku/documents/7/memories/2", {
        method: "DELETE",
      })
    );
  });
});
