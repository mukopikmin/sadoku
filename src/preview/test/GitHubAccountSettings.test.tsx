import { afterEach, expect, it, vi } from "vitest";
import { SettingsDialog } from "../components/SettingsDialog";
import { cleanup, fireEvent, render, screen, waitFor } from "./testUtils";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const settings = {
  codeWrap: "scroll" as const,
  excludedDirectories: [],
  fontScale: 1,
  markdownExtensions: [".md"],
  maxDepth: 8,
  maxFiles: 500,
  theme: "light" as const,
};

it("shows the GitHub CLI authenticated account in settings", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      json: () =>
        Promise.resolve({
          account: { login: "octocat", name: "The Octocat" },
          ok: true,
        }),
      ok: true,
    }),
  );
  const onOpenChange = vi.fn();
  render(
    <SettingsDialog
      onCodeWrapModeChange={vi.fn()}
      onDirectoryLimitsChange={vi.fn()}
      onExcludedDirectoriesChange={vi.fn()}
      onFontScaleChange={vi.fn()}
      onMarkdownExtensionsChange={vi.fn()}
      onOpenChange={onOpenChange}
      onThemeModeChange={vi.fn()}
      open
      settings={settings}
    />,
  );

  expect(await screen.findByText("The Octocat")).toBeTruthy();
  expect(screen.getByText("@octocat")).toBeTruthy();
  expect(fetch).toHaveBeenCalledWith("/__sadoku/github-account");

  fireEvent.click(screen.getByRole("button", { name: "Close settings" }));
  await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
});
