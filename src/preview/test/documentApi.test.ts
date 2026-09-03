import { afterEach, describe, expect, it, vi } from "vitest";
import { loadDocuments, loadPreviewDocument } from "../api/document";

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
});
