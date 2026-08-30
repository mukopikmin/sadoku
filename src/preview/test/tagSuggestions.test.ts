import { describe, expect, it } from "vitest";
import { findSimilarTags } from "../models/tagSuggestions";

describe("findSimilarTags", () => {
  it("ranks case, prefix, substring, and distance candidates deterministically", () => {
    const tags = ["api", "API client", "my API notes", "APX", "unrelated"].map((
      name,
      index,
    ) => ({ id: index + 1, name }));
    expect(
      findSimilarTags("API", tags).map(({ name, reason }) => [name, reason]),
    ).toEqual([
      ["api", "case"],
      ["API client", "prefix"],
      ["my API notes", "substring"],
    ]);
    expect(
      findSimilarTags("日本語", [{ id: 1, name: "日本語タグ" }])[0]?.reason,
    ).toBe("prefix");
    expect(findSimilarTags("draft", [{ id: 1, name: "daft" }])[0]?.reason).toBe(
      "distance",
    );
  });
  it("excludes exact identity and limits candidates", () => {
    const tags = Array.from(
      { length: 8 },
      (_, id) => ({ id, name: `tag${id}` }),
    );
    expect(findSimilarTags("tag", tags)).toHaveLength(5);
    expect(findSimilarTags("tag0", tags).some(({ name }) => name === "tag0"))
      .toBe(false);
  });
});
