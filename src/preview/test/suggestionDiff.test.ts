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
      ]
        .join("\n"),
    );
  });
});
