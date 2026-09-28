import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "./testUtils";
import { DocumentTree } from "../components/DocumentTree";

afterEach(cleanup);

describe("DocumentTree", () => {
  it("nests documents under their folder and selects the document", async () => {
    const onSelectDocument = vi.fn();
    render(
      <DocumentTree
        documents={[
          {
            deleted: false,
            id: 1,
            relativePath: "folder/file.md",
            tags: [],
            title: "File",
          },
        ]}
        onSelectDocument={onSelectDocument}
      />,
    );

    const tree = screen.getByRole("tree", { name: "Documents" });
    const folder = within(tree).getByText("folder").closest(
      '[role="treeitem"]',
    )!;
    const item = within(folder).getByRole("treeitem", { name: "file.md" });
    expect(folder.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(item);
    await waitFor(() => expect(onSelectDocument).toHaveBeenCalledWith(1));
  });

  it("groups tags with their document in the tree", () => {
    const { getByText } = render(
      <DocumentTree
        documents={[
          {
            deleted: false,
            id: 1,
            relativePath: "tagged.md",
            tags: [
              { backgroundColor: "#123456", id: 1, name: "API" },
              { backgroundColor: "#abcdef", id: 2, name: "Guide" },
            ],
            title: "Tagged",
          },
          {
            deleted: false,
            id: 2,
            relativePath: "untagged.md",
            tags: [],
            title: "Untagged",
          },
        ]}
        onSelectDocument={vi.fn()}
      />,
    );

    const taggedItem = getByText("tagged.md").closest('[role="treeitem"]');
    const apiTag = within(taggedItem!).getByText("API");
    const guideTag = within(taggedItem!).getByText("Guide");

    expect(taggedItem?.contains(apiTag)).toBe(true);
    expect(taggedItem?.contains(guideTag)).toBe(true);
    const untaggedItem = getByText("untagged.md").closest('[role="treeitem"]')!;
    expect(within(untaggedItem).queryByText("API")).toBeNull();
    expect(within(untaggedItem).queryByText("Guide")).toBeNull();
  });

  it("exposes tag choices through a multi-select combobox", async () => {
    render(
      <DocumentTree
        documents={[
          {
            deleted: false,
            id: 1,
            relativePath: "api/reference.md",
            tags: [{ backgroundColor: "#123456", id: 1, name: "API" }],
            title: "Reference",
          },
          {
            deleted: false,
            id: 2,
            relativePath: "guides/start.md",
            tags: [{ backgroundColor: "#abcdef", id: 2, name: "Guide" }],
            title: "Start",
          },
        ]}
        onSelectDocument={vi.fn()}
      />,
    );

    expect(screen.getByRole("combobox", { name: "Search tags" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Show tag options" }));

    const listbox = await screen.findByRole("listbox");
    expect(listbox.getAttribute("aria-multiselectable")).toBe("true");
    expect(screen.getByRole("option", { name: "API" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Guide" })).toBeTruthy();
  });
});
