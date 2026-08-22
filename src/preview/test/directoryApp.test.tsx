import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  renderWithRouter as render,
  screen,
  waitFor,
} from "./testUtils";
import { App } from "../App";

class DirectoryEventSource extends EventTarget {
  static instances: DirectoryEventSource[] = [];
  closed = false;
  constructor(readonly url: string) {
    super();
    DirectoryEventSource.instances.push(this);
  }
  close() {
    this.closed = true;
  }
}

const documents = [
  { id: 1, relativePath: "guides/alpha.md", title: "Alpha" },
  { id: 2, relativePath: "beta.md", title: "Beta" },
  { id: 3, relativePath: "guides/nested/gamma.md", title: "Gamma" },
];

const installFetch = (
  failDocumentId?: number,
  pendingDocument?: Promise<Response>,
) =>
  vi.stubGlobal(
    "fetch",
    vi.fn(
      (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === "/__sadoku/documents") {
          return Promise.resolve(
            Response.json(documents),
          );
        }
        const documentMatch = url.match(/^\/__sadoku\/documents\/(\d+)$/);
        if (documentMatch) {
          const id = Number(documentMatch[1]);
          if (pendingDocument) {
            return pendingDocument;
          }
          if (id === failDocumentId) {
            return Promise.resolve(
              new Response("Failed", { status: 500 }),
            );
          }
          return Promise.resolve(Response.json({
            fileUrl: `file:///tmp/${id}.md`,
            markdown: `# Document ${id}\n`,
            title: `Document ${id}`,
          }));
        }
        const commentsMatch = url.match(
          /^\/__sadoku\/documents\/(\d+)\/comments$/,
        );
        if (commentsMatch) {
          return Promise.resolve(
            Response.json({
              comments: [],
              filePath: `/tmp/${commentsMatch[1]}.md`,
            }),
          );
        }
        if (url === "/__sadoku/settings") {
          return Promise.resolve(
            Response.json({}),
          );
        }
        return Promise.resolve(new Response("Not found", { status: 404 }));
      },
    ),
  );

afterEach(() => {
  cleanup();
  DirectoryEventSource.instances = [];
  vi.unstubAllGlobals();
});

