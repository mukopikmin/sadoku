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
              backgroundColor: "#ffffff",
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
        ) {
          const { tags } = JSON.parse(String(init.body));
          return Response.json(
            tags.map((tag: { id?: number; name?: string }) => ({
              id: tag.id ?? 3,
              name: tag.name ?? (tag.id === 1 ? "API" : "api"),
              backgroundColor: "#718096",
            })),
          );
        }
        return new Response("Not found", { status: 404 });
      }),
    );
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("hides selected exact tags and reports duplicate additions", async () => {
    render(
      <DocumentTagsDialog
        documentId={7}
        onOpenChange={() => {}}
        open
        tags={[{ id: 1, name: "API", backgroundColor: "#ffffff" }]}
      />,
    );
    fireEvent.change(screen.getByLabelText("Tag name"), {
      target: { value: "API" },
    });
    await screen.findByRole("button", { name: "api" });
    expect(screen.queryByText("Exact match")).toBeNull();
    expect(screen.queryByRole("button", { name: "API" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(await screen.findByText("This tag has already been added.")).not
      .toBeNull();
  });

  it("shows only unselected similar tags without match reasons", async () => {
    render(
      <DocumentTagsDialog
        documentId={7}
        onOpenChange={() => {}}
        open
        tags={[{ id: 1, name: "API", backgroundColor: "#ffffff" }]}
      />,
    );
    fireEvent.change(screen.getByLabelText("Tag name"), {
      target: { value: "ap" },
    });
    const suggestion = await screen.findByRole("button", { name: "api" });
    expect(suggestion.textContent).toBe("api");
    expect(screen.queryByRole("button", { name: "API" })).toBeNull();
    expect(screen.getByRole("button", { name: "API ×" })).not.toBeNull();
    for (const reason of ["case", "prefix", "substring", "distance"]) {
      expect(screen.queryByText(reason)).toBeNull();
    }
    fireEvent.click(suggestion);
    await screen.findByRole("button", { name: "api ×" });
    fireEvent.change(screen.getByLabelText("Tag name"), {
      target: { value: "ap" },
    });
    expect(screen.queryByText("Similar tags")).toBeNull();
    expect(screen.queryByRole("button", { name: "api" })).toBeNull();
  });

  it("uses the saved background and contrast-color text for tag labels", async () => {
    render(
      <DocumentTagsDialog
        documentId={7}
        onOpenChange={() => {}}
        open
        tags={[{ id: 1, name: "API", backgroundColor: "#ffffff" }]}
      />,
    );
    const label = (await screen.findAllByText("API"))[0];
    expect(label.style.backgroundColor).toBe("var(--tag-background)");
    expect(label.style.getPropertyValue("--tag-background")).toBe("#ffffff");
    expect(label.style.color).toBe("");
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
    expect(screen.queryByRole("button", { name: "Save tags" })).toBeNull();
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
  it("saves existing tags immediately and preserves them when adding and removing", async () => {
    render(
      <DocumentTagsDialog
        documentId={7}
        onOpenChange={() => {}}
        open
        tags={[]}
      />,
    );
    fireEvent.change(screen.getByLabelText("Tag name"), {
      target: { value: "API" },
    });
    fireEvent.click(await screen.findByRole("button", { name: "API" }));
    await screen.findByRole("button", { name: "API ×" });
    await waitFor(() =>
      expect(screen.getByLabelText("Tag name").hasAttribute("disabled")).toBe(
        false,
      )
    );
    fireEvent.change(screen.getByLabelText("Tag name"), {
      target: { value: "new" },
    });
    fireEvent.keyDown(screen.getByLabelText("Tag name"), { key: "Enter" });
    await screen.findByRole("button", { name: "new ×" });
    expect(fetch).toHaveBeenCalledWith(
      "/__sadoku/documents/7/tags",
      expect.objectContaining({
        body: JSON.stringify({ tags: [{ id: 1 }, { name: "new" }] }),
        method: "PUT",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "API ×" }));
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "API ×" })).toBeNull()
    );
    expect(fetch).toHaveBeenCalledWith(
      "/__sadoku/documents/7/tags",
      expect.objectContaining({
        body: JSON.stringify({ tags: [{ id: 3 }] }),
        method: "PUT",
      }),
    );
  });

  it("keeps the input and saved tags when saving fails and allows retry", async () => {
    render(
      <DocumentTagsDialog
        documentId={7}
        onOpenChange={() => {}}
        open
        tags={[]}
      />,
    );
    fireEvent.change(screen.getByLabelText("Tag name"), {
      target: { value: "new" },
    });
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Add" }).hasAttribute("disabled"),
      ).toBe(false)
    );
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response("Could not save tags", { status: 500 }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect((await screen.findByRole("status")).textContent).toBe(
      "Could not save tags",
    );
    expect((screen.getByLabelText("Tag name") as HTMLInputElement).value).toBe(
      "new",
    );
    expect(screen.queryByRole("button", { name: "new ×" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await screen.findByRole("button", { name: "new ×" });
    expect((screen.getByLabelText("Tag name") as HTMLInputElement).value).toBe(
      "",
    );
  });
});
