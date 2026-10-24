import { renderWithRouter as render } from "./routerTestUtils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "./testUtils";
import { App } from "../App";

class TestEventSource extends EventTarget {
  close() {}
}

const installFetch = (
  { empty = false, enabled = true, conflict = false } = {},
) => {
  const documents = empty ? [] : [{
    id: 1,
    deleted: false,
    relativePath: "docs/guides/setup.md",
    title: "setup.md",
    tags: [],
  }];
  let fail = conflict;
  const requests: Array<Record<string, string>> = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = new URL(
        input instanceof Request ? input.url : String(input),
        location.origin,
      ).pathname;
      if (path.endsWith("/GetSession")) {
        return Response.json({ canCreateDocuments: enabled });
      }
      if (path.endsWith("/CreateDocument")) {
        const body = JSON.parse(
          await new Request(input, init).text(),
        ) as Record<string, string>;
        requests.push(body);
        if (fail) {
          fail = false;
          return Response.json({
            code: "already_exists",
            message: "A file or folder with this name already exists.",
          }, { status: 409 });
        }
        const filename = body.filename.includes(".")
          ? body.filename
          : `${body.filename}.md`;
        const document = {
          id: 2,
          deleted: false,
          relativePath: [body.directory, filename].filter(Boolean).join("/"),
          title: filename,
          tags: [],
        };
        documents.push(document);
        return Response.json(document);
      }
      if (path === "/__sadoku/documents") return Response.json(documents);
      if (path === "/__sadoku/directory-status") {
        return Response.json({
          state: "ready",
          detected: documents.length,
          registered: documents.length,
        });
      }
      if (path === "/__sadoku/settings") return Response.json({});
      if (/\/documents\/\d+$/.test(path)) {
        return Response.json({
          markdown: "# New guide\n",
          displayTitle: "File attribute title",
          title: "new.md",
          fileUrl: "file:///docs/new.md",
          tags: [],
        });
      }
      if (path.endsWith("/comments")) {
        return Response.json({ comments: [], filePath: "/docs/new.md" });
      }
      if (path.endsWith("/instructions")) {
        return Response.json({ instructions: [] });
      }
      if (path.endsWith("/memories")) {
        return Response.json({ memories: [] });
      }
      return new Response("Not found", { status: 404 });
    }),
  );
  return requests;
};

beforeEach(() => {
  vi.stubGlobal("EventSource", TestEventSource);
  vi.stubGlobal("scrollTo", vi.fn());
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("file creation from the document list", () => {
  it("prevents duplicate submissions and cancellation while creation is pending", async () => {
    const requests = installFetch();
    const fetch = globalThis.fetch;
    let release = () => {};
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    const createRequests = vi.fn();
    vi.stubGlobal(
      "fetch",
      async (input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input).endsWith("/CreateDocument")) {
          createRequests();
          await pending;
        }
        return fetch(input, init);
      },
    );
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "New file" }));
    fireEvent.change(screen.getByRole("textbox", { name: /Filename/ }), {
      target: { value: "new" },
    });
    const form = screen.getByRole("dialog").querySelector("form")!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    await waitFor(() => expect(createRequests).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveProperty(
      "disabled",
      true,
    );
    expect(screen.getByRole("textbox", { name: /Filename/ })).toHaveProperty(
      "disabled",
      true,
    );
    release();
    await waitFor(() => expect(location.pathname).toBe("/documents/2"));
    expect(requests).toHaveLength(1);
  });
  it("uses the clicked directory, accepts an optional title, opens the preview and updates the list", async () => {
    const requests = installFetch();
    render(<App />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Create file in docs/guides" }),
    );
    expect(screen.getByText("Directory: docs/guides")).toBeTruthy();
    const filename = screen.getByRole("textbox", { name: /Filename/ });
    fireEvent.change(filename, { target: { value: "new" } });
    fireEvent.change(
      screen.getByRole("textbox", { name: "Document title (optional)" }),
      { target: { value: "New guide" } },
    );
    expect(screen.getByText("File: docs/guides/new.md")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Create", exact: true }),
    );
    await waitFor(() => expect(location.pathname).toBe("/documents/2"));
    expect(await screen.findByRole("heading", { name: "New guide" }))
      .toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "File attribute title", level: 1 }),
    ).toBeTruthy();
    expect(requests).toEqual([{
      directory: "docs/guides",
      filename: "new",
      title: "New guide",
    }]);
    fireEvent.click(
      screen.getByRole("link", { name: "Documents", exact: true }),
    );
    expect(await screen.findByRole("treeitem", { name: "new.md" }))
      .toBeTruthy();
  });

  it("can create at the root of an empty directory without a title", async () => {
    const requests = installFetch({ empty: true });
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "New file" }));
    expect(screen.getByText("Directory: Project root")).toBeTruthy();
    fireEvent.change(screen.getByRole("textbox", { name: /Filename/ }), {
      target: { value: "new.md" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Create", exact: true }),
    );
    await waitFor(() => expect(location.pathname).toBe("/documents/2"));
    expect(requests[0].directory ?? "").toBe("");
    expect(requests[0].title ?? "").toBe("");
  });

  it("keeps both fields on conflict so the filename can be corrected and retried", async () => {
    installFetch({ conflict: true });
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "New file" }));
    fireEvent.change(screen.getByRole("textbox", { name: /Filename/ }), {
      target: { value: "existing.md" },
    });
    fireEvent.change(
      screen.getByRole("textbox", { name: "Document title (optional)" }),
      { target: { value: "New guide" } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Create", exact: true }),
    );
    expect((await screen.findByRole("alert")).textContent).toContain(
      "already exists",
    );
    expect(screen.getByRole("textbox", { name: /Filename/ })).toHaveProperty(
      "value",
      "existing.md",
    );
    expect(screen.getByRole("textbox", { name: "Document title (optional)" }))
      .toHaveProperty("value", "New guide");
    fireEvent.change(screen.getByRole("textbox", { name: /Filename/ }), {
      target: { value: "new.md" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Create", exact: true }),
    );
    await waitFor(() => expect(location.pathname).toBe("/documents/2"));
  });

  it("cancels without creating and resets fields for the next folder", async () => {
    const requests = installFetch();
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "New file" }));
    fireEvent.change(screen.getByRole("textbox", { name: /Filename/ }), {
      target: { value: "discard.md" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fireEvent.click(
      screen.getByRole("button", { name: "Create file in docs" }),
    );
    expect(screen.getByRole("textbox", { name: /Filename/ })).toHaveProperty(
      "value",
      "",
    );
    expect(screen.getByText("Directory: docs")).toBeTruthy();
    expect(requests).toEqual([]);
  });

  it("hides creation actions when the session does not support writing files", async () => {
    installFetch({ enabled: false });
    render(<App />);
    expect(await screen.findByRole("treeitem", { name: "setup.md" }))
      .toBeTruthy();
    expect(screen.queryByRole("button", { name: "New file" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Create file in/ })).toBeNull();
  });
});
