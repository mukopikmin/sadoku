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

  const renderDialog = (
    tags: { id: number; name: string; backgroundColor: string }[] = [],
  ) => {
    render(
      <DocumentTagsDialog
        documentId={7}
        onOpenChange={() => {}}
        open
        tags={tags}
      />,
    );
  };

  const readyInput = async () => {
    const input = screen.getByRole("combobox", { name: "Tag name" });
    await waitFor(() => expect(input.hasAttribute("disabled")).toBe(false));
    fireEvent.focus(input);
    return input;
  };

  it("lists existing unselected tags without typing and saves a dropdown selection", async () => {
    renderDialog([{ id: 1, name: "API", backgroundColor: "#ffffff" }]);
    await readyInput();
    fireEvent.click(screen.getByRole("button", { name: "Show tag options" }));
    expect(await screen.findByRole("option", { name: "api" })).not.toBeNull();
    expect(screen.queryByRole("option", { name: "API" })).toBeNull();
    fireEvent.click(screen.getByRole("option", { name: "api" }));
    await screen.findByRole("button", { name: "Remove api tag" });
    expect(fetch).toHaveBeenCalledWith(
      "/__sadoku/documents/7/tags",
      expect.objectContaining({
        body: JSON.stringify({ tags: [{ id: 1 }, { id: 2 }] }),
        method: "PUT",
      }),
    );
  });

  it("hides selected tags and prevents duplicate additions", async () => {
    renderDialog([{ id: 1, name: "API", backgroundColor: "#ffffff" }]);
    const input = await readyInput();
    fireEvent.change(input, { target: { value: "API" } });
    await screen.findByRole("option", { name: "api" });
    expect(screen.queryByRole("option", { name: "API" })).toBeNull();
    expect(screen.queryByRole("option", { name: "Create “API”" })).toBeNull();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(await screen.findByText("This tag has already been added.")).not
      .toBeNull();
  });

  it("offers existing matches and creation in the same dropdown, preserving case", async () => {
    renderDialog();
    const input = await readyInput();
    fireEvent.change(input, { target: { value: "  Api  " } });
    expect(await screen.findByRole("option", { name: "API" })).not.toBeNull();
    expect(screen.getByRole("option", { name: "api" })).not.toBeNull();
    fireEvent.click(screen.getByRole("option", { name: "Create “Api”" }));
    await screen.findByRole("button", { name: "Remove Api tag" });
    expect(fetch).toHaveBeenCalledWith(
      "/__sadoku/documents/7/tags",
      expect.objectContaining({
        body: JSON.stringify({ tags: [{ name: "Api" }] }),
        method: "PUT",
      }),
    );
  });

  it("uses existing exact matches and preserves saved tags when creating and removing", async () => {
    renderDialog();
    const input = await readyInput();
    fireEvent.change(input, { target: { value: "API" } });
    expect(await screen.findByRole("option", { name: "API" })).not.toBeNull();
    expect(screen.queryByRole("option", { name: "Create “API”" })).toBeNull();
    fireEvent.keyDown(input, { key: "Enter" });
    await screen.findByRole("button", { name: "Remove API tag" });
    await readyInput();
    fireEvent.change(input, { target: { value: "new" } });
    await screen.findByRole("option", { name: "Create “new”" });
    fireEvent.keyDown(input, { key: "Enter" });
    await screen.findByRole("button", { name: "Remove new tag" });
    expect(fetch).toHaveBeenCalledWith(
      "/__sadoku/documents/7/tags",
      expect.objectContaining({
        body: JSON.stringify({ tags: [{ id: 1 }, { name: "new" }] }),
        method: "PUT",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Remove API tag" }));
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Remove API tag" }))
        .toBeNull()
    );
    expect(fetch).toHaveBeenCalledWith(
      "/__sadoku/documents/7/tags",
      expect.objectContaining({
        body: JSON.stringify({ tags: [{ id: 3 }] }),
        method: "PUT",
      }),
    );
  });

  it("selects a highlighted existing tag using the keyboard", async () => {
    renderDialog();
    const input = await readyInput();
    fireEvent.change(input, { target: { value: "ap" } });
    await screen.findByRole("option", { name: "API" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    await waitFor(() =>
      expect(input.getAttribute("aria-activedescendant")).toBeTruthy()
    );
    fireEvent.keyDown(input, { key: "Enter" });
    await screen.findByRole("button", { name: "Remove api tag" });
    expect(screen.queryByRole("button", { name: "Remove ap tag" })).toBeNull();
  });

  it("does not create a tag when Enter confirms IME composition", async () => {
    renderDialog();
    const input = await readyInput();
    fireEvent.change(input, { target: { value: "日本語" } });
    await screen.findByRole("option", { name: "Create “日本語”" });
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });
    expect(
      vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method === "PUT"),
    ).toHaveLength(0);
    expect((input as HTMLInputElement).value).toBe("日本語");
  });

  it("allows creation when no existing tags are available", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json([]));
    renderDialog();
    const input = await readyInput();
    fireEvent.change(input, { target: { value: "First tag" } });
    fireEvent.click(
      await screen.findByRole("option", { name: "Create “First tag”" }),
    );
    await screen.findByRole("button", { name: "Remove First tag tag" });
  });

  it("disables dropdown choices and prevents Enter from exceeding the tag limit", async () => {
    renderDialog(Array.from({ length: 20 }, (_, index) => ({
      id: index + 10,
      name: `Tag ${index}`,
      backgroundColor: "#ffffff",
    })));
    const input = await readyInput();
    fireEvent.click(screen.getByRole("button", { name: "Show tag options" }));
    expect(
      (await screen.findByRole("option", { name: "API" })).getAttribute(
        "aria-disabled",
      ),
    ).toBe("true");
    fireEvent.change(input, { target: { value: "new" } });
    expect(
      (await screen.findByRole("option", { name: "Create “new”" }))
        .getAttribute("aria-disabled"),
    ).toBe("true");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(await screen.findByText("A document can have at most 20 tags.")).not
      .toBeNull();
    expect(
      vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method === "PUT"),
    ).toHaveLength(0);
  });

  it("keeps the input and saved tags when saving fails and allows retry", async () => {
    renderDialog();
    const input = await readyInput();
    fireEvent.change(input, { target: { value: "new" } });
    const create = await screen.findByRole("option", { name: "Create “new”" });
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response("Could not save tags", { status: 500 }),
    );
    fireEvent.click(create);
    expect((await screen.findByRole("status")).textContent).toBe(
      "Could not save tags",
    );
    expect((input as HTMLInputElement).value).toBe("new");
    expect(screen.queryByRole("button", { name: "Remove new tag" })).toBeNull();
    await readyInput();
    fireEvent.click(screen.getByRole("button", { name: "Show tag options" }));
    fireEvent.click(
      await screen.findByRole("option", { name: "Create “new”" }),
    );
    await screen.findByRole("button", { name: "Remove new tag" });
    expect((input as HTMLInputElement).value).toBe("");
  });

  it("keeps a selected tag when removal fails and allows retry", async () => {
    renderDialog([{ id: 1, name: "API", backgroundColor: "#ffffff" }]);
    await readyInput();
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response("Could not remove tag", { status: 500 }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Remove API tag" }));
    expect((await screen.findByRole("status")).textContent).toBe(
      "Could not remove tag",
    );
    await readyInput();
    fireEvent.click(screen.getByRole("button", { name: "Remove API tag" }));
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Remove API tag" }))
        .toBeNull();
      expect(screen.queryByRole("status")).toBeNull();
    });
    expect(fetch).toHaveBeenCalledWith(
      "/__sadoku/documents/7/tags",
      expect.objectContaining({
        body: JSON.stringify({ tags: [] }),
        method: "PUT",
      }),
    );
  });
});
