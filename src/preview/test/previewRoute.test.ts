import { describe, expect, it } from "vitest";
import { parseDocumentId } from "../hooks/usePreviewRoute";

describe("parseDocumentId", () => {
  it("accepts positive safe integer route parameters", () => {
    expect(parseDocumentId("1")).toBe(1);
    expect(parseDocumentId("9007199254740991")).toBe(Number.MAX_SAFE_INTEGER);
  });

  it("rejects malformed and unsafe route parameters", () => {
    expect(parseDocumentId(undefined)).toBeUndefined();
    expect(parseDocumentId("0")).toBeUndefined();
    expect(parseDocumentId("01")).toBeUndefined();
    expect(parseDocumentId("9007199254740992")).toBeUndefined();
  });
});
