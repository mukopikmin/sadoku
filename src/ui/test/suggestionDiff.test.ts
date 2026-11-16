import { describe, expect, it } from "vitest";
import { suggestionDiff } from "../markdown/suggestionDiff";

describe("suggestionDiff", () => {
  it.each([
    ["old", "new", "-old\n+new"],
    ["same", "same", " same"],
    ["", "new", "+new"],
    ["old", "", "-old"],
    ["", "", ""],
    ["a\nb\nc", "a\nc", " a\n-b\n c"],
    ["a\nc", "a\nb\nc", " a\n+b\n c"],
    ["a\nx\nb\ny\nc", "a\nX\nb\nY\nc", " a\n-x\n+X\n b\n-y\n+Y\n c"],
    ["a\r\nb", "a\nc", " a\n-b\n+c"],
    ["a\n\nb", "a\nb", " a\n-\n b"],
    ["a\na\nb", "a\nb", " a\n-a\n b"],
  ])("compares %j with %j", (source, replacement, expected) => {
    expect(suggestionDiff(source, replacement)).toBe(expected);
  });

  it("renders large selections as a full replacement", () => {
    const source = Array.from({ length: 1_000 }, (_, i) => `old ${i}`);
    const replacement = Array.from({ length: 1_000 }, (_, i) => `new ${i}`);
    expect(suggestionDiff(source.join("\n"), replacement.join("\n"))).toBe(
      [
        ...source.map((line) => `-${line}`),
        ...replacement.map((line) => `+${line}`),
      ].join("\n"),
    );
  });

  it.each(["replace", "insert", "delete"])(
    "preserves unchanged lines between distant edits in large selections (%s)",
    (operation) => {
      const before = Array.from({ length: 2_000 }, (_, i) => `line ${i}`);
      const after = [...before];
      const deleteCount = operation === "insert" ? 0 : 1;
      const replacement = operation === "delete" ? [] : ["changed"];
      after.splice(1_900, deleteCount, ...replacement);
      after.splice(100, deleteCount, ...replacement);
      const diff = suggestionDiff(before.join("\n"), after.join("\n")).split(
        "\n",
      );
      expect(diff.filter((line) => line.startsWith("-"))).toHaveLength(
        operation === "insert" ? 0 : 2,
      );
      expect(diff.filter((line) => line.startsWith("+"))).toHaveLength(
        operation === "delete" ? 0 : 2,
      );
      expect(
        diff
          .filter((line) => !line.startsWith("+"))
          .map((line) => line.slice(1)),
      ).toEqual(before);
      expect(
        diff
          .filter((line) => !line.startsWith("-"))
          .map((line) => line.slice(1)),
      ).toEqual(after);
    },
  );
});
