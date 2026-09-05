import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "./testUtils";
import { DocumentTree } from "../components/DocumentTree";

afterEach(cleanup);

describe("DocumentTree", () => {
  it("sorts directories before files at every level", () => {
    const { container } = render(
      <DocumentTree
        documents={[
          {
            deleted: false,
            id: 1,
            relativePath: "zeta.md",
            tags: [],
            title: "Zeta",
          },
          {
            deleted: false,
            id: 2,
            relativePath: "alpha/zeta.md",
            tags: [],
            title: "Nested zeta",
          },
          {
            deleted: false,
            id: 3,
            relativePath: "alpha/nested/alpha.md",
            tags: [],
            title: "Deep alpha",
          },
          {
            deleted: false,
            id: 4,
            relativePath: "alpha.md",
            tags: [],
            title: "Alpha",
          },
          {
            deleted: false,
            id: 5,
            relativePath: "beta/alpha.md",
            tags: [],
            title: "Nested alpha",
          },
          {
            deleted: false,
            id: 6,
            relativePath: "alpha/beta.md",
            tags: [],
            title: "Nested beta",
          },
        ]}
        onSelectDocument={vi.fn()}
      />,
    );

    expect(
      [...container.querySelectorAll(
        "[data-part='branch-text'], [data-part='item-text']",
      )]
        .map((item) => item.textContent),
    ).toEqual([
      "alpha",
      "nested",
      "alpha.md",
      "beta.md",
      "zeta.md",
      "beta",
      "alpha.md",
      "alpha.md",
      "zeta.md",
    ]);
  });

  it("reserves the expand-control column before file icons", () => {
    const { container } = render(
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
        onSelectDocument={vi.fn()}
      />,
    );

    const item = container.querySelector("[data-part='item']");
    expect(item?.children[0].getAttribute("data-part")).toBe("item-indicator");
    expect(item?.children[1].tagName).toBe("svg");
  });

  it("renders document tags beside file names with their background colors", () => {
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

    const taggedItem = getByText("tagged.md").closest("[data-part='item']");
    const apiTag = within(taggedItem!).getByText("API");
    const guideTag = within(taggedItem!).getByText("Guide");

    expect(taggedItem?.contains(apiTag)).toBe(true);
    expect(taggedItem?.contains(guideTag)).toBe(true);
    expect(apiTag.style.getPropertyValue("--tag-background")).toBe("#123456");
    expect(guideTag.style.getPropertyValue("--tag-background")).toBe(
      "#abcdef",
    );
    expect(
      getByText("untagged.md").closest("[data-part='item']")?.querySelectorAll(
        "[style*='--tag-background']",
      ),
    ).toHaveLength(0);
  });

  it("filters documents by any selected tag and clears the filters", () => {
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
          {
            deleted: false,
            id: 3,
            relativePath: "notes.md",
            tags: [],
            title: "Notes",
          },
        ]}
        onSelectDocument={vi.fn()}
      />,
    );

    const search = screen.getByRole("combobox", { name: "Search tags" });
    fireEvent.change(search, { target: { value: "ap" } });
    expect(screen.getByRole("option", { name: "API" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Guide" })).toBeNull();
    fireEvent.keyDown(search, { key: "Enter" });

    expect(
      screen.getByRole("button", { name: "Remove API filter" }),
    ).toBeTruthy();
    expect(screen.getByText("Showing 1 of 3 documents")).toBeTruthy();
    expect(screen.getByText("reference.md")).toBeTruthy();
    expect(screen.queryByText("start.md")).toBeNull();
    expect(screen.queryByText("guides")).toBeNull();

    fireEvent.change(search, { target: { value: "guide" } });
    fireEvent.click(screen.getByRole("option", { name: "Guide" }));
    expect(screen.getByText("Showing 2 of 3 documents")).toBeTruthy();
    expect(screen.getByText("reference.md")).toBeTruthy();
    expect(screen.getByText("start.md")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Remove API filter" }));
    expect(screen.getByText("Showing 1 of 3 documents")).toBeTruthy();
    expect(screen.queryByText("reference.md")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.queryByText(/Showing/)).toBeNull();
    expect(screen.getByText("notes.md")).toBeTruthy();
  });
});
