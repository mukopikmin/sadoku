import { describe, expect, it } from "vitest";
import {
  getAdjacentFontScales,
  isValidExcludedDirectory,
  isValidMarkdownExtension,
} from "../components/settings/settingsValidation";

describe("settings validation", () => {
  it("moves font scale between supported steps and clamps at the ends", () => {
    expect(getAdjacentFontScales(1)).toEqual({ decrease: 0.9, increase: 1.1 });
    expect(getAdjacentFontScales(0.5)).toEqual({
      decrease: 0.75,
      increase: 0.8,
    });
    expect(getAdjacentFontScales(2)).toEqual({ decrease: 1.4, increase: 1.5 });
  });

  it("accepts directory names but rejects paths and traversal segments", () => {
    expect(isValidExcludedDirectory("node_modules")).toBe(true);
    expect(isValidExcludedDirectory(".")).toBe(false);
    expect(isValidExcludedDirectory("nested/path")).toBe(false);
    expect(isValidExcludedDirectory("nested\\path")).toBe(false);
  });

  it("requires a single leading dot for Markdown extensions", () => {
    expect(isValidMarkdownExtension(".mdx")).toBe(true);
    expect(isValidMarkdownExtension("md")).toBe(false);
    expect(isValidMarkdownExtension(".tar.md")).toBe(false);
    expect(isValidMarkdownExtension(".dir/md")).toBe(false);
  });
});
