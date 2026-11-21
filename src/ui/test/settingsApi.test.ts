import { afterEach, describe, expect, it, vi } from "vitest";
import { create } from "@bufbuild/protobuf";
import { loadSettings, saveSettings } from "../api/settings";
import { previewClient } from "../api/connect";
import { SettingsSchema } from "../gen/sadoku/preview/v1/preview_pb";

vi.mock("../api/connect", () => ({
  previewClient: { getSettings: vi.fn(), updateSettings: vi.fn() },
}));

afterEach(() => vi.resetAllMocks());

const settings = {
  fontScale: 1,
  maxDepth: 2,
  maxFiles: 20,
  markdownExtensions: [".md"],
};

describe("settings API", () => {
  it.each([undefined, true, false])(
    "converts highlight boundary visibility %s with a disabled default",
    async (showHighlightBoundaries) => {
      vi.mocked(previewClient.getSettings).mockResolvedValue(
        create(SettingsSchema, { ...settings, showHighlightBoundaries }),
      );
      expect((await loadSettings()).showHighlightBoundaries).toBe(
        showHighlightBoundaries ?? false,
      );
    },
  );

  it.each([undefined, true, false])(
    "converts HTML comment visibility %s",
    async (showHtmlComments) => {
      vi.mocked(previewClient.getSettings).mockResolvedValue(
        create(SettingsSchema, { ...settings, showHtmlComments }),
      );
      expect((await loadSettings()).showHtmlComments).toBe(
        showHtmlComments ?? true,
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
      showHighlightBoundaries: false,
      showHtmlComments: false,
    };
    vi.mocked(previewClient.updateSettings).mockResolvedValue(
      create(SettingsSchema, update),
    );
    expect((await saveSettings(update)).showHtmlComments).toBe(false);
    expect(previewClient.updateSettings).toHaveBeenCalledWith(update);
  });
});
