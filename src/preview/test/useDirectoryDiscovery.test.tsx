import { afterEach, expect, it, vi } from "vitest";
import { useDirectoryDiscovery } from "../hooks/useDirectoryDiscovery";
import { act, cleanup, renderHook } from "./domTestUtils";
afterEach(cleanup);
it("validates limits and preserves the other limit when accepting a change", () => {
  const change = vi.fn();
  const { result } = renderHook(() =>
    useDirectoryDiscovery({
      maxDepth: 2,
      maxFiles: 20,
      excludedDirectories: [],
      markdownExtensions: [".md"],
      onDirectoryLimitsChange: change,
      onExcludedDirectoriesChange: vi.fn(),
      onMarkdownExtensionsChange: vi.fn(),
    }),
  );
  act(() => {
    result.current.changeDepth("-1");
    result.current.changeFiles("0");
    result.current.changeFiles("1.5");
  });
  expect(change).not.toHaveBeenCalled();
  act(() => {
    result.current.changeDepth("0");
    result.current.changeFiles("30");
  });
  expect(change.mock.calls).toEqual([
    [0, 20],
    [2, 30],
  ]);
});
it("keeps at least one extension and clears field errors when correcting input", () => {
  const change = vi.fn();
  const { result } = renderHook(() =>
    useDirectoryDiscovery({
      maxDepth: 2,
      maxFiles: 20,
      excludedDirectories: [],
      markdownExtensions: [".md"],
      onDirectoryLimitsChange: vi.fn(),
      onExcludedDirectoriesChange: vi.fn(),
      onMarkdownExtensionsChange: change,
    }),
  );
  act(() => result.current.changeExtensions([]));
  expect(result.current.extensions).toEqual({
    status: "invalid",
    message: "Add at least one extension.",
  });
  expect(change).not.toHaveBeenCalled();
  act(() => result.current.changeExtensions([".mdx"]));
  expect(result.current.extensions.status).toBe("valid");
  expect(change).toHaveBeenCalledWith([".mdx"]);
  expect(result.current.validateDirectory("a/b")).toBe(false);
  expect(result.current.validateExtension("md")).toBe(false);
  act(() => result.current.invalidDirectory());
  expect(result.current.directories.status).toBe("invalid");
  act(() => result.current.clearDirectoryError());
  expect(result.current.directories.status).toBe("valid");
});
