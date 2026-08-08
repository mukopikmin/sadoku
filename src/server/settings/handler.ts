import { readConfig, updateThemeConfig } from "../../config.ts";
import {
  methodNotAllowedResponse,
  noStoreJson,
  textResponse,
} from "../responses.ts";

const invalidRequest = (message: string): Response =>
  textResponse(message, 400);

export const handleSettingsRequest = async (
  request: Request,
): Promise<Response> => {
  if (request.method === "GET") {
    const theme = readConfig()?.themeMode;
    return noStoreJson(theme === undefined ? {} : { theme });
  }
  if (request.method !== "PUT") return methodNotAllowedResponse();

  const contentType = request.headers.get("content-type")?.split(";", 1)[0]
    .trim().toLowerCase();
  if (contentType !== "application/json") {
    return invalidRequest("Content-Type must be application/json.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return invalidRequest("Request body must be valid JSON.");
  }
  if (
    typeof body !== "object" || body === null || Array.isArray(body) ||
    Object.keys(body).length !== 1 ||
    ((body as Record<string, unknown>).theme !== "dark" &&
      (body as Record<string, unknown>).theme !== "light")
  ) {
    return invalidRequest(
      'Request body must contain only theme set to "dark" or "light".',
    );
  }

  const { theme } = body as { theme: "dark" | "light" };
  await updateThemeConfig(theme);
  return noStoreJson({ theme });
};
