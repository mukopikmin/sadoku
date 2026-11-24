import { afterEach, describe, expect, it, vi } from "vitest";
import { AppearanceSettings } from "../components/settings/AppearanceSettings";
import { cleanup, fireEvent, render, screen, waitFor } from "./testUtils";

afterEach(cleanup);

describe("AppearanceSettings", () => {
  it("reports theme, font scale, and code wrapping changes", async () => {
    const onThemeModeChange = vi.fn();
    const onFontScaleChange = vi.fn();
    const onCodeWrapModeChange = vi.fn();
    const onShowHtmlCommentsChange = vi.fn();
    const onShowHighlightBoundariesChange = vi.fn();
    const onWideLayoutChange = vi.fn();
    render(
      <AppearanceSettings
        codeWrapMode="scroll"
        fontScale={1}
        onCodeWrapModeChange={onCodeWrapModeChange}
        onFontScaleChange={onFontScaleChange}
        onThemeModeChange={onThemeModeChange}
        onShowHtmlCommentsChange={onShowHtmlCommentsChange}
        onShowHighlightBoundariesChange={onShowHighlightBoundariesChange}
        onWideLayoutChange={onWideLayoutChange}
        showHighlightBoundaries={false}
        showHtmlComments
        themeMode="light"
        wideLayout={false}
      />,
    );

    fireEvent.click(screen.getByRole("combobox", { name: "Theme" }));
    fireEvent.click(await screen.findByRole("option", { name: "Dark" }));
    fireEvent.click(screen.getByRole("button", { name: "Increase text size" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Wrap code blocks" }));

    const wideLayout = screen.getByRole<HTMLInputElement>("checkbox", {
      name: "Wide layout",
      description: "Use the maximum table width throughout the preview",
    });
    expect(wideLayout.checked).toBe(false);
    fireEvent.click(screen.getByText("Wide layout"));
    await waitFor(() => expect(onWideLayoutChange).toHaveBeenCalledWith(true));

    const htmlComments = screen.getByRole<HTMLInputElement>("checkbox", {
      name: "Show HTML comments",
    });
    expect(htmlComments.checked).toBe(true);
    fireEvent.click(htmlComments);
    const boundaries = screen.getByRole<HTMLInputElement>("checkbox", {
      name: "Show highlight boundaries",
    });
    expect(boundaries.checked).toBe(false);
    fireEvent.click(boundaries);
    await waitFor(() =>
      expect(onShowHighlightBoundariesChange).toHaveBeenCalledWith(true),
    );
    await waitFor(() =>
      expect(onShowHtmlCommentsChange).toHaveBeenCalledWith(false),
    );

    expect(onThemeModeChange).toHaveBeenCalledWith("dark");
    expect(onFontScaleChange).toHaveBeenCalledWith(1.1);
    await waitFor(() =>
      expect(onCodeWrapModeChange).toHaveBeenCalledWith("wrap"),
    );
  });
});
