import { createConnectTransport } from "@connectrpc/connect-web";
import { Code, ConnectError, createClient } from "@connectrpc/connect";
import { PreviewService } from "../../../gen/ts/sadoku/preview/v1/preview_pb";

export const previewTransport = createConnectTransport({
  baseUrl: globalThis.location?.origin ?? "http://127.0.0.1",
  fetch: (input, init) => {
    const testFetch = (globalThis as typeof globalThis & {
      __sadokuConnectTestFetch?: typeof fetch;
    }).__sadokuConnectTestFetch;
    return (testFetch ?? globalThis.fetch)(input, init);
  },
  useBinaryFormat: false,
  useHttpGet: false,
});

export const previewClient = createClient(PreviewService, previewTransport);

export const connectHttpStatus = (error: unknown): number => {
  switch (ConnectError.from(error).code) {
    case Code.InvalidArgument:
      return 400;
    case Code.NotFound:
      return 404;
    case Code.AlreadyExists:
      return 409;
    case Code.Unimplemented:
      return 501;
    case Code.Unavailable:
      return 503;
    default:
      return 500;
  }
};

export const connectRawMessage = (error: unknown): string =>
  ConnectError.from(error).rawMessage;
