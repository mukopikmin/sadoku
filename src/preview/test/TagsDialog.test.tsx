import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "./testUtils";
import { TagsDialog } from "../components/TagsDialog";
import { sadokuChakraSystem } from "../theme";

beforeEach(() => {
  vi.stubGlobal("scrollTo", vi.fn());
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("TagsDialog", () => {
  it("loads and displays tag names, colors, and document counts when opened", async () => {
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
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <TagsDialog onOpenChange={onOpenChange} open={false} />,
    );

    expect(fetchMock).not.toHaveBeenCalled();
    rerender(<TagsDialog onOpenChange={onOpenChange} open />);

    expect(await screen.findByText("API")).not.toBeNull();
    expect(screen.getByRole("columnheader", { name: "Color" })).not.toBeNull();
    expect(screen.getByText("#123456")).not.toBeNull();
    expect(screen.getByText("12")).not.toBeNull();
    const editButton = screen.getByRole("button", { name: "Edit tag API" });
    expect(editButton.textContent).toBe("");
    expect(editButton.querySelector("svg")).not.toBeNull();
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith("/__sadoku/tags");
    fireEvent.click(screen.getByRole("button", { name: "Close tags" }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
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

  it("edits a tag name and color and refreshes the list", async () => {
    const selectedColor = sadokuChakraSystem.token("colors.blue.500");
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
        ? Response.json({ id: 1, name: "Backend", backgroundColor: selectedColor })
        : Response.json([{ ...tag, name: "Platform API" }])
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<TagsDialog onOpenChange={() => {}} open />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Edit tag Platform API" }),
    );
    const nameInput = screen.getByLabelText("New name for Platform API");
    const colorInput = screen.getByLabelText(
      "Background color for Platform API",
    );
    const cells = nameInput.closest("tr")!.querySelectorAll("td");
    expect(cells[0].contains(nameInput)).toBe(true);
    expect(cells[1].contains(colorInput)).toBe(true);
    expect(cells[0].contains(colorInput)).toBe(false);
    fireEvent.change(screen.getByLabelText("New name for Platform API"), {
      target: { value: "Backend" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Background color" }));
    fireEvent.click(
      await screen.findByRole("button", { name: `Select ${selectedColor}` }),
    );
    await waitFor(() =>
      expect(
        (screen.getByLabelText(
          "Background color for Platform API",
        ) as HTMLInputElement).value.toLowerCase(),
      ).toBe(selectedColor)
    );
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/__sadoku/tags/1",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({
            name: "Backend",
            backgroundColor: selectedColor,
          }),
        }),
      )
    );
  });

  it("shows a conflict returned while updating", async () => {
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
      await screen.findByRole("button", { name: "Edit tag API" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Tag name already exists.")).not.toBeNull();
  });
});

it("confirms deletion, supports cancel, and refreshes after success", async () => {
  let deleted = false;
  const fetchMock = vi.fn(
    async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "DELETE") {
        deleted = true;
        return new Response(null, { status: 204 });
      }
      return Response.json(
        deleted ? [] : [{
          id: 1,
          name: "API",
          backgroundColor: "#123456",
          documentCount: 2,
          createdAt: "now",
          updatedAt: "now",
        }],
      );
    },
  );
  vi.stubGlobal("fetch", fetchMock);
  render(<TagsDialog onOpenChange={() => {}} open />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Delete tag API" }),
  );
  const confirmation = await screen.findByRole("alertdialog", {
    name: "Delete tag?",
  });
  expect(
    within(confirmation).getByText(
      /Delete API\? This removes the tag from all documents/,
    ),
  ).not.toBeNull();
  expect(fetchMock).toHaveBeenCalledOnce();
  fireEvent.click(within(confirmation).getByRole("button", { name: "Cancel" }));
  await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  expect(fetchMock).toHaveBeenCalledOnce();
  fireEvent.click(
    await screen.findByRole("button", { name: "Delete tag API" }),
  );
  const reopened = await screen.findByRole("alertdialog", {
    name: "Delete tag?",
  });
  fireEvent.click(
    within(reopened).getByRole("button", { name: "Delete", exact: true }),
  );
  expect(await screen.findByText("No tags yet.")).not.toBeNull();
});

it("keeps a tag and displays the error when deletion fails", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
      init?.method === "DELETE"
        ? new Response("Could not delete tag.", { status: 500 })
        : Response.json([{
          id: 1,
          name: "API",
          backgroundColor: "#123456",
          documentCount: 0,
          createdAt: "now",
          updatedAt: "now",
        }])
    ),
  );
  render(<TagsDialog onOpenChange={() => {}} open />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Delete tag API" }),
  );
  const confirmation = await screen.findByRole("alertdialog", {
    name: "Delete tag?",
  });
  fireEvent.click(
    within(confirmation).getByRole("button", { name: "Delete", exact: true }),
  );
  expect((await within(confirmation).findByRole("alert")).textContent).toBe(
    "Could not delete tag.",
  );
  expect(screen.getByText("API")).not.toBeNull();
  expect(screen.getByRole("button", { name: "Delete", exact: true })).not
    .toBeNull();
});
