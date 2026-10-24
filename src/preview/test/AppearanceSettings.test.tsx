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
    render(
      <AppearanceSettings
        codeWrapMode="scroll"
        fontScale={1}
        onCodeWrapModeChange={onCodeWrapModeChange}
        onFontScaleChange={onFontScaleChange}
        onThemeModeChange={onThemeModeChange}
        onShowHtmlCommentsChange={onShowHtmlCommentsChange}
        showHtmlComments
        themeMode="light"
      />,
    );

    fireEvent.change(screen.getByLabelText("Theme"), {
      target: { value: "dark" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Increase text size" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Wrap code blocks" }));

    const htmlComments = screen.getByRole<HTMLInputElement>("checkbox", {
      name: "Show HTML comments",
    });
    expect(htmlComments.checked).toBe(true);
    fireEvent.click(htmlComments);
    await waitFor(() =>
      expect(onShowHtmlCommentsChange).toHaveBeenCalledWith(false)
    );

    expect(onThemeModeChange).toHaveBeenCalledWith("dark");
    expect(onFontScaleChange).toHaveBeenCalledWith(1.1);
    await waitFor(() =>
      expect(onCodeWrapModeChange).toHaveBeenCalledWith("wrap")
    );
  });
});
