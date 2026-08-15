import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "./testUtils";
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
];

const installFetch = (failDocumentId?: number) =>
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
  it("lists documents, selects one without changing the URL, and returns", async () => {
    vi.stubGlobal("EventSource", DirectoryEventSource);
    installFetch();
    const initialUrl = location.href;
    render(<App />);

    expect(await screen.findByRole("button", { name: "guides/alpha.md" })).not
      .toBeNull();
    expect(screen.getByRole("button", { name: "beta.md" })).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "guides/alpha.md" }));
    expect(await screen.findByRole("heading", { name: "Document 1" })).not
      .toBeNull();
    expect(location.href).toBe(initialUrl);
    fireEvent.click(screen.getByRole("button", { name: "← Documents" }));
    expect(await screen.findByRole("button", { name: "beta.md" })).not
      .toBeNull();
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

  it("switches document data and EventSources without showing the previous document", async () => {
    vi.stubGlobal("EventSource", DirectoryEventSource);
    installFetch();
    render(<App />);
    fireEvent.click(
      await screen.findByRole("button", { name: "guides/alpha.md" }),
    );
    await screen.findByRole("heading", { name: "Document 1" });
    const documentOneEvents = DirectoryEventSource.instances.at(-1)!;
    fireEvent.click(screen.getByRole("button", { name: "← Documents" }));
    await screen.findByRole("button", { name: "beta.md" });
    expect(documentOneEvents.closed).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "beta.md" }));
    expect(screen.queryByRole("heading", { name: "Document 1" })).toBeNull();
    await screen.findByRole("heading", { name: "Document 2" });
    expect(DirectoryEventSource.instances.at(-1)?.url).toBe(
      "/__sadoku/documents/2/events",
    );
  });

  it("can return to the list after a document error", async () => {
    vi.stubGlobal("EventSource", DirectoryEventSource);
    installFetch(1);
    render(<App />);
    fireEvent.click(
      await screen.findByRole("button", { name: "guides/alpha.md" }),
    );
    expect(await screen.findByText("Failed to load Markdown: 500")).not
      .toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "← Documents" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "beta.md" })).not.toBeNull()
    );
  });
});
