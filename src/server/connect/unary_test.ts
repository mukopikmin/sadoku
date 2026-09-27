import { assertEquals } from "@std/assert";
import { PreviewService } from "../../../gen/ts/sadoku/preview/v1/preview_pb.ts";
import {
  connectFailure,
  connectMethodPath,
  handleConnectUnary,
} from "./unary.ts";

const method = PreviewService.method.getSession;
const request = (
  body = "{}",
  headers: HeadersInit = {},
  methodName = "POST",
) =>
  new Request(`http://127.0.0.1${connectMethodPath(method)}`, {
    body: methodName === "POST" ? body : undefined,
    headers: {
      "connect-protocol-version": "1",
      "content-type": "application/json",
      ...headers,
    },
    method: methodName,
  });

Deno.test("Connect unary adapter serializes protobuf JSON", async () => {
  const response = await handleConnectUnary(request(), method, () => ({
    pullRequest: {
      description: "Description",
      number: 23,
      title: "Title",
      url: "https://github.com/example/repo/pull/23",
    },
  }));

  assertEquals(response.status, 200);
  assertEquals(response.headers.get("content-type"), "application/json");
  assertEquals(response.headers.get("cache-control"), "no-store");
  assertEquals(await response.json(), {
    pullRequest: {
      description: "Description",
      number: 23,
      title: "Title",
      url: "https://github.com/example/repo/pull/23",
    },
  });
});

Deno.test("Connect unary adapter validates request metadata and JSON", async () => {
  for (
    const [input, status, code] of [
      [
        request("{}", { "content-type": "text/plain" }),
        415,
        "invalid_argument",
      ],
      [
        request("{}", { "connect-protocol-version": "2" }),
        400,
        "invalid_argument",
      ],
      [
        request("{}", { "connect-protocol-version": "" }),
        400,
        "invalid_argument",
      ],
      [request("{}", { "content-encoding": "gzip" }), 415, "unimplemented"],
      [request("{"), 400, "invalid_argument"],
      [request("{}", {}, "GET"), 405, "unimplemented"],
    ] as const
  ) {
    const response = await handleConnectUnary(input, method, () => ({}));
    assertEquals(response.status, status);
    assertEquals((await response.json()).code, code);
    assertEquals(response.headers.get("cache-control"), "no-store");
  }
});

Deno.test("Connect unary adapter maps declared and unexpected failures", async () => {
  const unavailable = await handleConnectUnary(request(), method, () => {
    throw connectFailure("unimplemented", "Unavailable.", 501);
  });
  assertEquals(unavailable.status, 501);
  assertEquals(await unavailable.json(), {
    code: "unimplemented",
    message: "Unavailable.",
  });

  const internal = await handleConnectUnary(request(), method, () => {
    throw new Error("private details");
  });
  assertEquals(internal.status, 500);
  assertEquals(await internal.json(), {
    code: "internal",
    message: "Internal server error.",
  });
});
