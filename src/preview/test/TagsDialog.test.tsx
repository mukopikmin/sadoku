import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "./testUtils";
import { TagsDialog } from "../components/TagsDialog";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("TagsDialog", () => {
  it("loads and displays tag names and document counts when opened", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json([
        {
          id: 1,
          name: "API",
          backgroundColor: "#123456",
          documentCount: 12,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ])
    );
    vi.stubGlobal("fetch", fetchMock);
    const { rerender } = render(
      <TagsDialog onOpenChange={() => {}} open={false} />,
    );

    expect(fetchMock).not.toHaveBeenCalled();
    rerender(<TagsDialog onOpenChange={() => {}} open />);

    expect(await screen.findByText("API")).not.toBeNull();
    expect(screen.getByText("12")).not.toBeNull();
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith("/__sadoku/tags");
  });

  it("displays an empty state", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json([])));

    render(<TagsDialog onOpenChange={() => {}} open />);

    expect(await screen.findByText("No tags yet.")).not.toBeNull();
  });

  it("displays an error state", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Could not load tags.", { status: 500 })),
    );

    render(<TagsDialog onOpenChange={() => {}} open />);

    await waitFor(() =>
      expect(screen.getByText("Could not load tags.")).not.toBeNull()
    );
  });

  it("renames a tag and refreshes the list", async () => {
    const tag = {
      id: 1,
      name: "API",
      backgroundColor: "#123456",
      documentCount: 12,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const fetchMock = vi.fn(async (
      _input: RequestInfo | URL,
      init?: RequestInit,
    ) =>
      init?.method === "PATCH"
        ? Response.json({ id: 1, name: "Backend", backgroundColor: "#abcdef" })
        : Response.json([{ ...tag, name: "Platform API" }])
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<TagsDialog onOpenChange={() => {}} open />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Rename tag Platform API" }),
    );
    fireEvent.change(screen.getByLabelText("New name for Platform API"), {
      target: { value: "Backend" },
    });
    fireEvent.change(
      screen.getByLabelText("Background color for Platform API"),
      {
        target: { value: "#abcdef" },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/__sadoku/tags/1",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ name: "Backend", backgroundColor: "#abcdef" }),
        }),
      )
    );
  });

  it("shows a conflict returned while renaming", async () => {
    const fetchMock = vi.fn(async (
      _input: RequestInfo | URL,
      init?: RequestInit,
    ) =>
      init?.method === "PATCH"
        ? new Response("Tag name already exists.", { status: 409 })
        : Response.json([{
          id: 1,
          name: "API",
          backgroundColor: "#123456",
          documentCount: 1,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        }])
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<TagsDialog onOpenChange={() => {}} open />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Rename tag API" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Tag name already exists.")).not.toBeNull();
  });
});
