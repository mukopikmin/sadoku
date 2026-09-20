import { afterEach, describe, expect, it, vi } from "vitest";
import { DirectoryDiscoverySettings } from "../components/settings/DirectoryDiscoverySettings";
import { cleanup, fireEvent, render, screen } from "./testUtils";

afterEach(cleanup);

describe("DirectoryDiscoverySettings", () => {
  it("reports valid directory limit changes and ignores invalid values", () => {
    const onDirectoryLimitsChange = vi.fn();
    render(
      <DirectoryDiscoverySettings
        excludedDirectories={["node_modules"]}
        markdownExtensions={[".md"]}
        maxDepth={4}
        maxFiles={100}
        onDirectoryLimitsChange={onDirectoryLimitsChange}
        onExcludedDirectoriesChange={() => {}}
        onMarkdownExtensionsChange={() => {}}
      />,
    );

    fireEvent.change(screen.getByLabelText("Maximum depth"), {
      target: { value: "6" },
    });
    fireEvent.change(screen.getByLabelText("Maximum files"), {
      target: { value: "0" },
    });

    expect(onDirectoryLimitsChange).toHaveBeenCalledOnce();
    expect(onDirectoryLimitsChange).toHaveBeenCalledWith(6, 100);
  });
});
