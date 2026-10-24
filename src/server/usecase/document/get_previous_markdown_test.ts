import { assertEquals } from "@std/assert";
import type { PreviewCommentsDocument } from "../comment/types.ts";
import { getPreviousMarkdown } from "./get_previous_markdown.ts";

Deno.test("previous Markdown uses the last snapshot before rebasing and the retained snapshot afterward", async () => {
  for (
    const snapshots of [
      { sourceSnapshot: "old", previousSourceSnapshot: "older" },
      { sourceSnapshot: "current", previousSourceSnapshot: "old" },
    ]
  ) {
    const stored: PreviewCommentsDocument = {
      filePath: "document.md",
      comments: [],
      ...snapshots,
    };
    const read = (source: string) => {
      assertEquals(source, "document.md");
      return Promise.resolve(stored);
    };
    assertEquals(
      await getPreviousMarkdown({ read }, "document.md", "current"),
      "old",
    );
    assertEquals(stored, {
      filePath: "document.md",
      comments: [],
      ...snapshots,
    });
  }
});

Deno.test("previous Markdown distinguishes an empty revision from missing or identical snapshots", async () => {
  for (
    const [snapshots, expected] of [
      [{}, undefined],
      [{ sourceSnapshot: "current" }, undefined],
      [
        { sourceSnapshot: "current", previousSourceSnapshot: "current" },
        undefined,
      ],
      [{ sourceSnapshot: "" }, ""],
      [{ sourceSnapshot: "current", previousSourceSnapshot: "" }, ""],
    ] as const
  ) {
    assertEquals(
      await getPreviousMarkdown(
        {
          read: () =>
            Promise.resolve({
              filePath: "document.md",
              comments: [],
              ...snapshots,
            }),
        },
        "document.md",
        "current",
      ),
      expected,
    );
  }
});
