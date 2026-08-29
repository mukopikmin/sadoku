import { afterEach, describe, expect, it, vi } from "vitest";
import { loadDirectoryStatus } from "../api/directoryStatus";

afterEach(() => vi.unstubAllGlobals());

describe("directory status API", () => {
  it("converts a valid response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(Response.json({
          state: "loading",
          detected: 3,
          registered: 1,
        }))
      ),
    );
    await expect(loadDirectoryStatus()).resolves.toEqual({
      state: "loading",
      detected: 3,
      registered: 1,
    });
  });

  it("rejects invalid state", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(Response.json({
          state: "unknown",
          detected: 0,
          registered: 0,
        }))
      ),
    );
    await expect(loadDirectoryStatus()).rejects.toThrow(
      "Invalid directory status response.",
    );
  });
});
