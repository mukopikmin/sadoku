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
        documents={[
          {
            id: 1,
            deleted: false,
            relativePath: "docs/guides/setup.md",
            title: "setup.md",
            tags: [],
          },
        ]}
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
    const folder = within(tree)
      .getByText("folder")
      .closest<HTMLElement>('[role="treeitem"]')!;
    const item = within(folder).getByRole("treeitem", { name: "file.md" });
    expect(folder.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(item);
    await waitFor(() => expect(onSelectDocument).toHaveBeenCalledWith(1));
  });

  it("searches relative paths and display titles in the document tree without tags", async () => {
    const onSelectDocument = vi.fn();
    render(
      <DocumentTree
        documents={[
          {
            id: 1,
            deleted: false,
            relativePath: "guides/setup.md",
            title: "setup.md",
            displayTitle: "開発環境のガイド",
            tags: [],
          },
          {
            id: 2,
            deleted: false,
            relativePath: "release.md",
            title: "release.md",
            tags: [],
          },
        ]}
        onSelectDocument={onSelectDocument}
      />,
    );

    const input = screen.getByRole("searchbox", { name: "Search documents" });
    const resultCount = screen.getByRole("status");
    expect(resultCount.textContent).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "guides folder" }));
    await waitFor(() => {
      expect(screen.queryByRole("treeitem", { name: "setup.md" })).toBeNull();
    });

    fireEvent.change(input, { target: { value: "環境のカ\u3099イド" } });
    const result = await screen.findByRole("treeitem", { name: "setup.md" });
    expect(screen.getByRole("status")).toBe(resultCount);
    expect(resultCount.textContent).toBe("Showing 1 of 2 documents");
    expect(screen.queryByText("release.md")).toBeNull();
    fireEvent.click(result);
    await waitFor(() => expect(onSelectDocument).toHaveBeenCalledWith(1));

    fireEvent.change(input, { target: { value: "  LEASE.MD  " } });
    expect(screen.getByRole("treeitem", { name: "release.md" })).toBeTruthy();
    expect(screen.queryByText("guides")).toBeNull();

    fireEvent.change(input, { target: { value: "guides" } });
    expect(
      await screen.findByRole("treeitem", { name: "setup.md" }),
    ).toBeTruthy();
    expect(screen.queryByText("release.md")).toBeNull();

    fireEvent.change(input, { target: { value: "missing.md" } });
    expect(screen.getByRole("status").textContent).toBe(
      "Showing 0 of 2 documents",
    );
    expect(
      screen.getByText("No documents match the current filters."),
    ).toBeTruthy();

    const reset = screen.getByRole("button", { name: "Reset filters" });
    reset.focus();
    fireEvent.click(reset);
    expect(input).toHaveProperty("value", "");
    expect(document.activeElement).toBe(input);
    expect(screen.getByRole("status")).toBe(resultCount);
    expect(resultCount.textContent).toBe("");
    expect(screen.queryByRole("treeitem", { name: "setup.md" })).toBeNull();
    expect(screen.getByRole("treeitem", { name: "release.md" })).toBeTruthy();
  });

  it("expands matching folders again when returning to an earlier search", async () => {
    render(
      <DocumentTree
        documents={[
          {
            id: 1,
            deleted: false,
            relativePath: "docs/guide.md",
            title: "Guide",
            tags: [],
          },
          {
            id: 2,
            deleted: false,
            relativePath: "reference.md",
            title: "Reference",
            tags: [],
          },
        ]}
        onSelectDocument={vi.fn()}
      />,
    );
    const input = screen.getByRole("searchbox", { name: "Search documents" });
    fireEvent.change(input, { target: { value: "guide" } });
    expect(screen.getByRole("treeitem", { name: "guide.md" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "docs folder" }));
    await waitFor(() => {
      expect(screen.queryByRole("treeitem", { name: "guide.md" })).toBeNull();
    });

    fireEvent.change(input, { target: { value: "reference" } });
    expect(screen.getByRole("treeitem", { name: "reference.md" })).toBeTruthy();
    fireEvent.change(input, { target: { value: "guide" } });
    expect(
      await screen.findByRole("treeitem", { name: "guide.md" }),
    ).toBeTruthy();
  });

  it("keeps the results reachable by keyboard after the focused file is filtered out", async () => {
    render(
      <DocumentTree
        documents={[
          { id: 1, deleted: false, relativePath: "a.md", title: "A", tags: [] },
          {
            id: 2,
            deleted: false,
            relativePath: "docs/b.md",
            title: "B",
            tags: [],
          },
        ]}
        onSelectDocument={vi.fn()}
      />,
    );
    fireEvent.focus(screen.getByRole("treeitem", { name: "b.md" }));
    await waitFor(() => {
      expect(screen.getByRole("treeitem", { name: "b.md" })).toHaveProperty(
        "tabIndex",
        0,
      );
    });
    const input = screen.getByRole("searchbox", { name: "Search documents" });
    input.focus();
    fireEvent.change(input, { target: { value: "a.md" } });
    expect(screen.getByRole("treeitem", { name: "a.md" })).toHaveProperty(
      "tabIndex",
      0,
    );
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

    const taggedItem =
      getByText("tagged.md").closest<HTMLElement>('[role="treeitem"]');
    const apiTag = within(taggedItem!).getByText("API");
    const guideTag = within(taggedItem!).getByText("Guide");

    expect(taggedItem?.contains(apiTag)).toBe(true);
    expect(taggedItem?.contains(guideTag)).toBe(true);
    const untaggedItem =
      getByText("untagged.md").closest<HTMLElement>('[role="treeitem"]')!;
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
    const selectedOption = screen.getByRole("option", { name: "API" });
    expect(selectedOption.getAttribute("aria-selected")).toBe("true");
    fireEvent.click(selectedOption);
    await waitFor(() => {
      const tree = screen.getByRole("tree", { name: "Documents" });
      expect(within(tree).getByText("reference.md")).toBeTruthy();
      expect(within(tree).getByText("start.md")).toBeTruthy();
      expect(
        screen.queryByRole("button", { name: "Reset filters" }),
      ).toBeNull();
    });
  });

  it("resets the tag search before a tag has been selected", async () => {
    render(
      <DocumentTree
        documents={[
          {
            id: 1,
            deleted: false,
            relativePath: "guide.md",
            tags: [{ backgroundColor: "#abcdef", id: 1, name: "Guide" }],
            title: "Guide",
          },
        ]}
        onSelectDocument={vi.fn()}
      />,
    );

    const filters = within(
      screen.getByRole("form", { name: "Document filters" }),
    );
    const input = filters.getByRole("combobox", { name: "Search tags" });
    fireEvent.click(input);
    await screen.findByRole("listbox");
    fireEvent.change(input, { target: { value: "gu" } });
    const reset = await filters.findByRole("button", { name: "Reset filters" });
    expect(reset).toHaveProperty("type", "reset");
    expect(filters.queryByText(/Showing .* documents/)).toBeNull();
    fireEvent.click(reset);

    expect(input).toHaveProperty("value", "");
    expect(filters.queryByRole("button", { name: "Reset filters" })).toBeNull();
  });

  it("combines document search and tags and resets all filters", async () => {
    render(
      <DocumentTree
        documents={[
          {
            deleted: false,
            id: 1,
            relativePath: "api.md",
            tags: [{ backgroundColor: "#123456", id: 1, name: "API" }],
            title: "API",
          },
          {
            deleted: false,
            id: 2,
            relativePath: "guide.md",
            tags: [{ backgroundColor: "#abcdef", id: 2, name: "Guide" }],
            title: "Guide",
          },
          {
            deleted: false,
            id: 3,
            relativePath: "untagged-api.md",
            tags: [],
            title: "Untagged",
          },
        ]}
        onSelectDocument={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "Reset filters" })).toBeNull();
    const input = screen.getByRole("combobox", { name: "Search tags" });
    for (const name of ["API", "Guide"]) {
      fireEvent.click(input);
      fireEvent.click(await screen.findByRole("option", { name }));
      await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
    }
    expect(screen.getByText("Showing 2 of 3 documents")).toBeTruthy();
    expect(screen.queryByText("untagged-api.md")).toBeNull();

    const documentSearch = screen.getByRole("searchbox", {
      name: "Search documents",
    });
    fireEvent.change(documentSearch, { target: { value: "API" } });
    expect(screen.getByText("api.md")).toBeTruthy();
    expect(screen.queryByText("guide.md")).toBeNull();
    expect(screen.queryByText("untagged-api.md")).toBeNull();
    expect(screen.getByRole("status").textContent).toBe(
      "Showing 1 of 3 documents",
    );

    fireEvent.change(input, { target: { value: "gu" } });
    await waitFor(() => expect((input as HTMLInputElement).value).toBe("gu"));
    fireEvent.click(screen.getByRole("button", { name: "Reset filters" }));

    await waitFor(() => {
      const tree = screen.getByRole("tree", { name: "Documents" });
      expect(within(tree).getByText("api.md")).toBeTruthy();
      expect(within(tree).getByText("guide.md")).toBeTruthy();
      expect(within(tree).getByText("untagged-api.md")).toBeTruthy();
      expect(documentSearch).toHaveProperty("value", "");
      expect((input as HTMLInputElement).value).toBe("");
      expect(screen.queryByText(/Showing .* documents/)).toBeNull();
      expect(
        screen.queryByRole("button", { name: "Reset filters" }),
      ).toBeNull();
    });
  });

  it("removes individual tag filters while keeping the other selections", async () => {
    render(
      <DocumentTree
        documents={[
          {
            deleted: false,
            id: 1,
            relativePath: "api.md",
            tags: [{ backgroundColor: "#123456", id: 1, name: "API" }],
            title: "API",
          },
          {
            deleted: false,
            id: 2,
            relativePath: "guide.md",
            tags: [{ backgroundColor: "#abcdef", id: 2, name: "Guide" }],
            title: "Guide",
          },
          {
            deleted: false,
            id: 3,
            relativePath: "untagged.md",
            tags: [],
            title: "Untagged",
          },
        ]}
        onSelectDocument={vi.fn()}
      />,
    );

    const input = screen.getByRole("combobox", { name: "Search tags" });
    for (const name of ["API", "Guide"]) {
      fireEvent.click(input);
      fireEvent.click(await screen.findByRole("option", { name }));
      await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
    }

    fireEvent.click(screen.getByRole("button", { name: "Remove API filter" }));
    await waitFor(() => {
      const tree = screen.getByRole("tree", { name: "Documents" });
      expect(within(tree).queryByText("api.md")).toBeNull();
      expect(within(tree).getByText("guide.md")).toBeTruthy();
      expect(within(tree).queryByText("untagged.md")).toBeNull();
      expect(
        screen.queryByRole("button", { name: "Remove API filter" }),
      ).toBeNull();
      expect(
        screen.getByRole("button", { name: "Remove Guide filter" }),
      ).toBeTruthy();
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Remove Guide filter" }),
    );
    await waitFor(() => {
      const tree = screen.getByRole("tree", { name: "Documents" });
      expect(within(tree).getByText("api.md")).toBeTruthy();
      expect(within(tree).getByText("guide.md")).toBeTruthy();
      expect(within(tree).getByText("untagged.md")).toBeTruthy();
      expect(
        screen.queryByRole("button", { name: "Reset filters" }),
      ).toBeNull();
    });
  });
});
