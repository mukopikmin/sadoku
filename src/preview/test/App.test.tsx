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

    await waitFor(() => expect(initializeMermaid).toHaveBeenCalledTimes(2));

    fireEvent.click(screen.getByRole("button", { name: "Comments 0" }));
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));

    await waitFor(() => expect(initializeMermaid).toHaveBeenCalledTimes(4));
  });

  it("shows a reload button when source changes are available", async () => {
    const reload = vi.fn();
    vi.stubGlobal("EventSource", TestEventSource);
    vi.stubGlobal("location", { reload });
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

    render(<App />);

    await screen.findByRole("link", { name: "example.md" });

    expect(screen.queryByRole("button", { name: "Reload preview" })).toBeNull();

    TestEventSource.instances.at(-1)?.dispatchEvent(new Event("reload"));

    const reloadButton = await screen.findByRole("button", {
      name: "Reload preview",
    });
    expect(screen.getByText("Source changes are available.")).not.toBeNull();
    expect(reload).not.toHaveBeenCalled();

    fireEvent.click(reloadButton);

    expect(reload).toHaveBeenCalledTimes(1);
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
    expect(styles.paddingTop).toBe("32px");

    const main = container.querySelector("main");
    expect(main).not.toBeNull();
    expect(getComputedStyle(main!).paddingTop).toBe("0px");

    const previewButton = screen.getByRole("button", { name: "Preview" });
    const commentsButton = screen.getByRole("button", { name: "Comments 0" });
    expect(previewButton.parentElement).toBe(commentsButton.parentElement);
    expect(previewButton.getAttribute("data-group-item")).toBe("");
    expect(previewButton.getAttribute("data-first")).toBe("");
    expect(commentsButton.getAttribute("data-group-item")).toBe("");
    expect(commentsButton.getAttribute("data-last")).toBe("");
  });

  it("switches between light and dark preview themes", async () => {
    const localStorage = createTestStorage({ "sadoku-theme": "light" });
    vi.stubGlobal("localStorage", localStorage);
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

    await screen.findByRole("link", { name: "example.md" });
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.documentElement.classList.contains("light")).toBe(true);
    expect(localStorage.getItem("sadoku-theme")).toBe("light");
    await waitFor(() =>
      expect(initializeMermaid).toHaveBeenLastCalledWith({ theme: "default" })
    );

    const themeButton = screen.getByRole("button", {
      name: "Switch to dark mode",
    });
    expect(themeButton.textContent).toBe("");
    expect(themeButton.querySelector('svg[aria-hidden="true"]')).not.toBeNull();

    fireEvent.click(themeButton);

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("sadoku-theme")).toBe("dark");
    expect(
      screen.getByRole("button", {
        name: "Switch to light mode",
      }).querySelector('svg[aria-hidden="true"]'),
    ).not.toBeNull();
    await waitFor(() =>
      expect(initializeMermaid).toHaveBeenLastCalledWith({ theme: "dark" })
    );
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

    fireEvent.click(screen.getByRole("button", { name: /Comments 2/ }));

    expect(screen.getByText("Active comment.")).not.toBeNull();
    expect(screen.getByText("Stale comment.")).not.toBeNull();
    expect(screen.getByText("Old body")).not.toBeNull();
  });
});
