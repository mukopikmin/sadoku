import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "./testUtils";
import { DocumentTagsDialog } from "../components/DocumentTagsDialog";

describe("DocumentTagsDialog", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === "/__sadoku/tags") {
          return Response.json([
            {
              id: 1,
              name: "API",
              backgroundColor: "#123456",
              documentCount: 1,
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
            {
              id: 2,
              name: "api",
              backgroundColor: "#abcdef",
              documentCount: 0,
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
          ]);
        }
        if (
          url === "/__sadoku/documents/7/tags" && init?.method === "PUT"
        ) return Response.json([]);
        return new Response("Not found", { status: 404 });
      }),
    );
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("selects exact tags and reports duplicate additions", async () => {
    render(
      <DocumentTagsDialog
        documentId={7}
        onOpenChange={() => {}}
        open
        tags={[{ id: 1, name: "API", backgroundColor: "#123456" }]}
      />,
    );
    fireEvent.change(screen.getByLabelText("Tag name"), {
      target: { value: "API" },
    });
    fireEvent.click(await screen.findByRole("button", { name: "API" }));
    expect(await screen.findByText("This tag has already been added.")).not
      .toBeNull();
  });

  it("uses the saved background and contrast-color text for tag labels", async () => {
    render(
      <DocumentTagsDialog
        documentId={7}
        onOpenChange={() => {}}
        open
        tags={[{ id: 1, name: "API", backgroundColor: "#123456" }]}
      />,
    );
    const label = (await screen.findAllByText("API"))[0];
    expect(label.style.backgroundColor).toBe("var(--tag-background)");
    expect(label.style.getPropertyValue("--tag-background")).toBe("#123456");
    expect(document.head.textContent).toContain(
      "contrast-color(var(--tag-background))",
    );
  });

  it("allows a distinct new tag even when a similar tag exists", async () => {
    render(
      <DocumentTagsDialog
        documentId={7}
        onOpenChange={() => {}}
        open
        tags={[]}
      />,
    );
    fireEvent.change(screen.getByLabelText("Tag name"), {
      target: { value: "Api" },
    });
    expect(await screen.findByText("Similar tags")).not.toBeNull();
    expect(screen.getByText("You can still add “Api” as a new tag."))
      .not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    fireEvent.click(screen.getByRole("button", { name: "Save tags" }));
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/__sadoku/documents/7/tags",
        expect.objectContaining({
          body: JSON.stringify({ tags: [{ name: "Api" }] }),
          method: "PUT",
        }),
      )
    );
  });
});
