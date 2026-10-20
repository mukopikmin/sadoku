import { Code, ConnectError } from "@connectrpc/connect";
import { describe, expect, it } from "vitest";
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