describe("directory preview", () => {
  it("lists documents, routes to one, and returns through breadcrumbs", async () => {
    vi.stubGlobal("EventSource", DirectoryEventSource);
    installFetch();
    render(<App />);

    expect(await screen.findByRole("treeitem", { name: "alpha.md" })).not
      .toBeNull();
    expect(screen.getByRole("treeitem", { name: "beta.md" })).not.toBeNull();
    expect(screen.getByRole("treeitem", { name: /guides/ })).not.toBeNull();
    expect(screen.getByRole("button", { name: "guides folder" })).not
      .toBeNull();
    expect(screen.getByRole("img", { name: "Sadoku" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Open settings" })).not
      .toBeNull();
    expect(screen.getByRole("tab", { name: "Preview" })).toHaveProperty(
      "disabled",
      true,
    );
    expect(
      screen.getByRole("tab", { name: "Comments, 0 unresolved" }),
    ).toHaveProperty("disabled", true);
    fireEvent.click(screen.getByRole("treeitem", { name: "alpha.md" }));
    expect(await screen.findByRole("heading", { name: "Document 1" })).not
      .toBeNull();
    expect(location.pathname).toBe("/documents/1");
    const breadcrumbs = screen.getByRole("navigation", {
      name: "Document path",
    });
    expect(breadcrumbs.textContent).toContain("guides");
    expect(breadcrumbs.textContent).toContain("alpha.md");
    fireEvent.click(screen.getByRole("button", { name: "guides" }));
    const directoryDialog = await screen.findByRole("dialog", {
      name: "guides",
    });
    expect(directoryDialog.textContent).toContain("alpha.md");
    expect(directoryDialog.textContent).not.toContain("gamma.md");
    const currentDocument = screen.getByRole("button", {
      name: "alpha.md Current",
    });
    expect(currentDocument.getAttribute("aria-current")).toBe("page");
    fireEvent.click(currentDocument);
    await waitFor(() => expect(location.pathname).toBe("/documents/1"));
    expect(screen.queryByRole("button", { name: "← Documents" })).toBeNull();
    fireEvent.click(screen.getByRole("link", { name: "Documents" }));
    expect(await screen.findByRole("treeitem", { name: "beta.md" })).not
      .toBeNull();
    expect(location.pathname).toBe("/");
  });

  it("routes between preview and comments and restores the view from history", async () => {
    vi.stubGlobal("EventSource", DirectoryEventSource);
    installFetch();
    render(<App />);

    fireEvent.click(
      await screen.findByRole("treeitem", { name: "alpha.md" }),
    );
    await screen.findByRole("heading", { name: "Document 1" });
    fireEvent.click(
      screen.getByRole("tab", { name: "Comments, 0 unresolved" }),
    );
    await waitFor(() =>
      expect(location.pathname).toBe("/documents/1/comments")
    );
    expect(await screen.findByRole("heading", { name: /comments \(0\)/i }))
      .not.toBeNull();

    history.replaceState(null, "", "/documents/1");
    dispatchEvent(new PopStateEvent("popstate"));
    await waitFor(() => expect(location.pathname).toBe("/documents/1"));
    expect(
      screen.getByRole("tab", { name: "Preview" }).getAttribute(
        "aria-selected",
      ),
    ).toBe("true");
  });

  it("opens a document comments deep link and shows invalid documents as not found", async () => {
    vi.stubGlobal("EventSource", DirectoryEventSource);
    installFetch();
    history.replaceState(null, "", "/documents/2/comments");
    const { unmount } = render(<App />);
    expect(await screen.findByRole("heading", { name: /comments \(0\)/i }))
      .not.toBeNull();
    expect(location.pathname).toBe("/documents/2/comments");

    unmount();
    history.replaceState(null, "", "/documents/999");
    render(<App />);
    expect(await screen.findByText("Document not found.")).not.toBeNull();
    expect(document.title).toBe("Not Found — Sadoku");
  });

  it("renders the empty state", async () => {
    vi.stubGlobal("EventSource", DirectoryEventSource);
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) =>
        Promise.resolve(
          String(input) === "/__sadoku/documents"
            ? Response.json([])
            : Response.json({}),
        )
      ),
    );
    render(<App />);
    expect(await screen.findByText("No Markdown documents found.")).not
      .toBeNull();
  });

  it("keeps the shared header mounted while a document loads", async () => {
    vi.stubGlobal("EventSource", DirectoryEventSource);
    let resolveDocument!: (response: Response) => void;
    const pendingDocument = new Promise<Response>((resolve) => {
      resolveDocument = resolve;
    });
    installFetch(undefined, pendingDocument);
    const { container } = render(<App />);

    const documentButton = await screen.findByRole("treeitem", {
      name: "alpha.md",
    });
    fireEvent.click(documentButton);
    expect(await screen.findByText("Loading preview...")).not.toBeNull();
    expect(container.querySelector("header")).not.toBeNull();
    expect(screen.getByRole("tab", { name: "Preview" })).toHaveProperty(
      "disabled",
      true,
    );

    resolveDocument(Response.json({
      fileUrl: "file:///tmp/1.md",
      markdown: "# Document 1\n",
      title: "Document 1",
    }));
    expect(await screen.findByRole("heading", { name: "Document 1" })).not
      .toBeNull();
    expect(container.querySelector("header")).not.toBeNull();
    expect(screen.getByRole("tab", { name: "Preview" })).toHaveProperty(
      "disabled",
      false,
    );
  });

  it("keeps the preview alive while switching document EventSources", async () => {
    vi.stubGlobal("EventSource", DirectoryEventSource);
    installFetch();
    render(<App />);
    const firstDocument = await screen.findByRole("treeitem", {
      name: "alpha.md",
    });
    const keepAliveEvents = DirectoryEventSource.instances.at(-1)!;
    expect(keepAliveEvents.url).toBe("/__sadoku/events");
    fireEvent.click(firstDocument);
    await screen.findByRole("heading", { name: "Document 1" });
    const documentOneEvents = DirectoryEventSource.instances.at(-1)!;
    fireEvent.click(screen.getByRole("link", { name: "Documents" }));
    await screen.findByRole("treeitem", { name: "beta.md" });
    expect(documentOneEvents.closed).toBe(true);
    expect(keepAliveEvents.closed).toBe(false);
    fireEvent.click(screen.getByRole("treeitem", { name: "beta.md" }));
    expect(screen.queryByRole("heading", { name: "Document 1" })).toBeNull();
    await screen.findByRole("heading", { name: "Document 2" });
    expect(DirectoryEventSource.instances.at(-1)?.url).toBe(
      "/__sadoku/documents/2/events",
    );
    expect(keepAliveEvents.closed).toBe(false);
  });

  it("can return to the list after a document error", async () => {
    vi.stubGlobal("EventSource", DirectoryEventSource);
    installFetch(1);
    render(<App />);
    fireEvent.click(
      await screen.findByRole("treeitem", { name: "alpha.md" }),
    );
    expect(await screen.findByText("Failed to load Markdown: 500")).not
      .toBeNull();
    fireEvent.click(screen.getByRole("link", { name: "Documents" }));
    await waitFor(() =>
      expect(screen.getByRole("treeitem", { name: "beta.md" })).not.toBeNull()
    );
  });
});
