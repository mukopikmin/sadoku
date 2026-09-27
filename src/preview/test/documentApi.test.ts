import { afterEach, describe, expect, it, vi } from "vitest";
import { create } from "@bufbuild/protobuf";
import { loadDocuments, loadPreviewDocument } from "../api/document";
import { toPreviewSession } from "../api/session";
import { toDatabaseStatistics } from "../api/statistics";
import {
  GetSessionResponseSchema,
  GetStatisticsResponseSchema,
} from "../../../gen/ts/sadoku/preview/v1/preview_pb";

afterEach(() => vi.unstubAllGlobals());

describe("document API tag conversion", () => {
  it("preserves validated tag background colors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) =>
        Response.json(
          String(input).endsWith("/1")
            ? {
              markdown: "# Doc",
              tags: [{ id: 2, name: "API", backgroundColor: "#A1B2C3" }],
            }
            : [{
              id: 1,
              title: "Doc",
              tags: [{ id: 2, name: "API", backgroundColor: "#A1B2C3" }],
            }],
        )
      ),
    );
    expect((await loadDocuments())[0].tags[0].backgroundColor).toBe("#a1b2c3");
    expect((await loadPreviewDocument(1)).tags[0].backgroundColor).toBe(
      "#a1b2c3",
    );
  });

  it("rejects unsafe tag background colors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json([
          {
            id: 1,
            title: "Doc",
            tags: [{ id: 2, name: "API", backgroundColor: "url(evil)" }],
          },
        ])
      ),
    );
    await expect(loadDocuments()).rejects.toThrow("Invalid tag response.");
  });

  it("keeps responses without tags backward compatible", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json([{ id: 1, title: "Doc" }])),
    );
    expect((await loadDocuments())[0].tags).toEqual([]);
  });
});

describe("session API conversion", () => {
  it("converts pull request metadata and supports sessions without it", () => {
    expect(
      toPreviewSession(create(GetSessionResponseSchema, {
        pullRequest: {
          description: "First line\nSecond line",
          number: 23,
          title: "Improve docs",
          url: "https://github.com/octo/repo/pull/23",
        },
      })),
    ).toEqual({
      pullRequest: {
        description: "First line\nSecond line",
        number: 23,
        title: "Improve docs",
        url: "https://github.com/octo/repo/pull/23",
      },
    });
    expect(toPreviewSession(create(GetSessionResponseSchema))).toEqual({});
  });

  it.each([
    {
      description: "Body",
      number: 0,
      title: "Title",
      url: "https://github.com/o/r/pull/1",
    },
    {
      description: "Body",
      number: 1,
      title: "Title",
      url: "javascript:alert(1)",
    },
  ])("rejects invalid pull request metadata: %j", (pullRequest) => {
    expect(() =>
      toPreviewSession(create(GetSessionResponseSchema, { pullRequest }))
    ).toThrow("Invalid session response.");
  });
});

describe("statistics API conversion", () => {
  it("converts uint64 fields to the existing number model", () => {
    expect(toDatabaseStatistics(create(GetStatisticsResponseSchema, {
      commentCount: { bot: 4n, human: 12n },
      databaseSize: 1536n,
      documentCount: 3n,
    }))).toEqual({
      commentCount: { bot: 4, human: 12 },
      databaseSize: 1536,
      documentCount: 3,
    });
  });

  it("rejects missing counts and integers outside the safe range", () => {
    expect(() => toDatabaseStatistics(create(GetStatisticsResponseSchema)))
      .toThrow("Invalid statistics response.");
    expect(() =>
      toDatabaseStatistics(create(GetStatisticsResponseSchema, {
        commentCount: { bot: 0n, human: 0n },
        databaseSize: BigInt(Number.MAX_SAFE_INTEGER) + 1n,
      }))
    ).toThrow("Invalid statistics response.");
  });
});
