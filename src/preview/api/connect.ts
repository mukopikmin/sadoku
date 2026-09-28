import { createConnectTransport } from "@connectrpc/connect-web";
import { createClient } from "@connectrpc/connect";
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
