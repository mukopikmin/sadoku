import { assertEquals, assertThrows } from "@std/assert";
import {
  BASELINE_TAG,
  parseArguments,
  selectPreviousStableTag,
} from "./release.ts";

Deno.test("parses release check arguments", () => {
  assertEquals(parseArguments(["check", "--version", "0.1.0"]), {
    command: "check",
    version: "0.1.0",
    output: undefined,
  });
});

Deno.test("requires notes output path", () => {
  assertThrows(
    () => parseArguments(["notes", "--version", "0.1.0"]),
    Error,
    "requires --output",
  );
});

Deno.test("rejects invalid release versions", () => {
  assertThrows(
    () => parseArguments(["check", "--version", "v0.1.0"]),
    Error,
    "Invalid semantic version",
  );
});

Deno.test("selects the newest non-draft stable release", () => {
  assertEquals(
    selectPreviousStableTag([
      { tagName: "v0.0.0-nightly", isDraft: false, isPrerelease: true },
      { tagName: "v0.2.0", isDraft: false, isPrerelease: false },
      { tagName: "v0.3.0", isDraft: true, isPrerelease: false },
      { tagName: "v0.1.0", isDraft: false, isPrerelease: false },
    ]),
    "v0.2.0",
  );
});

Deno.test("falls back to the release notes baseline", () => {
  assertEquals(
    selectPreviousStableTag([
      { tagName: "v0.0.0-nightly", isDraft: false, isPrerelease: true },
    ]),
    BASELINE_TAG,
  );
});
