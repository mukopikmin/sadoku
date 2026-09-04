import {
  cleanup,
  fireEvent,
  renderWithRouter as render,
  screen,
  waitFor,
  within,
} from "./testUtils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";
import { initializeMermaid } from "../markdown/mermaid";

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
      name: "Preview views",
    });
    expect(reloadButton.parentElement).toBe(previewNavigation);
    expect(
      reloadButton.previousElementSibling?.getAttribute("aria-label"),
    ).toBe("Open settings");

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

  it("keeps the preview header fixed at its initial position", async () => {
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

    const { container } = render(<App />);
    fireEvent.click(await screen.findByRole("treeitem", { name: "test.md" }));

    await screen.findByRole("link", { name: "example.md" });

    const brandIcon = screen.getByRole("img", { name: "Sadoku" });
    expect(brandIcon.getAttribute("src")).toBe("/assets/icon-512.png");
    expect(getComputedStyle(brandIcon).width).toBe(
      "var(--chakra-sizes-8)",
    );
    expect(getComputedStyle(brandIcon).height).toBe(
      "var(--chakra-sizes-8)",
    );
    const fileLink = screen.getByRole("link", { name: "example.md" });
    expect(fileLink.getAttribute("href")).toBe("file:///tmp/example.md");
    expect(screen.getByRole("navigation", { name: "Preview views" })).not
      .toBeNull();

    const header = container.querySelector("header");
    expect(header).not.toBeNull();
    const styles = getComputedStyle(header!);
    expect(styles.position).toBe("sticky");
    expect(styles.top).toBe("0px");
    expect(styles.zIndex).toBe("10");
    expect(styles.width).toBe("var(--chakra-sizes-full)");

    const headerContainer = header!.firstElementChild;
    expect(headerContainer).not.toBeNull();
    const headerContainerStyles = getComputedStyle(headerContainer!);
    expect(headerContainerStyles.maxWidth).toBe("980px");
    expect(headerContainerStyles.paddingInline).toBe(
      "var(--chakra-spacing-8)",
    );
    expect(headerContainerStyles.paddingBlock).toBe(
      "var(--chakra-spacing-4)",
    );
    expect(headerContainerStyles.flexWrap).toBe("wrap");

    const main = container.querySelector("main");
    expect(main).not.toBeNull();
    expect(header!.contains(main)).toBe(false);
    expect(header!.nextElementSibling).toBe(main);
    expect(getComputedStyle(main!).maxWidth).toBe("980px");
    expect(getComputedStyle(main!).paddingInline).toBe(
      "var(--chakra-spacing-8)",
    );
    expect(getComputedStyle(main!).paddingTop).toBe("0px");

    const previewButton = screen.getByRole("tab", { name: "Preview" });
    const commentsButton = screen.getByRole("tab", {
      name: "Comments, 0 unresolved",
    });
    expect(commentsButton.querySelector('span[aria-hidden="true"]')).toBeNull();
    expect(previewButton.parentElement).toBe(commentsButton.parentElement);
    expect(previewButton.getAttribute("data-part")).toBe("trigger");
    expect(commentsButton.getAttribute("data-part")).toBe("trigger");
    expect(previewButton.closest('[data-part="root"]')).toBe(
      commentsButton.closest('[data-part="root"]'),
    );
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
    const tableOfContentsButton = within(firstActionBar).getByRole("button", {
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
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Document actions" }))
        .toBeNull()
    );
    fireEvent.click(screen.getByRole("tab", { name: "Preview" }));

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
      name: "Preview views",
    });
    expect(settingsButton.parentElement).toBe(previewNavigation);
    expect(settingsButton.textContent).toBe("");
    expect(settingsButton.querySelector('svg[aria-hidden="true"]')).not
      .toBeNull();

    fireEvent.click(settingsButton);

    expect(await screen.findByRole("dialog", { name: "Settings" })).not
      .toBeNull();
    const themeSelect = screen.getByRole("combobox", { name: "Theme" });
    expect((themeSelect as HTMLSelectElement).value).toBe("light");
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
    expect(getComputedStyle(textSizeControls).alignItems).toBe("center");
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
    expect(getComputedStyle(directoryDiscovery).paddingInlineStart).not.toBe(
      "0px",
    );
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
          theme: "light",
        }),
        headers: { "content-type": "application/json" },
        method: "PUT",
      })
    );

    fireEvent.change(themeSelect, { target: { value: "dark" } });
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe("dark");
    expect(screen.getByRole("dialog", { name: "Settings" })).not.toBeNull();
    expect((themeSelect as HTMLSelectElement).value).toBe("dark");
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
        theme: "dark",
      }),
      headers: { "content-type": "application/json" },
      method: "PUT",
    });

    fireEvent.change(themeSelect, { target: { value: "light" } });
    expect(document.documentElement.dataset.theme).toBe("light");
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
        theme: "light",
      }),
      headers: { "content-type": "application/json" },
      method: "PUT",
    });

    const excludedDirectoriesInput = screen.getByRole("textbox", {
      name: "Excluded directories",
    });
    const excludedDirectoriesControl = excludedDirectoriesInput.closest(
      '[data-part="root"][data-scope="tags-input"]',
    );
    expect(getComputedStyle(excludedDirectoriesControl!).display).toBe("grid");
    expect(
      getComputedStyle(screen.getByText("Excluded directories")).alignItems,
    )
      .toBe("center");
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
    expect((themeSelect as HTMLSelectElement).value).toBe("dark");
    fireEvent.change(themeSelect, { target: { value: "light" } });
    expect(document.documentElement.dataset.theme).toBe("light");
    expect((themeSelect as HTMLSelectElement).value).toBe("light");
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

    const code = await screen.findByText("日本語の長いコードブロック");
    expect(document.documentElement.dataset.codeWrap).toBe("wrap");
    expect(getComputedStyle(code).whiteSpace).toBe("pre-wrap");
    expect(getComputedStyle(code).overflowWrap).toBe("anywhere");

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
        theme: "light",
      }),
      headers: { "content-type": "application/json" },
      method: "PUT",
    });
    expect(getComputedStyle(code).whiteSpace).toBe("pre");
    expect((wrapSwitch as HTMLInputElement).checked).toBe(false);
    expect(screen.getByRole("dialog", { name: "Settings" })).not.toBeNull();
  });

  it("shows stale comments only in the comments view", async () => {
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
    expect(screen.queryByText("Stale comment.")).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "Stale (1)" }));
    expect(screen.getByText("Stale comment.")).not.toBeNull();
    expect(screen.getByText("Old body")).not.toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "Resolved (1)" }));
    expect(screen.getByText("Resolved comment.")).not.toBeNull();
  });
});
