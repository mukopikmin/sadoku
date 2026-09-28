import {
  create,
  type DescMessage,
  type DescMethodUnary,
  fromJsonString,
  type MessageInitShape,
  type MessageShape,
  toJsonString,
} from "@bufbuild/protobuf";
import { noStoreCacheControl } from "../responses.ts";

export type ConnectCode =
  | "invalid_argument"
  | "internal"
  | "unimplemented";

export type ConnectFailure = {
  code: ConnectCode;
  message: string;
  status: number;
};

type UnaryHandler<I extends DescMessage, O extends DescMessage> = (
  input: MessageShape<I>,
) => MessageInitShape<O> | Promise<MessageInitShape<O>>;

export const connectFailure = (
  code: ConnectCode,
  message: string,
  status: number,
): ConnectFailure => ({ code, message, status });

const isConnectFailure = (value: unknown): value is ConnectFailure =>
  typeof value === "object" &&
  value !== null &&
  "code" in value &&
  "message" in value &&
  "status" in value &&
  (value.code === "invalid_argument" ||
    value.code === "internal" ||
    value.code === "unimplemented") &&
  typeof value.message === "string" &&
  typeof value.status === "number";

export const connectErrorResponse = (failure: ConnectFailure): Response =>
  Response.json(
    { code: failure.code, message: failure.message },
    {
      status: failure.status,
      headers: {
        "cache-control": noStoreCacheControl,
        "content-type": "application/json",
      },
    },
  );

export const connectMethodPath = (
  method: DescMethodUnary,
): string => `/${method.parent.typeName}/${method.name}`;

export const connectMethodNotAllowedResponse = (): Response =>
  connectErrorResponse(
    connectFailure("unimplemented", "HTTP method is not supported.", 405),
  );

export const handleConnectUnary = async <
  I extends DescMessage,
  O extends DescMessage,
>(
  request: Request,
  method: DescMethodUnary<I, O>,
  handler: UnaryHandler<I, O>,
): Promise<Response> => {
  if (request.method !== "POST") return connectMethodNotAllowedResponse();

  const contentType = request.headers.get("content-type")?.split(";", 1)[0]
    .trim().toLowerCase();
  if (contentType !== "application/json") {
    return connectErrorResponse(
      connectFailure(
        "invalid_argument",
        "Content-Type must be application/json.",
        415,
      ),
    );
  }
  if (request.headers.get("connect-protocol-version") !== "1") {
    return connectErrorResponse(
      connectFailure(
        "invalid_argument",
        "Connect-Protocol-Version must be 1.",
        400,
      ),
    );
  }
  const contentEncoding = request.headers.get("content-encoding");
  if (contentEncoding && contentEncoding.toLowerCase() !== "identity") {
    return connectErrorResponse(
      connectFailure(
        "unimplemented",
        "Compressed requests are not supported.",
        415,
      ),
    );
  }

  let input: MessageShape<I>;
  try {
    input = fromJsonString(method.input, await request.text());
  } catch {
    return connectErrorResponse(
      connectFailure("invalid_argument", "Invalid request message.", 400),
    );
  }

  try {
    const output = create(method.output, await handler(input));
    return new Response(toJsonString(method.output, output), {
      status: 200,
      headers: {
        "cache-control": noStoreCacheControl,
        "content-type": "application/json",
      },
    });
  } catch (error) {
    if (isConnectFailure(error)) return connectErrorResponse(error);
    return connectErrorResponse(
      connectFailure("internal", "Internal server error.", 500),
    );
  }
};
