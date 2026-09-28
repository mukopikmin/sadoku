import { createConnectTransport } from "@connectrpc/connect-web";

export const previewTransport = createConnectTransport({
  baseUrl: globalThis.location?.origin ?? "http://127.0.0.1",
  fetch: (input, init) => globalThis.fetch(input, init),
  useBinaryFormat: false,
  useHttpGet: false,
});
