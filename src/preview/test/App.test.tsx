import { renderWithRouter as render } from "./routerTestUtils";
import { cleanup, fireEvent, screen, waitFor, within } from "./testUtils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";
import { initializeMermaid } from "../markdown/mermaid";

const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;

vi.mock("../markdown/mermaid", () => ({
  initializeMermaid: vi.fn(async () => {}),
}));

class TestEventSource extends EventTarget {
  static instances: TestEventSource[] = [];

  constructor() {
    super();
    TestEventSource.instances.push(this);
  }

  close() {}
}

const createTestStorage = (initial: Record<string, string> = {}) => {
  const values = new Map(Object.entries(initial));

  return {
    clear: vi.fn(() => values.clear()),
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    removeItem: vi.fn((key: string) => {
      values.delete(key);
    }),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value);
    }),
  };
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  if (originalScrollIntoView) {
    HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
  } else {
    delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView;
  }
  document.documentElement.className = "";
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.removeAttribute("data-code-wrap");
  document.documentElement.removeAttribute("style");
  globalThis.localStorage?.clear?.();
  TestEventSource.instances = [];
  vi.mocked(initializeMermaid).mockClear();
  vi.unstubAllGlobals();
});

describe("App", () => {
  it("manages global instructions from the header without a selected document", async () => {
    vi.stubGlobal("EventSource", TestEventSource);
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/__sadoku/documents") return Response.json([]);
      if (url === "/__sadoku/directory-status") {
        return Response.json({ state: "ready" });
      }
      if (url === "/__sadoku/global-instructions") {
        return Response.json({
          instructions: [
            {
              id: 1,
              content: "Shared review guidance",
              createdAt: "created",
              updatedAt: "updated",
            },
            {
              id: 2,
              content: "Another shared instruction",
              createdAt: "created",
              updatedAt: "updated",
            },
          ],
        });
      }
      return new Response("Not found.", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);
    const trigger = await screen.findByRole("button", {
      name: "Open global instructions",
    });
    expect(
      fetchMock.mock.calls.some(([url]) =>
        String(url) === "/__sadoku/global-instructions"
      ),
    ).toBe(false);
    fireEvent.click(trigger);
    const dialog = await screen.findByRole("dialog", {
      name: "Global instructions",
    });
    expect(await within(dialog).findByText("Shared review guidance")).not
      .toBeNull();
    expect(within(dialog).getByText("Another shared instruction")).not
      .toBeNull();
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Global instructions" }))
        .toBeNull()
    );
    await waitFor(() => expect(document.activeElement).toBe(trigger));
    fireEvent.click(screen.getByRole("button", { name: "Open settings" }));
    const settings = await screen.findByRole("dialog", { name: "Settings" });
    expect(within(settings).queryByText("Global instructions")).toBeNull();
    expect(within(settings).queryByRole("button", { name: "Add Instruction" }))
      .toBeNull();
  });

  it("opens the same global manager from document instructions and returns focus to the header", async () => {
    vi.stubGlobal("EventSource", TestEventSource);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === "/__sadoku/documents") {
          return Response.json([{
            id: 1,
            relativePath: "test.md",
            title: "test.md",
          }]);
        }
        if (url === "/__sadoku/directory-status") {
          return Response.json({ state: "ready" });
        }
        if (url === "/__sadoku/documents/1") {
          return Response.json({
            fileUrl: "file:///tmp/test.md",
            markdown: "# Test",
            title: "test.md",
          });
        }
        if (url === "/__sadoku/documents/1/comments") {
          return Response.json({ comments: [], filePath: "/tmp/test.md" });
        }
        if (url === "/__sadoku/documents/1/instructions") {
          return Response.json({ instructions: [] });
        }
        if (url === "/__sadoku/documents/1/memories") {
          return Response.json({ memories: [] });
        }
        if (url === "/__sadoku/global-instructions") {
          return Response.json({
            instructions: [
              {
                id: 1,
                content: "Shared review guidance",
                createdAt: "created",
                updatedAt: "updated",
              },
            ],
          });
        }
        return new Response("Not found.", { status: 404 });
      }),
    );
    render(<App />);
    fireEvent.click(await screen.findByRole("treeitem", { name: "test.md" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Instructions" }),
    );
    const documentDialog = await screen.findByRole("dialog", {
      name: "Document instructions",
    });
    await within(documentDialog).findByText("Shared review guidance");
    fireEvent.click(
      within(documentDialog).getByRole("button", {
        name: "Manage global instructions",
      }),
    );
    const manager = await screen.findByRole("dialog", {
      name: "Global instructions",
    });
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Document instructions" }))
        .toBeNull()
    );
    expect(within(manager).getByText("Shared review guidance")).not.toBeNull();
    expect(screen.queryByRole("dialog", { name: "Settings" })).toBeNull();
    fireEvent.click(
      within(manager).getByRole("button", {
        name: "Close global instructions",
      }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Global instructions" }))
        .toBeNull()
    );
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "Open global instructions" }),
      )
    );
  });

  it("integrates the document title and a working table of contents into the header while scrolled", async () => {
    vi.stubGlobal("EventSource", TestEventSource);
    const scrollIntoView = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url === "/__sadoku/documents") {
          return Promise.resolve(Response.json([
            { id: 1, relativePath: "guide.md", title: "guide.md" },
          ]));
        }
        if (url === "/__sadoku/documents/1") {
          return Promise.resolve(Response.json({
            fileUrl: "file:///tmp/guide.md",
            title: "guide.md",
            displayTitle: "Reading guide",
            markdown: "# Introduction\n\nBody\n\n## Details\n\nMore text",
          }));
        }
        if (url === "/__sadoku/documents/1/comments") {
          return Promise.resolve(Response.json({ comments: [] }));
        }
        return Promise.resolve(new Response("Not found.", { status: 404 }));
      }),
    );
    let documentBottom = 180;
    const originalRect = HTMLElement.prototype.getBoundingClientRect;
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function () {
        const original = originalRect.call(this);
        if (this.tagName === "HEADER") {
          return { ...original, top: 0, bottom: 64, height: 64 };
        }
        if (this.getAttribute("aria-label") === "Document header") {
          return {
            ...original,
            top: documentBottom - 100,
            bottom: documentBottom,
            height: 100,
          };
        }
        return original;
      },
    );

    render(<App />);
    fireEvent.click(await screen.findByRole("treeitem", { name: "guide.md" }));
    await screen.findByRole("heading", { name: "Reading guide" });
    const header = within(screen.getByRole("banner"));
    expect(header.queryByRole("button", { name: "Table of contents" }))
      .toBeNull();
    expect(header.queryByRole("separator")).toBeNull();
    expect(header.getByRole("link", { name: "guide.md" })).not.toBeNull();

    documentBottom = 64;
    fireEvent.scroll(globalThis);
    fireEvent.click(
      await header.findByRole("button", { name: "Table of contents" }),
    );
    expect(
      header.getByRole("link", { name: "guide.md" }).getAttribute("href"),
    ).toBe("file:///tmp/guide.md");
    expect(header.getByText("Reading guide")).not.toBeNull();
    const applicationActions = header.getByRole("navigation", {
      name: "Application actions",
    });
    expect(
      within(applicationActions).getByRole("button", {
        name: "Table of contents",
      }),
    ).not.toBeNull();
    expect(
      within(applicationActions).getByRole("separator")
        .getAttribute("aria-orientation"),
    ).toBe("vertical");
    const toc = await screen.findByRole("navigation", {
      name: "Table of contents",
    });
    const details = within(toc).getByRole("link", { name: "Details" });
    expect(details.getAttribute("href")).toBe("#details");
    fireEvent.click(details);
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalled());
    expect(scrollIntoView.mock.instances.at(-1)).toBe(
      screen.getByRole("heading", { name: "Details" }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("navigation", { name: "Table of contents" }))
        .toBeNull()
    );

    documentBottom = 180;
    fireEvent.scroll(globalThis);
    await waitFor(() =>
      expect(header.queryByRole("button", { name: "Table of contents" }))
        .toBeNull()
    );
    expect(header.getByRole("link", { name: "guide.md" })).not.toBeNull();
    expect(header.queryByText("Reading guide")).toBeNull();
    expect(header.queryByRole("separator")).toBeNull();

    documentBottom = 20;
    fireEvent.scroll(globalThis);
    await header.findByRole("button", { name: "Table of contents" });
    fireEvent.click(
      screen.getByRole("tab", { name: "Comments, 0 unresolved" }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Table of contents" }))
        .toBeNull()
    );
    fireEvent.click(screen.getByRole("link", { name: "Documents" }));
    await screen.findByRole("treeitem", { name: "guide.md" });
    expect(screen.queryByRole("button", { name: "Table of contents" }))
      .toBeNull();
  });

  it("opens the tags dialog and restores focus to the header button", async () => {
    vi.stubGlobal("EventSource", TestEventSource);
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url === "/__sadoku/documents") {
          return Promise.resolve(Response.json([]));
        }
        if (url === "/__sadoku/directory-status") {
          return Promise.resolve(Response.json({ state: "ready" }));
        }
        if (url === "/__sadoku/tags") return Promise.resolve(Response.json([]));
        return Promise.resolve(new Response("Not found.", { status: 404 }));
      }),
    );

    render(<App />);
    const tagsButton = await screen.findByRole("button", { name: "Open tags" });
    fireEvent.click(tagsButton);

    expect(await screen.findByRole("dialog", { name: "Tags" })).not.toBeNull();
    fireEvent.keyDown(screen.getByRole("dialog", { name: "Tags" }), {
      key: "Escape",
    });

    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Tags" })).toBeNull()
    );
    await waitFor(() => expect(document.activeElement).toBe(tagsButton));
  });

  it("reruns mermaid rendering when returning to the preview view", async () => {
    vi.stubGlobal("EventSource", TestEventSource);
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url === "/__sadoku/documents") {
          return Promise.resolve(
            Response.json([{
              id: 1,
              relativePath: "test.md",
              title: "test.md",
            }]),
          );
        }
        if (url === "/__sadoku/documents") {
          return Promise.resolve(
            Response.json([{
              id: 1,
              relativePath: "test.md",
              title: "test.md",
            }]),
          );
        }
        if (url === "/__sadoku/documents/1") {
          return Promise.resolve(Response.json({
            fileUrl: "file:///tmp/example.md",
            markdown: "```mermaid\ngraph TD\n  A --> B\n```\n",
            title: "example.md",
          }));
        }
        if (url === "/__sadoku/documents/1/comments") {
          return Promise.resolve(Response.json({
            comments: [],
            filePath: "/tmp/example.md",
          }));
        }
        return Promise.resolve(new Response("Not found.", { status: 404 }));
      }),
    );

    render(<App />);
    fireEvent.click(await screen.findByRole("treeitem", { name: "test.md" }));

    await waitFor(() => expect(initializeMermaid).toHaveBeenCalledTimes(1));

    fireEvent.click(
      screen.getByRole("tab", { name: "Comments, 0 unresolved" }),
    );
    fireEvent.click(screen.getByRole("tab", { name: "Preview" }));

    await waitFor(() => expect(initializeMermaid).toHaveBeenCalledTimes(2));

    TestEventSource.instances[0]?.dispatchEvent(new Event("error"));
    expect((await screen.findByRole("status")).textContent).toContain(
      "Connection lost",
    );

    TestEventSource.instances[0]?.dispatchEvent(new Event("open"));
    await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
  });

  it("reloads the Markdown and comments without changing views", async () => {
    let documentRequests = 0;
    let commentRequests = 0;
    vi.stubGlobal("EventSource", TestEventSource);
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url === "/__sadoku/documents") {
          return Promise.resolve(
            Response.json([{
              id: 1,
              relativePath: "test.md",
              title: "test.md",
            }]),
          );
        }
        if (url === "/__sadoku/documents") {
          return Promise.resolve(
            Response.json([{
              id: 1,
              relativePath: "test.md",
              title: "test.md",
            }]),
          );
        }
        if (url === "/__sadoku/documents/1") {
          documentRequests += 1;
          return Promise.resolve(Response.json({
            fileUrl: "file:///tmp/example.md",
            markdown: documentRequests === 1
              ? "# Original title\n\n```mermaid\ngraph TD\n  A --> B\n```\n"
              : "# Updated title\n\n```mermaid\ngraph LR\n  C --> D\n```\n",
            title: "example.md",
          }));
        }
        if (url === "/__sadoku/documents/1/comments") {
          commentRequests += 1;
          return Promise.resolve(Response.json({
            comments: [],
            filePath: "/tmp/example.md",
          }));
        }
        return Promise.resolve(new Response("Not found.", { status: 404 }));
      }),
    );

    render(<App />);
    fireEvent.click(await screen.findByRole("treeitem", { name: "test.md" }));

    await screen.findByRole("heading", { name: "Original title" });
    await waitFor(() => expect(initializeMermaid).toHaveBeenCalledTimes(1));

    fireEvent.click(
      screen.getByRole("tab", { name: "Comments, 0 unresolved" }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("tab", { name: "Comments, 0 unresolved" })
          .getAttribute("aria-selected"),
      ).toBe("true")
    );

    expect(screen.queryByRole("button", { name: "Reload preview" })).toBeNull();

    TestEventSource.instances.at(-1)?.dispatchEvent(
      new MessageEvent("invalidate", {
        data: JSON.stringify({ resources: ["document", "comments"] }),
      }),
    );

    const reloadButton = await screen.findByRole("button", {
      name: "Reload preview",
    });
    const previewNavigation = screen.getByRole("navigation", {
      name: "Application actions",
    });
    expect(
      within(previewNavigation).getByRole("button", {
        name: "Reload preview",
      }),
    ).toBe(reloadButton);

    fireEvent.click(reloadButton);

    await waitFor(() => {
      expect(documentRequests).toBe(2);
      expect(commentRequests).toBe(2);
    });
    expect(documentRequests).toBe(2);
    expect(commentRequests).toBe(2);
    expect(
      screen.getByRole("tab", { name: "Comments, 0 unresolved" })
        .getAttribute("aria-selected"),
    ).toBe("true");
    vi.mocked(initializeMermaid).mockClear();
    fireEvent.click(screen.getByRole("tab", { name: "Preview" }));
    await screen.findByRole("heading", { name: "Updated title" });
    await waitFor(() => expect(initializeMermaid).toHaveBeenCalledTimes(1));
    expect(document.querySelector(".mermaid")?.textContent).toBe(
      "graph LR\n  C --> D",
    );
    expect(initializeMermaid).toHaveBeenLastCalledWith({ theme: "default" });
  });

  it("keeps the reload action available when reloading Markdown fails", async () => {
    let documentRequests = 0;
    vi.stubGlobal("EventSource", TestEventSource);
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url === "/__sadoku/documents") {
          return Promise.resolve(
            Response.json([{
              id: 1,
              relativePath: "test.md",
              title: "test.md",
            }]),
          );
        }
        if (url === "/__sadoku/documents") {
          return Promise.resolve(
            Response.json([{
              id: 1,
              relativePath: "test.md",
              title: "test.md",
            }]),
          );
        }
        if (url === "/__sadoku/documents/1") {
          documentRequests += 1;
          return documentRequests === 1
            ? Promise.resolve(Response.json({
              fileUrl: "file:///tmp/example.md",
              markdown: "# Original title\n",
              title: "example.md",
            }))
            : Promise.resolve(new Response("Failed.", { status: 500 }));
        }
        if (url === "/__sadoku/documents/1/comments") {
          return Promise.resolve(Response.json({
            comments: [],
            filePath: "/tmp/example.md",
          }));
        }
        return Promise.resolve(new Response("Not found.", { status: 404 }));
      }),
    );

    render(<App />);
    fireEvent.click(await screen.findByRole("treeitem", { name: "test.md" }));
    await screen.findByRole("heading", { name: "Original title" });
    TestEventSource.instances.at(-1)?.dispatchEvent(
      new MessageEvent("invalidate", {
        data: JSON.stringify({ resources: ["document", "comments"] }),
      }),
    );

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Reload preview",
      }),
    );

    await waitFor(() => expect(documentRequests).toBe(2));
    expect(screen.getByRole("heading", { name: "Original title" })).not
      .toBeNull();
    expect(screen.getByRole("button", { name: "Reload preview" })).not
      .toBeNull();
  });

  it("renders document navigation in the header and Markdown in the main landmark", async () => {
    vi.stubGlobal("EventSource", TestEventSource);
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url === "/__sadoku/documents") {
          return Promise.resolve(
            Response.json([{
              id: 1,
              relativePath: "test.md",
              title: "test.md",
            }]),
          );
        }
        if (url === "/__sadoku/documents") {
          return Promise.resolve(
            Response.json([{
              id: 1,
              relativePath: "test.md",
              title: "test.md",
            }]),
          );
        }
        if (url === "/__sadoku/documents/1") {
          return Promise.resolve(Response.json({
            fileUrl: "file:///tmp/example.md",
            markdown: "# Title\n\nBody\n",
            title: "example.md",
          }));
        }
        if (url === "/__sadoku/documents/1/comments") {
          return Promise.resolve(Response.json({
            comments: [],
            filePath: "/tmp/example.md",
          }));
        }
        return Promise.resolve(new Response("Not found.", { status: 404 }));
      }),
    );

    render(<App />);
    fireEvent.click(await screen.findByRole("treeitem", { name: "test.md" }));

    await screen.findByRole("link", { name: "example.md" });

    const brandIcon = screen.getByRole("img", { name: "Sadoku" });
    expect(brandIcon.getAttribute("src")).toBe("/assets/icon-512.png");
    const fileLink = screen.getByRole("link", { name: "example.md" });
    expect(fileLink.getAttribute("href")).toBe("file:///tmp/example.md");
    expect(screen.getByRole("navigation", { name: "Application actions" })).not
      .toBeNull();

    const header = screen.getByRole("banner");
    const main = screen.getByRole("main");
    expect(within(header).getByRole("img", { name: "Sadoku" })).toBe(brandIcon);
    expect(within(header).getByRole("link", { name: "example.md" })).toBe(
      fileLink,
    );
    expect(header.contains(main)).toBe(false);
    expect(within(main).getByRole("heading", { name: "Title" })).not.toBeNull();

    expect(within(header).queryByRole("tablist")).toBeNull();
    const actionBar = screen.getByRole("dialog", { name: "Document actions" });
    const tabs = within(actionBar).getByRole("tablist", {
      name: "Preview views",
    });
    const previewButton = within(tabs).getByRole("tab", { name: "Preview" });
    const commentsButton = within(tabs).getByRole("tab", {
      name: "Comments, 0 unresolved",
    });
    expect(commentsButton.querySelector('span[aria-hidden="true"]')).toBeNull();
    expect(previewButton.getAttribute("aria-selected")).toBe("true");
    expect(commentsButton.getAttribute("aria-selected")).toBe("false");
  });

  it("opens instructions for the selected document from its action bar", async () => {
    vi.stubGlobal("EventSource", TestEventSource);
    const instructionRequests: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url === "/__sadoku/documents") {
          return Promise.resolve(Response.json([
            { id: 1, relativePath: "first.md", title: "first.md" },
            { id: 2, relativePath: "second.md", title: "second.md" },
          ]));
        }
        if (/^\/__sadoku\/documents\/[12]$/.test(url)) {
          const id = url.endsWith("2") ? 2 : 1;
          return Promise.resolve(Response.json({
            markdown: `# Document ${id}`,
            title: `document-${id}.md`,
          }));
        }
        if (/^\/__sadoku\/documents\/[12]\/comments$/.test(url)) {
          return Promise.resolve(Response.json({ comments: [] }));
        }
        if (/^\/__sadoku\/documents\/[12]\/instructions$/.test(url)) {
          instructionRequests.push(url);
          return Promise.resolve(Response.json({ instructions: [] }));
        }
        return Promise.resolve(new Response("Not found.", { status: 404 }));
      }),
    );

    const { container } = render(<App />);
    expect(screen.queryByRole("button", { name: "Instructions" })).toBeNull();

    fireEvent.click(await screen.findByRole("treeitem", { name: "first.md" }));
    const firstActionBar = await screen.findByRole("dialog", {
      name: "Document actions",
    });
    const firstInstructionsButton = within(firstActionBar).getByRole("button", {
      name: "Instructions",
    });
    expect(
      firstInstructionsButton.querySelector("svg")?.getAttribute(
        "aria-hidden",
      ),
    ).toBe("true");
    const documentHeader = screen.getByRole("region", {
      name: "Document header",
    });
    const tableOfContentsButton = within(documentHeader).getByRole("button", {
      name: "Table of contents",
    });
    expect(
      tableOfContentsButton.querySelector("svg")?.getAttribute(
        "aria-hidden",
      ),
    ).toBe("true");
    expect(container.querySelector("header")?.contains(firstInstructionsButton))
      .toBe(false);

    fireEvent.click(screen.getByRole("tab", {
      name: "Comments, 0 unresolved",
    }));
    await waitFor(() => {
      const actionBar = screen.getByRole("dialog", {
        name: "Document actions",
      });
      expect(
        within(actionBar).getByRole("tab", {
          name: "Comments, 0 unresolved",
        }).getAttribute("aria-selected"),
      ).toBe("true");
      expect(within(actionBar).getByRole("button", { name: "Instructions" }))
        .not.toBeNull();
      expect(within(actionBar).getByRole("button", { name: "Revisions" }))
        .not.toBeNull();
      expect(screen.queryByRole("button", { name: "Table of contents" }))
        .toBeNull();
    });
    fireEvent.click(screen.getByRole("tab", { name: "Preview" }));

    expect(await screen.findByRole("button", { name: "Table of contents" }))
      .not.toBeNull();

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Instructions",
      }),
    );
    expect(
      await screen.findByRole("dialog", { name: "Document instructions" }),
    ).not.toBeNull();
    await waitFor(() =>
      expect(instructionRequests).toEqual([
        "/__sadoku/documents/1/instructions",
      ])
    );

    fireEvent.click(screen.getByRole("button", {
      name: "Close document instructions",
    }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Document instructions" }))
        .toBeNull()
    );
    fireEvent.click(screen.getByRole("link", { name: "Documents" }));
    fireEvent.click(await screen.findByRole("treeitem", { name: "second.md" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Instructions" }),
    );
    await waitFor(() =>
      expect(instructionRequests).toEqual([
        "/__sadoku/documents/1/instructions",
        "/__sadoku/documents/2/instructions",
      ])
    );
  });

  it("saves HTML comment visibility globally and restores it after remounting", async () => {
    vi.stubGlobal("EventSource", TestEventSource);
    let savedSettings: Record<string, unknown> = {};
    const fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/__sadoku/settings") {
        if (init?.method === "PUT") {
          savedSettings = JSON.parse(String(init.body));
        }
        return Promise.resolve(Response.json(savedSettings));
      }
      if (url === "/__sadoku/documents") {
        return Promise.resolve(Response.json([
          { id: 1, relativePath: "first.md", title: "first.md" },
          { id: 2, relativePath: "second.md", title: "second.md" },
        ]));
      }
      if (/^\/__sadoku\/documents\/[12]$/.test(url)) {
        return Promise.resolve(Response.json({
          fileUrl: `file:///tmp/${url.endsWith("1") ? "first" : "second"}.md`,
          markdown: "Before\n\n<!-- internal note -->\n\nAfter",
          title: url.endsWith("1") ? "first.md" : "second.md",
        }));
      }
      if (url.endsWith("/comments")) {
        return Promise.resolve(
          Response.json({ comments: [], filePath: "/tmp/test.md" }),
        );
      }
      return Promise.resolve(new Response("Not found.", { status: 404 }));
    });
    vi.stubGlobal("fetch", fetch);
    const app = render(<App />);
    fireEvent.click(await screen.findByRole("treeitem", { name: "first.md" }));
    expect(await screen.findByText("HTML COMMENT")).not.toBeNull();
    expect(screen.queryByRole("button", { name: /HTML comments/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Open settings" }));
    const toggle = await screen.findByRole<HTMLInputElement>("checkbox", {
      name: "Show HTML comments",
    });
    expect(toggle.checked).toBe(true);
    fireEvent.click(toggle);
    await waitFor(() => expect(savedSettings.showHtmlComments).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Close settings" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Settings" })).toBeNull()
    );
    expect(screen.queryByText("HTML COMMENT")).toBeNull();
    expect(screen.getByText("Before")).not.toBeNull();
    fireEvent.click(screen.getByRole("link", { name: "Documents" }));
    fireEvent.click(await screen.findByRole("treeitem", { name: "second.md" }));
    await screen.findByText("Before");
    expect(screen.queryByText("HTML COMMENT")).toBeNull();
    app.unmount();
    render(<App />);
    await screen.findByText("Before");
    expect(screen.queryByText("HTML COMMENT")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Open settings" }));
    const restored = await screen.findByRole<HTMLInputElement>("checkbox", {
      name: "Show HTML comments",
    });
    expect(restored.checked).toBe(false);
    fireEvent.click(restored);
    await waitFor(() => expect(savedSettings.showHtmlComments).toBe(true));
    fireEvent.click(screen.getByRole("button", { name: "Close settings" }));
    expect(await screen.findByText("HTML COMMENT")).not.toBeNull();
  });

  it("opens settings and selects and saves light and dark preview themes", async () => {
    vi.stubGlobal("EventSource", TestEventSource);
    const fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/__sadoku/documents") {
        return Promise.resolve(
          Response.json([{ id: 1, relativePath: "test.md", title: "test.md" }]),
        );
      }
      if (url === "/__sadoku/settings") {
        return Promise.resolve(Response.json(
          init?.method === "PUT"
            ? JSON.parse(String(init.body))
            : { theme: "light" },
        ));
      }
      if (url === "/__sadoku/documents/1") {
        return Promise.resolve(Response.json({
          fileUrl: "file:///tmp/example.md",
          markdown: "```mermaid\ngraph TD\n  A --> B\n```\n",
          title: "example.md",
        }));
      }
      if (url === "/__sadoku/documents/1/comments") {
        return Promise.resolve(Response.json({
          comments: [],
          filePath: "/tmp/example.md",
        }));
      }
      return Promise.resolve(new Response("Not found.", { status: 404 }));
    });
    vi.stubGlobal(
      "fetch",
      fetch,
    );

    render(<App />);
    fireEvent.click(await screen.findByRole("treeitem", { name: "test.md" }));

    await screen.findByRole("link", { name: "example.md" });
    await waitFor(() =>
      expect(document.documentElement.dataset.theme).toBe("light")
    );
    expect(document.documentElement.classList.contains("light")).toBe(true);
    await waitFor(() =>
      expect(initializeMermaid).toHaveBeenLastCalledWith({ theme: "default" })
    );

    const settingsButton = screen.getByRole("button", {
      name: "Open settings",
    });
    const previewNavigation = screen.getByRole("navigation", {
      name: "Application actions",
    });
    expect(
      within(previewNavigation).getByRole("button", {
        name: "Open settings",
      }),
    ).toBe(settingsButton);
    expect(settingsButton.textContent).toBe("");
    expect(settingsButton.querySelector('svg[aria-hidden="true"]')).not
      .toBeNull();

    fireEvent.click(settingsButton);

    expect(await screen.findByRole("dialog", { name: "Settings" })).not
      .toBeNull();
    const themeSelect = screen.getByRole("combobox", { name: "Theme" });
    expect(themeSelect.textContent).toBe("Light");
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("dialog", { name: "Settings" }),
      )
    );
    const decreaseTextSize = screen.getByRole("button", {
      name: "Decrease text size",
    });
    const increaseTextSize = screen.getByRole("button", {
      name: "Increase text size",
    });
    const textSizeControls = screen.getByRole("group", {
      name: "Text size controls",
    });
    expect(textSizeControls.contains(decreaseTextSize)).toBe(true);
    expect(textSizeControls.contains(increaseTextSize)).toBe(true);
    expect(screen.queryByRole("button", {
      name: "Reset text size to 100%",
    })).toBeNull();
    expect(screen.getByText("100%")).not.toBeNull();

    fireEvent.click(increaseTextSize);
    expect(screen.getByText("110%")).not.toBeNull();
    expect(document.documentElement.style.getPropertyValue(
      "--sadoku-font-scale",
    )).toBe("1.1");
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith("/__sadoku/settings", {
        body: JSON.stringify({
          codeWrap: "scroll",
          excludedDirectories: [".git", "node_modules"],
          fontScale: 1.1,
          markdownExtensions: [".md", ".markdown"],
          maxDepth: 2,
          maxFiles: 20,
          showHtmlComments: true,
          theme: "light",
        }),
        headers: { "content-type": "application/json" },
        method: "PUT",
      })
    );
    expect((decreaseTextSize as HTMLButtonElement).disabled).toBe(false);

    const maxDepthInput = screen.getByRole("spinbutton", {
      name: "Maximum depth",
    });
    const maxFilesInput = screen.getByRole("spinbutton", {
      name: "Maximum files",
    });
    const directoryDiscovery = screen.getByRole("group", {
      name: "Directory discovery",
    });
    expect(
      within(directoryDiscovery).getByRole("spinbutton", {
        name: "Maximum depth",
      }),
    ).toBe(maxDepthInput);
    expect(
      within(directoryDiscovery).getByRole("spinbutton", {
        name: "Maximum files",
      }),
    ).toBe(maxFilesInput);
    expect((maxDepthInput as HTMLInputElement).value).toBe("2");
    expect((maxFilesInput as HTMLInputElement).value).toBe("20");

    fireEvent.change(maxDepthInput, { target: { value: "4" } });
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith("/__sadoku/settings", {
        body: JSON.stringify({
          codeWrap: "scroll",
          excludedDirectories: [".git", "node_modules"],
          fontScale: 1.1,
          markdownExtensions: [".md", ".markdown"],
          maxDepth: 4,
          maxFiles: 20,
          showHtmlComments: true,
          theme: "light",
        }),
        headers: { "content-type": "application/json" },
        method: "PUT",
      })
    );

    fireEvent.change(maxFilesInput, { target: { value: "100" } });
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith("/__sadoku/settings", {
        body: JSON.stringify({
          codeWrap: "scroll",
          excludedDirectories: [".git", "node_modules"],
          fontScale: 1.1,
          markdownExtensions: [".md", ".markdown"],
          maxDepth: 4,
          maxFiles: 100,
          showHtmlComments: true,
          theme: "light",
        }),
        headers: { "content-type": "application/json" },
        method: "PUT",
      })
    );

    fireEvent.click(themeSelect);
    fireEvent.click(await screen.findByRole("option", { name: "Dark" }));
    await waitFor(() =>
      expect(document.documentElement.dataset.theme).toBe("dark")
    );
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe("dark");
    expect(screen.getByRole("dialog", { name: "Settings" })).not.toBeNull();
    expect(themeSelect.textContent).toBe("Dark");
    await waitFor(() =>
      expect(initializeMermaid).toHaveBeenLastCalledWith({ theme: "dark" })
    );
    expect(fetch).toHaveBeenCalledWith("/__sadoku/settings", {
      body: JSON.stringify({
        codeWrap: "scroll",
        excludedDirectories: [".git", "node_modules"],
        fontScale: 1.1,
        markdownExtensions: [".md", ".markdown"],
        maxDepth: 4,
        maxFiles: 100,
        showHtmlComments: true,
        theme: "dark",
      }),
      headers: { "content-type": "application/json" },
      method: "PUT",
    });

    fireEvent.click(themeSelect);
    fireEvent.click(await screen.findByRole("option", { name: "Light" }));
    await waitFor(() =>
      expect(document.documentElement.dataset.theme).toBe("light")
    );
    expect(document.documentElement.classList.contains("light")).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe("light");
    await waitFor(() =>
      expect(initializeMermaid).toHaveBeenLastCalledWith({ theme: "default" })
    );
    expect(fetch).toHaveBeenCalledWith("/__sadoku/settings", {
      body: JSON.stringify({
        codeWrap: "scroll",
        excludedDirectories: [".git", "node_modules"],
        fontScale: 1.1,
        markdownExtensions: [".md", ".markdown"],
        maxDepth: 4,
        maxFiles: 100,
        showHtmlComments: true,
        theme: "light",
      }),
      headers: { "content-type": "application/json" },
      method: "PUT",
    });

    const excludedDirectoriesInput = screen.getByRole("textbox", {
      name: "Excluded directories",
    });
    expect((excludedDirectoriesInput as HTMLInputElement).value).toBe("");
    expect(screen.getByText(".git")).not.toBeNull();
    expect(screen.getByText("node_modules")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", {
      name: "Delete tag node_modules",
    }));
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith("/__sadoku/settings", {
        body: JSON.stringify({
          codeWrap: "scroll",
          excludedDirectories: [".git"],
          fontScale: 1.1,
          markdownExtensions: [".md", ".markdown"],
          maxDepth: 4,
          maxFiles: 100,
          showHtmlComments: true,
          theme: "light",
        }),
        headers: { "content-type": "application/json" },
        method: "PUT",
      })
    );

    fireEvent.click(screen.getByRole("button", { name: "Close settings" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Settings" })).toBeNull()
    );
    await waitFor(() => expect(document.activeElement).toBe(settingsButton));
  });

  it("uses the OS theme and applies a selected theme when saving fails", async () => {
    vi.stubGlobal("EventSource", TestEventSource);
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true })));
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url === "/__sadoku/documents") {
          return Promise.resolve(
            Response.json([{
              id: 1,
              relativePath: "test.md",
              title: "test.md",
            }]),
          );
        }
        if (url === "/__sadoku/documents") {
          return Promise.resolve(
            Response.json([{
              id: 1,
              relativePath: "test.md",
              title: "test.md",
            }]),
          );
        }
        if (url === "/__sadoku/settings") {
          return Promise.resolve(new Response("Failed", { status: 500 }));
        }
        if (url === "/__sadoku/documents/1") {
          return Promise.resolve(Response.json({
            fileUrl: "file:///tmp/example.md",
            markdown: "# Example",
            title: "example.md",
          }));
        }
        if (url === "/__sadoku/documents/1/comments") {
          return Promise.resolve(
            Response.json({ comments: [], filePath: "/tmp/example.md" }),
          );
        }
        return Promise.resolve(new Response("Not found", { status: 404 }));
      }),
    );

    render(<App />);
    fireEvent.click(await screen.findByRole("treeitem", { name: "test.md" }));
    await screen.findByRole("link", { name: "example.md" });
    expect(document.documentElement.dataset.theme).toBe("dark");
    fireEvent.click(screen.getByRole("button", { name: "Open settings" }));
    const themeSelect = await screen.findByRole("combobox", { name: "Theme" });
    expect(themeSelect.textContent).toBe("Dark");
    fireEvent.click(themeSelect);
    fireEvent.click(await screen.findByRole("option", { name: "Light" }));
    await waitFor(() =>
      expect(document.documentElement.dataset.theme).toBe("light")
    );
    expect(themeSelect.textContent).toBe("Light");
    expect(screen.getByRole("dialog", { name: "Settings" })).not.toBeNull();
  });

  it("persists and switches code block wrapping", async () => {
    vi.stubGlobal("EventSource", TestEventSource);
    const fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/__sadoku/documents") {
        return Promise.resolve(
          Response.json([{ id: 1, relativePath: "test.md", title: "test.md" }]),
        );
      }
      if (url === "/__sadoku/settings") {
        return Promise.resolve(Response.json(
          init?.method === "PUT"
            ? {
              codeWrap: JSON.parse(String(init.body)).codeWrap,
              excludedDirectories: [".git", "node_modules"],
            }
            : {
              codeWrap: "wrap",
              excludedDirectories: [".git", "node_modules"],
            },
        ));
      }
      if (url === "/__sadoku/documents/1") {
        return Promise.resolve(Response.json({
          fileUrl: "file:///tmp/example.md",
          markdown: "```txt\n日本語の長いコードブロック\n```\n",
          title: "example.md",
        }));
      }
      if (url === "/__sadoku/documents/1/comments") {
        return Promise.resolve(Response.json({
          comments: [],
          filePath: "/tmp/example.md",
        }));
      }
      return Promise.resolve(new Response("Not found.", { status: 404 }));
    });
    vi.stubGlobal(
      "fetch",
      fetch,
    );

    render(<App />);
    fireEvent.click(await screen.findByRole("treeitem", { name: "test.md" }));

    const code = (await screen.findByText("日本語の長いコードブロック"))
      .closest("code")!;
    expect(code.parentElement?.tagName).toBe("PRE");
    expect(document.documentElement.dataset.codeWrap).toBe("wrap");

    expect(screen.queryByRole("button", { name: "Wrap code blocks" }))
      .toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Open settings" }));
    const wrapSwitch = await screen.findByRole("checkbox", {
      name: "Wrap code blocks",
    });
    expect((wrapSwitch as HTMLInputElement).checked).toBe(true);
    fireEvent.click(wrapSwitch);

    await waitFor(() =>
      expect(document.documentElement.dataset.codeWrap).toBe("scroll")
    );
    expect(fetch).toHaveBeenCalledWith("/__sadoku/settings", {
      body: JSON.stringify({
        codeWrap: "scroll",
        excludedDirectories: [".git", "node_modules"],
        fontScale: 1,
        markdownExtensions: [".md", ".markdown"],
        maxDepth: 2,
        maxFiles: 20,
        showHtmlComments: true,
        theme: "light",
      }),
      headers: { "content-type": "application/json" },
      method: "PUT",
    });
    expect((wrapSwitch as HTMLInputElement).checked).toBe(false);
    expect(screen.getByRole("dialog", { name: "Settings" })).not.toBeNull();
  });

  it("shows active and stale comments in the unresolved comments view", async () => {
    vi.stubGlobal("EventSource", TestEventSource);
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url === "/__sadoku/documents") {
          return Promise.resolve(
            Response.json([{
              id: 1,
              relativePath: "test.md",
              title: "test.md",
            }]),
          );
        }
        if (url === "/__sadoku/documents") {
          return Promise.resolve(
            Response.json([{
              id: 1,
              relativePath: "test.md",
              title: "test.md",
            }]),
          );
        }
        if (url === "/__sadoku/documents/1") {
          return Promise.resolve(Response.json({
            fileUrl: "file:///tmp/example.md",
            markdown: "# Title\n\nBody\n",
            title: "example.md",
          }));
        }
        if (url === "/__sadoku/documents/1/comments") {
          return Promise.resolve(Response.json({
            comments: [
              {
                body: "Active comment.",
                author: { type: "human" },
                createdAt: "2026-06-05T00:00:00.000Z",
                id: 1,
                endLine: 3,
                originalEndLine: 3,
                originalStartLine: 3,
                startLine: 3,
                resolved: false,
                sourceHash: 1,
                sourceText: "Body",
                stale: false,
                updatedAt: "2026-06-05T00:00:00.000Z",
              },
              {
                body: "Stale comment.",
                author: { type: "human" },
                createdAt: "2026-06-05T00:00:00.000Z",
                id: 2,
                endLine: 5,
                originalEndLine: 5,
                originalStartLine: 5,
                startLine: 5,
                resolved: false,
                sourceHash: "stale",
                sourceText: "Old body",
                stale: true,
                updatedAt: "2026-06-05T00:00:00.000Z",
              },
              {
                body: "Resolved comment.",
                author: { type: "human" },
                createdAt: "2026-06-05T00:00:00.000Z",
                id: 3,
                endLine: 3,
                originalEndLine: 3,
                originalStartLine: 3,
                startLine: 3,
                resolved: true,
                resolvedAt: "2026-06-05T00:01:00.000Z",
                sourceHash: 1,
                sourceText: "Body",
                stale: false,
                updatedAt: "2026-06-05T00:01:00.000Z",
              },
            ],
            filePath: "/tmp/example.md",
          }));
        }
        return Promise.resolve(new Response("Not found.", { status: 404 }));
      }),
    );

    render(<App />);
    fireEvent.click(await screen.findByRole("treeitem", { name: "test.md" }));

    await waitFor(() =>
      expect(screen.getByText("Active comment.")).not.toBeNull()
    );
    expect(screen.queryByText("Stale comment.")).toBeNull();

    const commentsButton = screen.getByRole("tab", {
      name: "Comments, 2 unresolved",
    });
    expect(
      commentsButton.querySelector('span[aria-hidden="true"]')?.textContent,
    )
      .toBe("2");
    fireEvent.click(commentsButton);

    expect(await screen.findByText("Active comment.")).not.toBeNull();
    expect(screen.getByText("Stale comment.")).not.toBeNull();
    expect(screen.getByText("Old body")).not.toBeNull();
    const unresolvedTab = screen.getByRole("tab", { name: "Unresolved" });
    expect(within(unresolvedTab).getByText("2")).not.toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "Resolved" }));
    expect(screen.getByText("Resolved comment.")).not.toBeNull();
  });
});
