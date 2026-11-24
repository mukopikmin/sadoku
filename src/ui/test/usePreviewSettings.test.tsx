import { afterEach, expect, it, vi } from "vitest";
import * as api from "../api/settings";
import { usePreviewSettings } from "../hooks/usePreviewSettings";
import { act, cleanup, renderHook, waitFor } from "./domTestUtils";
import { deferred, queryHook } from "./hookTestUtils";
vi.mock("../api/settings", () => ({
  loadSettings: vi.fn(),
  saveSettings: vi.fn(),
}));
const defaults = {
  showHighlightBoundaries: false,
  showHtmlComments: true,
  codeWrap: "scroll" as const,
  excludedDirectories: [".git", "node_modules"],
  fontScale: 1,
  maxDepth: 2,
  maxFiles: 20,
  markdownExtensions: [".md", ".markdown"],
  theme: "light" as const,
  wideLayout: false,
};

const echoSettings = async ({
  wideLayout = false,
  ...settings
}: Parameters<typeof api.saveSettings>[0]) => ({ ...settings, wideLayout });

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  vi.unstubAllGlobals();
  document.documentElement.className = "";
  for (const attribute of [
    "style",
    "data-theme",
    "data-code-wrap",
    "data-show-highlight-boundaries",
    "data-wide-layout",
  ])
    document.documentElement.removeAttribute(attribute);
});

it("applies edits immediately and merges them with the settings loaded before saving", async () => {
  const load = deferred<Awaited<ReturnType<typeof api.loadSettings>>>();
  vi.mocked(api.loadSettings).mockReturnValue(load.promise);
  vi.mocked(api.saveSettings).mockImplementation(echoSettings);
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  const { result } = renderHook(usePreviewSettings, queryHook());
  expect(result.current.state).toMatchObject({
    status: "loading",
    settings: { theme: "dark" },
  });
  act(() => {
    result.current.changeThemeMode("light");
    result.current.changeWideLayout(true);
  });
  await waitFor(() =>
    expect(result.current.state).toMatchObject({
      status: "saving",
      settings: { theme: "light", wideLayout: true },
    }),
  );
  expect(document.documentElement.dataset.wideLayout).toBe("true");
  expect(api.saveSettings).not.toHaveBeenCalled();
  expect(api.loadSettings).toHaveBeenCalledOnce();
  await act(async () => {
    load.resolve({
      ...defaults,
      theme: "dark",
      fontScale: 0.8,
      codeWrap: "wrap",
    });
    await load.promise;
  });
  await waitFor(() => expect(result.current.state.status).toBe("ready"));
  expect(result.current.state.settings).toMatchObject({
    theme: "light",
    fontScale: 0.8,
    wideLayout: true,
    codeWrap: "wrap",
  });
  expect(document.documentElement.dataset.theme).toBe("light");
  expect(
    document.documentElement.style.getPropertyValue("--sadoku-font-scale"),
  ).toBe("0.8");
  expect(api.saveSettings).toHaveBeenLastCalledWith({
    ...defaults,
    theme: "light",
    fontScale: 0.8,
    wideLayout: true,
    codeWrap: "wrap",
  });
});

it("exposes save failures without rolling back the selected settings and retries on change", async () => {
  vi.mocked(api.loadSettings).mockResolvedValue(defaults);
  vi.mocked(api.saveSettings)
    .mockRejectedValueOnce(new Error("Offline"))
    .mockImplementation(echoSettings);
  const { result } = renderHook(usePreviewSettings, queryHook());
  await waitFor(() => expect(result.current.state.status).toBe("ready"));
  act(() => result.current.changeThemeMode("dark"));
  await waitFor(() =>
    expect(result.current.state).toMatchObject({
      status: "error",
      operation: "save",
      message: "Offline",
      settings: { theme: "dark" },
    }),
  );
  expect(document.documentElement.style.colorScheme).toBe("dark");
  act(() => {
    result.current.changeCodeWrapMode("wrap");
    result.current.changeShowHighlightBoundaries(true);
  });
  await waitFor(() => expect(result.current.state.status).toBe("ready"));
  expect(document.documentElement.dataset.codeWrap).toBe("wrap");
  expect(document.documentElement.dataset.showHighlightBoundaries).toBe("true");
});

it("retains edits after a failed load and retries against the saved settings", async () => {
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  vi.mocked(api.loadSettings)
    .mockRejectedValueOnce(new Error("Unavailable"))
    .mockRejectedValueOnce(new Error("Still unavailable"))
    .mockResolvedValue({ ...defaults, codeWrap: "wrap" });
  vi.mocked(api.saveSettings).mockImplementation(echoSettings);
  const { result } = renderHook(usePreviewSettings, queryHook());
  await waitFor(() =>
    expect(result.current.state).toMatchObject({
      status: "error",
      operation: "load",
      message: "Unavailable",
      settings: { fontScale: 1, theme: "dark" },
    }),
  );
  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(document.documentElement.classList.contains("dark")).toBe(true);
  act(() => result.current.changeWideLayout(true));
  await waitFor(() =>
    expect(result.current.state).toMatchObject({
      status: "error",
      operation: "save",
      message: "Still unavailable",
      settings: { wideLayout: true },
    }),
  );
  expect(api.saveSettings).not.toHaveBeenCalled();
  expect(document.documentElement.dataset.wideLayout).toBe("true");
  act(() => result.current.retrySettings());
  await waitFor(() => expect(result.current.state.status).toBe("ready"));
  expect(api.saveSettings).toHaveBeenCalledExactlyOnceWith({
    ...defaults,
    codeWrap: "wrap",
    wideLayout: true,
  });
});

it("serializes writes so an earlier save cannot overwrite the latest settings", async () => {
  vi.mocked(api.loadSettings).mockResolvedValue(defaults);
  const first = deferred<Awaited<ReturnType<typeof api.saveSettings>>>();
  vi.mocked(api.saveSettings)
    .mockReturnValueOnce(first.promise)
    .mockImplementation(async (settings) => ({
      ...settings,
      wideLayout: true,
    }));
  const { result } = renderHook(usePreviewSettings, queryHook());
  await waitFor(() => expect(result.current.state.status).toBe("ready"));
  act(() => result.current.changeFontScale(1.1));
  await waitFor(() => expect(api.saveSettings).toHaveBeenCalledOnce());
  act(() => result.current.changeFontScale(1.2));
  expect(api.saveSettings).toHaveBeenCalledOnce();
  await act(async () => {
    first.resolve({ ...defaults, fontScale: 1.1, wideLayout: true });
    await first.promise;
  });
  await waitFor(() => expect(api.saveSettings).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(result.current.state.status).toBe("ready"));
  expect(result.current.state.settings.fontScale).toBe(1.2);
  expect(result.current.state.settings.wideLayout).toBe(true);
  expect(api.saveSettings).toHaveBeenLastCalledWith({
    ...defaults,
    fontScale: 1.2,
    wideLayout: undefined,
  });
});
