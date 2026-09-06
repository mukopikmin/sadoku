import { afterEach, describe, expect, it, vi } from "vitest";
import { MarkdownPreview } from "../pages/markdown/MarkdownPreview";
import { initializeMermaid } from "../markdown/mermaid";
import {
  createCommentActions,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "./testUtils";
import { mockRect, renderMarkdown } from "./markdownPreviewTestUtils";

vi.mock("../markdown/mermaid", () => ({
  initializeMermaid: vi.fn(async () => {}),
}));

afterEach(() => vi.mocked(initializeMermaid).mockReset());

describe("MarkdownPreview heading navigation", () => {
  it("opens the table of contents from a floating action button", async () => {
    renderMarkdown("# Only heading");

    const trigger = screen.getByRole("button", { name: "Table of contents" });
    const actionBar = screen.getByRole("dialog", {
      name: "Document actions",
    });
    expect(actionBar.getAttribute("data-part")).toBe("content");
    const instructionsButton = within(actionBar).getByRole("button", {
      name: "Instructions",
    });
    const tagsButton = within(actionBar).getByRole("button", { name: "Tags" });
    expect(within(instructionsButton).getByText("3")).not.toBeNull();
    expect(within(tagsButton).getByText("2")).not.toBeNull();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("navigation", { name: "Table of contents" }))
      .toBeNull();

    fireEvent.click(trigger);
    await waitFor(() =>
      expect(trigger.getAttribute("aria-expanded")).toBe("true")
    );
    const navigation = screen.getByRole("navigation", {
      name: "Table of contents",
    });
    expect(getComputedStyle(navigation).fontSize).toBe(
      "var(--chakra-font-sizes-sm)",
    );
    expect(getComputedStyle(navigation).lineHeight).toBe("1.7");
    expect(
      getComputedStyle(navigation.closest("[data-part=content]")!)
        .getPropertyValue("--popover-size"),
    ).toBe("var(--chakra-sizes-sm)");
    expect(
      within(navigation).getByRole("link", { name: "Only heading" })
        .getAttribute("href"),
    ).toBe("#only-heading");

    fireEvent.click(trigger);
    await waitFor(() =>
      expect(trigger.getAttribute("aria-expanded")).toBe("false")
    );
  });

  it("shows an empty table of contents for Markdown without headings", async () => {
    renderMarkdown("A paragraph without headings.");

    fireEvent.click(
      screen.getByRole("button", { name: "Table of contents" }),
    );
    expect(await screen.findByText("No headings")).not.toBeNull();
  });

  it("links nested, duplicate, Japanese, and decorated headings to their rendered IDs", async () => {
    renderMarkdown(`# Title!

## Title!

### 日本語

###### **Rich** \`Heading\`
`);
    fireEvent.click(
      screen.getByRole("button", { name: "Table of contents" }),
    );

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Table of contents" })
          .getAttribute("aria-expanded"),
      ).toBe("true")
    );
    const expectedLinks = [
      ["Title!", "#title"],
      ["Title!", "#title-1"],
      ["日本語", "#日本語"],
      ["Rich Heading", "#rich-heading"],
    ];
    const navigation = screen.getByRole("navigation", {
      name: "Table of contents",
    });
    const links = [...navigation.querySelectorAll<HTMLAnchorElement>("a")];
    expect(links).toHaveLength(4);
    expectedLinks.forEach(([name, href], index) => {
      expect(links[index].textContent).toBe(name);
      expect(links[index].getAttribute("href")).toBe(href);
      const id = decodeURIComponent(href.slice(1));
      expect(document.getElementById(id)).not.toBeNull();
    });
    expect(links.map((link) => link.parentElement?.dataset.headingLevel))
      .toEqual(["1", "2", "3", "6"]);
    expect(new Set(links.map((link) => link.parentElement?.className)).size)
      .toBe(4);
  });

  it("closes the table of contents after a link updates the hash and scrolls", async () => {
    globalThis.history.replaceState(null, "", "/docs/readme");
    const scrollIntoView = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    const header = document.createElement("header");
    header.getBoundingClientRect = () => mockRect(0, 72);
    document.body.append(header);
    renderMarkdown("# First\n\n## Target");

    const trigger = screen.getByRole("button", { name: "Table of contents" });
    fireEvent.click(trigger);
    const navigation = await screen.findByRole("navigation", {
      name: "Table of contents",
    });
    const targetLink = within(navigation).getByRole("link", { name: "Target" });
    fireEvent.click(targetLink);
    globalThis.location.hash = targetLink.getAttribute("href")!;

    await waitFor(() => expect(globalThis.location.hash).toBe("#target"));
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledOnce());
    expect(scrollIntoView.mock.instances[0]).toBe(
      screen.getByRole("heading", { name: "Target" }),
    );
    expect(
      screen.getByRole("heading", { name: "Target" }).style.scrollMarginTop,
    )
      .toBe("72px");
    await waitFor(() =>
      expect(trigger.getAttribute("aria-expanded")).toBe("false")
    );
    expect(screen.queryByPlaceholderText("Write a GitHub PR comment..."))
      .toBeNull();
    header.remove();
  });

  it("renders stable heading anchor links", () => {
    const { container } = renderMarkdown(`# Title!

## Title!

### **Rich** \`Heading\`
`);

    expect(container.querySelector("h1#title a.heading-anchor")?.textContent)
      .toBe("Title!");
    expect(
      container.querySelector("h1#title a.heading-anchor")?.getAttribute(
        "target",
      ),
    ).toBeNull();
    expect(container.querySelector("h2#title-1 a.heading-anchor")?.textContent)
      .toBe("Title!");
    expect(
      container.querySelector("h3#rich-heading a.heading-anchor")?.textContent,
    ).toBe("Rich Heading");
  });

  it("updates the URL for the selected unique heading without offering links for regular blocks", async () => {
    globalThis.history.replaceState(null, "", "/docs/readme?mode=review");
    const scrollIntoView = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    renderMarkdown(`# Title

Paragraph

## Title
`);

    fireEvent.click(screen.getByText("Paragraph"));
    expect(
      screen.queryByRole("button", { name: "Update URL with heading link" }),
    )
      .toBeNull();

    fireEvent.click(screen.getByRole("heading", { level: 2, name: "Title" }));
    const headingLinkButton = screen.getByRole("button", {
      name: "Update URL with heading link",
    });
    expect(headingLinkButton.closest(".comment-line-gutter")).not.toBeNull();
    expect(headingLinkButton.getAttribute("title")).toBeNull();

    fireEvent.click(headingLinkButton);
    await waitFor(() =>
      expect(globalThis.location.href).toBe(
        `${globalThis.location.origin}/docs/readme?mode=review#title-1`,
      )
    );
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledOnce());
    expect(screen.queryByPlaceholderText("Write a GitHub PR comment..."))
      .toBeNull();
  });

  it("scrolls to encoded headings on initial load and later hash changes", () => {
    const scrollIntoView = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    const header = document.createElement("header");
    header.getBoundingClientRect = () => mockRect(0, 72);
    document.body.append(header);
    globalThis.history.replaceState(null, "", "/#%E6%97%A5%E6%9C%AC%E8%AA%9E");
    renderMarkdown(`# 日本語

## Next
`);

    const japaneseHeading = screen.getByRole("heading", { name: "日本語" });
    expect(scrollIntoView).toHaveBeenCalledOnce();
    expect(scrollIntoView.mock.instances[0]).toBe(japaneseHeading);
    expect(japaneseHeading.style.scrollMarginTop).toBe("72px");

    scrollIntoView.mockClear();
    globalThis.history.replaceState(null, "", "/#next");
    fireEvent(globalThis, new HashChangeEvent("hashchange"));
    expect(scrollIntoView).toHaveBeenCalledOnce();
    expect(scrollIntoView.mock.instances[0]).toBe(
      screen.getByRole("heading", { name: "Next" }),
    );

    scrollIntoView.mockClear();
    globalThis.history.replaceState(null, "", "/#missing");
    fireEvent(globalThis, new HashChangeEvent("hashchange"));
    expect(scrollIntoView).not.toHaveBeenCalled();

    globalThis.history.replaceState(null, "", "/#%E0%A4%A");
    expect(() => fireEvent(globalThis, new HashChangeEvent("hashchange")))
      .not.toThrow();
    expect(scrollIntoView).not.toHaveBeenCalled();
    header.remove();
  });

  it("scrolls to a hashed heading created by a Markdown update", () => {
    const scrollIntoView = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    globalThis.history.replaceState(null, "", "/#later");
    const actions = createCommentActions();
    const result = render(
      <MarkdownPreview
        actions={actions}
        comments={[]}
        markdown="Before"
        showHtmlComments
        theme="default"
      />,
    );
    expect(scrollIntoView).not.toHaveBeenCalled();

    result.rerender(
      <MarkdownPreview
        actions={actions}
        comments={[]}
        markdown="# Later"
        showHtmlComments
        theme="default"
      />,
    );
    expect(scrollIntoView).toHaveBeenCalledOnce();
    expect(scrollIntoView.mock.instances[0]).toBe(
      screen.getByRole("heading", { name: "Later" }),
    );
  });

  it("does not wrap headings that contain links in a permalink", () => {
    const { container } = renderMarkdown(
      "## Terraform Cloud の Sentinel Policy Override を承認行為とする([BOADR-315](https://app.notion.com/p/368ee7728c57806c8a5ad4043597c6b5) で検討した案)",
    );

    const heading = container.querySelector("h2");
    expect(heading).not.toBeNull();
    expect(heading?.textContent).toBe(
      "Terraform Cloud の Sentinel Policy Override を承認行為とする(BOADR-315 で検討した案)",
    );
    expect(
      heading?.querySelector("a")?.getAttribute("href"),
    ).toBe("https://app.notion.com/p/368ee7728c57806c8a5ad4043597c6b5");
    expect(heading?.querySelector("a a")).toBeNull();
    expect(heading?.querySelector("a.heading-anchor")).toBeNull();
  });
});
