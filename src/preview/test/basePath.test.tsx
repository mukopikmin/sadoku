import { afterEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@connectrpc/connect";
import { Link, RouterProvider } from "@tanstack/react-router";
import { previewPath, readPreviewBasePath } from "../api/basePath";
import { createPreviewTransport } from "../api/connect";
import { connectHotReload, connectPreviewKeepAlive } from "../api/hotReload";
import { PreviewService } from "../../../gen/ts/sadoku/preview/v1/preview_pb";
import { createPreviewRouter } from "../router";
import { usePreviewRoute } from "../hooks/usePreviewRoute";
import {
  cleanup,
  fireEvent,
  render as renderWithChakra,
  screen,
  waitFor,
} from "./testUtils";

const setBasePath = (value: string) => {
  const root = document.createElement("div");
  root.id = "sadoku-client-root";
  root.dataset.basePath = value;
  document.body.append(root);
  return root;
};

afterEach(() => {
  cleanup();
  document.getElementById("sadoku-client-root")?.remove();
  vi.unstubAllGlobals();
});

describe("public base paths", () => {
  it("keeps root URLs when no configuration is present", () => {
    expect(readPreviewBasePath()).toBe("");
    expect(previewPath("/assets/icon-512.png")).toBe("/assets/icon-512.png");
  });

  it.each([
    "//evil.test",
    "/a/../b",
    "/a%2Fb",
    "/a?b",
    "/a/",
    "https://evil.test",
  ])(
    "rejects invalid browser configuration %s",
    (value) => {
      setBasePath(value);
      expect(() => readPreviewBasePath()).toThrow("Invalid public base path");
    },
  );

  it.each(["v1", "staging"])(
    "uses the HTML prefix for %s API and SSE requests",
    async (tag) => {
      const prefix = `/revisions/${tag}`;
      setBasePath(prefix);
      const fetch = vi.fn().mockResolvedValue(Response.json({}));
      vi.stubGlobal("fetch", fetch);
      const client = createClient(PreviewService, createPreviewTransport());
      await client.getSession({});
      const [input, init] = fetch.mock.calls[0];
      expect(new URL(String(input)).pathname).toBe(
        `${prefix}/sadoku.preview.v1.PreviewService/GetSession`,
      );
      expect(init.method).toBe("POST");
      expect(previewPath("/assets/icon-512.png")).toBe(
        `${prefix}/assets/icon-512.png`,
      );
      const urls: string[] = [];
      class Events extends EventTarget {
        constructor(url: string) {
          super();
          urls.push(url);
        }
        close() {}
      }
      const stopKeepAlive = connectPreviewKeepAlive({
        EventSourceCtor: Events as unknown as typeof EventSource,
      });
      const stopDocument = connectHotReload({
        documentId: 7,
        EventSourceCtor: Events as unknown as typeof EventSource,
      });
      expect(urls).toEqual([
        `${prefix}/__sadoku/events`,
        `${prefix}/__sadoku/documents/7/events`,
      ]);
      stopKeepAlive();
      stopDocument();
    },
  );

  it("matches a deep public URL and retains the prefix during document navigation", async () => {
    setBasePath("/revisions/pr-42");
    const RouteView = () => {
      const route = usePreviewRoute();
      return (
        <>
          <p>
            {route.isDocumentList
              ? "Document list"
              : `Document ${route.documentId}`}
          </p>
          <Link to="/documents/$documentId" params={{ documentId: "8" }}>
            Next document
          </Link>
          <Link to="/">Back to list</Link>
        </>
      );
    };
    const router = createPreviewRouter(RouteView, [
      "/revisions/pr-42/documents/7",
    ]);
    renderWithChakra(<RouterProvider router={router} />);
    await screen.findByText("Document 7");
    expect(
      screen.getByRole("link", { name: "Next document" }).getAttribute("href"),
    )
      .toBe("/revisions/pr-42/documents/8");
    fireEvent.click(screen.getByRole("link", { name: "Next document" }));
    await screen.findByText("Document 8");
    fireEvent.click(screen.getByRole("link", { name: "Back to list" }));
    await screen.findByText("Document list");
    await waitFor(() =>
      expect(router.history.location.pathname).toBe("/revisions/pr-42/")
    );
  });
});
