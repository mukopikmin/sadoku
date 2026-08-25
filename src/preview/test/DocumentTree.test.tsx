import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "./testUtils";
import { DocumentTree } from "../components/DocumentTree";

afterEach(cleanup);

describe("DocumentTree", () => {
  it("sorts directories before files at every level", () => {
    const { container } = render(
      <DocumentTree
        documents={[
          { deleted: false, id: 1, relativePath: "zeta.md", title: "Zeta" },
          {
            deleted: false,
            id: 2,
            relativePath: "alpha/zeta.md",
            title: "Nested zeta",
          },
          {
            deleted: false,
            id: 3,
            relativePath: "alpha/nested/alpha.md",
            title: "Deep alpha",
          },
          { deleted: false, id: 4, relativePath: "alpha.md", title: "Alpha" },
          {
            deleted: false,
            id: 5,
            relativePath: "beta/alpha.md",
            title: "Nested alpha",
          },
          {
            deleted: false,
            id: 6,
            relativePath: "alpha/beta.md",
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
});
