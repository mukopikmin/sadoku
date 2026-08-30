export const plainTextContentType = "text/plain; charset=utf-8";
export const noStoreCacheControl = "no-store";

export const textResponse = (body: string, status = 200): Response =>
  new Response(body, {
    status,
    headers: { "content-type": plainTextContentType },
  });

export const notFoundResponse = (body = "Not found."): Response =>
  textResponse(body, 404);

export const methodNotAllowedResponse = (): Response =>
  textResponse("Method not allowed.", 405);

export const noStoreJson = (value: unknown, status = 200): Response =>
  Response.json(value, {
    status,
    headers: { "cache-control": noStoreCacheControl },
  });
