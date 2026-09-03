import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "./testUtils";
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
});
