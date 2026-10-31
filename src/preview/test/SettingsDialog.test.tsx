import { afterEach, expect, it, vi } from "vitest";
import {
  SettingsDialog,
  type SettingsDialogProps,
} from "../components/SettingsDialog";
import { cleanup, fireEvent, render, screen, waitFor } from "./testUtils";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("closes statistics when settings closes and keeps it closed on reopening", async () => {
  vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) =>
    Promise.resolve(Response.json(String(input).endsWith("/GetStatistics")
      ? {
        commentCount: { bot: "4", human: "12" },
        databaseSize: "1536",
        documentCount: "3",
      }
      : { ok: false }))
  ));
  const props: SettingsDialogProps = {
    onCodeWrapModeChange: vi.fn(),
    onDirectoryLimitsChange: vi.fn(),
    onExcludedDirectoriesChange: vi.fn(),
    onFontScaleChange: vi.fn(),
    onMarkdownExtensionsChange: vi.fn(),
    onOpenChange: vi.fn(),
    onShowHtmlCommentsChange: vi.fn(),
    onThemeModeChange: vi.fn(),
    open: true,
    settings: {
      codeWrap: "scroll",
      excludedDirectories: [],
      fontScale: 1,
      markdownExtensions: [".md"],
      maxDepth: 8,
      maxFiles: 500,
      showHtmlComments: true,
      theme: "light",
    },
  };
  const view = render(<SettingsDialog {...props} />);
  fireEvent.click(await screen.findByRole("button", {
    name: "Database statistics",
  }));
  await screen.findByRole("dialog", { name: "Database statistics" });

  view.rerender(<SettingsDialog {...props} open={false} />);
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  view.rerender(<SettingsDialog {...props} />);
  await screen.findByRole("dialog", { name: "Settings" });
  expect(screen.queryByRole("dialog", { name: "Database statistics" }))
    .toBeNull();
});
