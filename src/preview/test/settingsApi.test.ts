import { afterEach, describe, expect, it, vi } from "vitest";
import { loadSettings, saveSettings } from "../api/settings";
import { previewClient } from "../api/connect";

vi.mock("../api/connect", () => ({
  previewClient: { getSettings: vi.fn(), updateSettings: vi.fn() },
}));

afterEach(() => vi.resetAllMocks());

describe("settings API", () => {
  it.each([undefined, true, false])(
    "converts HTML comment visibility %s",
    async (showHtmlComments) => {
      vi.mocked(previewClient.getSettings).mockResolvedValue(
        { showHtmlComments } as never,
      );
      expect((await loadSettings()).showHtmlComments).toBe(
        showHtmlComments ?? true,
      );
    },
  );

  it.each([null, "false", 0])(
    "rejects invalid HTML comment visibility %s",
    async (showHtmlComments) => {
      vi.mocked(previewClient.getSettings).mockResolvedValue(
        { showHtmlComments } as never,
      );
      await expect(loadSettings()).rejects.toThrow(
        "invalid HTML comment visibility",
      );
    },
  );

  it("saves hidden HTML comments and reads the saved value", async () => {
    const update = {
      codeWrap: "scroll" as const,
      excludedDirectories: [],
      fontScale: 1,
      maxDepth: 2,
      maxFiles: 20,
      markdownExtensions: [".md"],
      theme: "light" as const,
      showHtmlComments: false,
    };
    vi.mocked(previewClient.updateSettings).mockResolvedValue(update as never);
    expect((await saveSettings(update)).showHtmlComments).toBe(false);
    expect(previewClient.updateSettings).toHaveBeenCalledWith(update);
  });
});
