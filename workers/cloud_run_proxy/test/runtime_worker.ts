// Only loaded by local runtime tests; this entry point is never deployed.
import { createProxy } from "../src/index.ts";

const proxy = createProxy(async (request, init) => {
  const path = new URL(request.url).pathname;
  if (path === "/ws") {
    const [client, server] = Object.values(new WebSocketPair());
    server.accept();
    server.addEventListener("message", (event) => server.send(event.data));
    return new Response(null, {
      status: 101,
      webSocket: client,
      headers: { "Set-Cookie": "ws=1; Domain=run.app; Secure; Path=/" },
    });
  }
  if (path === "/events") {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("data: first\n\n"));
        // A second event must be available before EOF, even with a slow origin.
        setTimeout(() => {
          controller.enqueue(new TextEncoder().encode("data: second\n\n"));
          controller.close();
        }, 100);
      },
    });
    return new Response(stream, {
      headers: { "Content-Type": "text/event-stream" },
    });
  }
  if (path === "/cookies") {
    const headers = new Headers();
    headers.append(
      "Set-Cookie",
      "a=1; Domain=run.app; Expires=Wed, 21 Oct 2030 07:28:00 GMT",
    );
    headers.append("Set-Cookie", "b=2; Domain=example.com; Secure; Path=/");
    return new Response(null, { headers });
  }
  return Response.json({
    url: request.url,
    method: request.method,
    cache: Reflect.get(init ?? {}, "cache"),
    headers: Object.fromEntries(request.headers),
    body: await request.text(),
  });
});

export default proxy;
