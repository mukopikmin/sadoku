import { cleanup, fireEvent, render, screen, waitFor } from "./testUtils";
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

afterEach(() => {
  cleanup();
  document.documentElement.className = "";
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.removeAttribute("style");
  globalThis.localStorage?.clear?.();
  TestEventSource.instances = [];
  vi.mocked(initializeMermaid).mockClear();
  vi.unstubAllGlobals();
});

describe("App", () => {
  it("reruns mermaid rendering when returning to the preview view", async () => {
    vi.stubGlobal("EventSource", TestEventSource);
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url === "/__sadoku/document") {
          return Promise.resolve(Response.json({
            fileUrl: "file:///tmp/example.md",
            markdown: "```mermaid\ngraph TD\n  A --> B\n```\n",
            title: "example.md",
          }));
        }
        if (url === "/__sadoku/comments") {
          return Promise.resolve(Response.json({
            comments: [],
            filePath: "/tmp/example.md",
          }));
        }
        return Promise.resolve(new Response("Not found.", { status: 404 }));
      }),
    );

    render(<App />);

    await waitFor(() => expect(initializeMermaid).toHaveBeenCalledTimes(1));

    fireEvent.click(
      screen.getByRole("tab", { name: "Comments, 0 unresolved" }),
    );
    fireEvent.click(screen.getByRole("tab", { name: "Preview" }));

    await waitFor(() => expect(initializeMermaid).toHaveBeenCalledTimes(2));
  });

  it("reloads the Markdown and comments without changing views", async () => {
    let documentRequests = 0;
    let commentRequests = 0;
    vi.stubGlobal("EventSource", TestEventSource);
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url === "/__sadoku/document") {
          documentRequests += 1;
          return Promise.resolve(Response.json({
            fileUrl: "file:///tmp/example.md",
            markdown: documentRequests === 1
              ? "# Original title\n\n```mermaid\ngraph TD\n  A --> B\n```\n"
              : "# Updated title\n\n```mermaid\ngraph LR\n  C --> D\n```\n",
            title: "example.md",
          }));
        }
        if (url === "/__sadoku/comments") {
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

    await screen.findByRole("heading", { name: "Original title" });
    await waitFor(() => expect(initializeMermaid).toHaveBeenCalledTimes(1));

    fireEvent.click(
      screen.getByRole("tab", { name: "Comments, 0 unresolved" }),
    );
    expect(
      screen.getByRole("tab", { name: "Comments, 0 unresolved" })
        .getAttribute("aria-selected"),
    ).toBe("true");

    expect(screen.queryByRole("button", { name: "Reload preview" })).toBeNull();

    TestEventSource.instances.at(-1)?.dispatchEvent(new Event("reload"));

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
        if (url === "/__sadoku/document") {
          documentRequests += 1;
          return documentRequests === 1
            ? Promise.resolve(Response.json({
              fileUrl: "file:///tmp/example.md",
              markdown: "# Original title\n",
              title: "example.md",
            }))
            : Promise.resolve(new Response("Failed.", { status: 500 }));
        }
        if (url === "/__sadoku/comments") {
          return Promise.resolve(Response.json({
            comments: [],
            filePath: "/tmp/example.md",
          }));
        }
        return Promise.resolve(new Response("Not found.", { status: 404 }));
      }),
    );

    render(<App />);
    await screen.findByRole("heading", { name: "Original title" });
    TestEventSource.instances.at(-1)?.dispatchEvent(new Event("reload"));

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
        if (url === "/__sadoku/document") {
          return Promise.resolve(Response.json({
            fileUrl: "file:///tmp/example.md",
            markdown: "# Title\n\nBody\n",
            title: "example.md",
          }));
        }
        if (url === "/__sadoku/comments") {
          return Promise.resolve(Response.json({
            comments: [],
            filePath: "/tmp/example.md",
          }));
        }
        return Promise.resolve(new Response("Not found.", { status: 404 }));
      }),
    );

    const { container } = render(<App />);

    await screen.findByRole("link", { name: "example.md" });

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

  it("opens settings and selects and saves light and dark preview themes", async () => {
    vi.stubGlobal("EventSource", TestEventSource);
    const fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/__sadoku/settings") {
        return Promise.resolve(Response.json(
          init?.method === "PUT"
            ? JSON.parse(String(init.body))
            : { theme: "light" },
        ));
      }
      if (url === "/__sadoku/document") {
        return Promise.resolve(Response.json({
          fileUrl: "file:///tmp/example.md",
          markdown: "```mermaid\ngraph TD\n  A --> B\n```\n",
          title: "example.md",
        }));
      }
      if (url === "/__sadoku/comments") {
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
    await waitFor(() => expect(document.activeElement).toBe(themeSelect));

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
      body: JSON.stringify({ theme: "dark" }),
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
      body: JSON.stringify({ theme: "light" }),
      headers: { "content-type": "application/json" },
      method: "PUT",
    });

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
        if (url === "/__sadoku/settings") {
          return Promise.resolve(new Response("Failed", { status: 500 }));
        }
        if (url === "/__sadoku/document") {
          return Promise.resolve(Response.json({
            fileUrl: "file:///tmp/example.md",
            markdown: "# Example",
            title: "example.md",
          }));
        }
        if (url === "/__sadoku/comments") {
          return Promise.resolve(
            Response.json({ comments: [], filePath: "/tmp/example.md" }),
          );
        }
        return Promise.resolve(new Response("Not found", { status: 404 }));
      }),
    );

    render(<App />);
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

  it("shows stale comments only in the comments view", async () => {
    vi.stubGlobal("EventSource", TestEventSource);
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url === "/__sadoku/document") {
          return Promise.resolve(Response.json({
            fileUrl: "file:///tmp/example.md",
            markdown: "# Title\n\nBody\n",
            title: "example.md",
          }));
        }
        if (url === "/__sadoku/comments") {
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

    expect(screen.getByText("Active comment.")).not.toBeNull();
    expect(screen.queryByText("Stale comment.")).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "Stale (1)" }));
    expect(screen.getByText("Stale comment.")).not.toBeNull();
    expect(screen.getByText("Old body")).not.toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "Resolved (1)" }));
    expect(screen.getByText("Resolved comment.")).not.toBeNull();
  });
});
