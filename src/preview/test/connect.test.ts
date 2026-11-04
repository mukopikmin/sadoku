import { Code, ConnectError } from "@connectrpc/connect";
import { describe, expect, it, vi } from "vitest";
import { connectionSnapshot, reportConnection } from "../api/connection";
import { createClient } from "@connectrpc/connect";
import { PreviewService } from "../../gen/ts/sadoku/preview/v1/preview_pb";
import { createPreviewTransport } from "../api/connect";
import { connectHttpStatus } from "../api/connect";

describe("Connect error conversion", () => {
  it.each([
    [Code.InvalidArgument, 400],
    [Code.NotFound, 404],
    [Code.AlreadyExists, 409],
    [Code.Unimplemented, 501],
    [Code.Unavailable, 503],
    [Code.Internal, 500],
  ])("maps Connect code %s to HTTP status %s", (code, status) => {
    expect(connectHttpStatus(new ConnectError("Failed.", code))).toBe(status);
  });
});

it("reports connection failures and restores on a reachable HTTP response", async () => {
  const fetchMock = vi
    .fn()
    .mockRejectedValueOnce(new TypeError("Failed to fetch"))
    .mockResolvedValue(new Response("missing", { status: 404 }));
  vi.stubGlobal("fetch", fetchMock);
  reportConnection(false);
  try {
    const client = createClient(PreviewService, createPreviewTransport());
    await expect(client.getSession({})).rejects.toThrow();
    expect(connectionSnapshot()).toBe(true);
    await expect(client.getSession({})).rejects.toThrow();
    expect(connectionSnapshot()).toBe(false);
  } finally {
    vi.unstubAllGlobals();
    reportConnection(false);
  }
});
