import { cleanup, fireEvent, render, screen, waitFor } from "./testUtils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DocumentActionBar } from "../components/DocumentActionBar";

afterEach(cleanup);

describe("DocumentActionBar", () => {
  it("shows the document tags on hover and opens the editor on click", async () => {
    const onOpenTags = vi.fn();
    render(
      <DocumentActionBar
        onOpenInstructions={() => {}}
        onOpenTags={onOpenTags}
        onToggleHtmlComments={() => {}}
        showHtmlComments
        tags={[
          { backgroundColor: "#3182ce", id: 1, name: "reviewed" },
          { backgroundColor: "#38a169", id: 2, name: "documentation" },
        ]}
      />,
    );

    const tagsButton = screen.getByRole("button", { name: "Tags" });
    expect(tagsButton.querySelector("svg")).not.toBeNull();

    fireEvent.pointerEnter(tagsButton);
    await waitFor(() => {
      expect(screen.getByText("reviewed")).not.toBeNull();
      expect(screen.getByText("documentation")).not.toBeNull();
    });

    fireEvent.click(tagsButton);
    expect(onOpenTags).toHaveBeenCalledOnce();
  });

  it("describes a document without tags on hover", async () => {
    render(
      <DocumentActionBar
        onOpenInstructions={() => {}}
        onOpenTags={() => {}}
        onToggleHtmlComments={() => {}}
        showHtmlComments
        tags={[]}
      />,
    );

    fireEvent.pointerEnter(screen.getByRole("button", { name: "Tags" }));

    await waitFor(() => {
      expect(screen.getByText("No tags added.")).not.toBeNull();
    });
  });
});
