import { describe, expect, it } from "vitest";
import { changedRevisionLines } from "../markdown/revisionDiff";

describe("changedRevisionLines", () => {
  it.each([
    ["", "", [], []],
    ["same", "same", [], []],
    ["a\r\nb", "a\nb", [], []],
    ["", "new", [], [1]],
    ["old", "", [1], []],
    ["a\nb\nc", "a\nc", [2], []],
    ["a\nc", "a\nb\nc", [], [2]],
    ["a\nx\nb\ny\nc", "a\nX\nb\nY\nc", [2, 4], [2, 4]],
    ["a\na\nb", "a\nb", [2], []],
    ["a\n\nb", "a\nb", [2], []],
    ["a\nb", "a\n\nb", [], [2]],
  ])(
    "compares %j and %j without marking unchanged lines",
    (previous, current, before, after) => {
      const changes = changedRevisionLines(
        previous as string,
        current as string,
      );
      expect([...changes.previous]).toEqual(before);
      expect([...changes.current]).toEqual(after);
    },
  );

  it("keeps unchanged context clear in large documents", () => {
    const before = Array.from({ length: 2000 }, (_, index) => `Line ${index}`);
    const after = [...before];
    after[1000] = "Changed";
    const changes = changedRevisionLines(before.join("\n"), after.join("\n"));
    expect([...changes.previous]).toEqual([1001]);
    expect([...changes.current]).toEqual([1001]);
  });
});
