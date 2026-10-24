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
  it("creates in the clicked folder without selecting a document or toggling the folder", async () => {
    const onCreateDocument = vi.fn();
    const onSelectDocument = vi.fn();
    render(
      <DocumentTree
        documents={[{
          id: 1,
          deleted: false,
          relativePath: "docs/guides/setup.md",
          title: "setup.md",
          tags: [],
        }]}
        onSelectDocument={onSelectDocument}
        onCreateDocument={onCreateDocument}
      />,
    );
    const folder = screen.getByText("guides").closest('[role="treeitem"]')!;
    const expanded = folder.getAttribute("aria-expanded");
    fireEvent.click(
      screen.getByRole("button", { name: "Create file in docs/guides" }),
    );
    expect(onCreateDocument).toHaveBeenCalledWith("docs/guides");
    expect(onSelectDocument).not.toHaveBeenCalled();
    expect(folder.getAttribute("aria-expanded")).toBe(expanded);
  });
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

  it("opens tag choices on input clicks, including after filtering", async () => {
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

    const input = screen.getByRole("combobox", { name: "Search tags" });
    fireEvent.click(input);

    const listbox = await screen.findByRole("listbox");
    expect(listbox.getAttribute("aria-multiselectable")).toBe("true");
    expect(screen.getByRole("option", { name: "API" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Guide" })).toBeTruthy();

    fireEvent.click(screen.getByRole("option", { name: "API" }));
    await waitFor(() => {
      expect(screen.queryByRole("listbox")).toBeNull();
      const tree = screen.getByRole("tree", { name: "Documents" });
      expect(within(tree).getByText("reference.md")).toBeTruthy();
      expect(within(tree).queryByText("start.md")).toBeNull();
    });

    fireEvent.click(input);
    expect(await screen.findByRole("option", { name: "Guide" })).toBeTruthy();
    fireEvent.keyDown(input, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "Show tag options" }));
    expect(await screen.findByRole("listbox")).toBeTruthy();
  });
});
