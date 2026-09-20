import { afterEach, describe, expect, it, vi } from "vitest";
import { loadDocuments, loadPreviewDocument } from "../api/document";
import { loadSession } from "../api/session";

afterEach(() => vi.unstubAllGlobals());

describe("document API tag conversion", () => {
  it("preserves validated tag background colors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) =>
        Response.json(
          String(input).endsWith("/1")
            ? {
              markdown: "# Doc",
              tags: [{ id: 2, name: "API", backgroundColor: "#A1B2C3" }],
            }
            : [{
              id: 1,
              title: "Doc",
              tags: [{ id: 2, name: "API", backgroundColor: "#A1B2C3" }],
            }],
        )
      ),
    );
    expect((await loadDocuments())[0].tags[0].backgroundColor).toBe("#a1b2c3");
    expect((await loadPreviewDocument(1)).tags[0].backgroundColor).toBe(
      "#a1b2c3",
    );
  });

  it("rejects unsafe tag background colors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json([
          {
            id: 1,
            title: "Doc",
            tags: [{ id: 2, name: "API", backgroundColor: "url(evil)" }],
          },
        ])
      ),
    );
    await expect(loadDocuments()).rejects.toThrow("Invalid tag response.");
  });

  it("keeps responses without tags backward compatible", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json([{ id: 1, title: "Doc" }])),
    );
    expect((await loadDocuments())[0].tags).toEqual([]);
  });
});

describe("session API conversion", () => {
  it("converts pull request metadata and supports sessions without it", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({
        pullRequest: {
          description: "First line\nSecond line",
          title: "Improve docs",
          url: "https://github.com/octo/repo/pull/23",
        },
      }))
      .mockResolvedValueOnce(Response.json({}));
    vi.stubGlobal("fetch", fetchMock);

    expect(await loadSession()).toEqual({
      pullRequest: {
        description: "First line\nSecond line",
        title: "Improve docs",
        url: "https://github.com/octo/repo/pull/23",
      },
    });
    expect(await loadSession()).toEqual({});
  });

  it.each([
    { description: "Body", title: 1, url: "https://github.com/o/r/pull/1" },
    { description: null, title: "Title", url: "https://github.com/o/r/pull/1" },
    { description: "Body", title: "Title", url: "javascript:alert(1)" },
  ])("rejects invalid pull request metadata: %j", async (pullRequest) => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ pullRequest })));
    await expect(loadSession()).rejects.toThrow("Invalid session response.");
  });
});
