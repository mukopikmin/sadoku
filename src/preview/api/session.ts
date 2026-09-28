import type { PreviewSession, PullRequestMetadata } from "../models/session";
import type { GetSessionResponse } from "../../../gen/ts/sadoku/preview/v1/preview_pb";

const parsePullRequest = (value: unknown): PullRequestMetadata => {
  if (typeof value !== "object" || value === null) {
    throw new Error("Invalid session response.");
  }
  const metadata = value as Record<string, unknown>;
  if (
    typeof metadata.title !== "string" ||
    typeof metadata.description !== "string" ||
    !Number.isSafeInteger(metadata.number) ||
    (metadata.number as number) <= 0 ||
    typeof metadata.url !== "string"
  ) {
    throw new Error("Invalid session response.");
  }
  try {
    const url = new URL(metadata.url);
    if (url.protocol !== "https:" || url.hostname !== "github.com") {
      throw new Error();
    }
  } catch {
    throw new Error("Invalid session response.");
  }
  return {
    description: metadata.description,
    number: metadata.number as number,
    title: metadata.title,
    url: metadata.url,
  };
};

export const toPreviewSession = (
  session: GetSessionResponse,
): PreviewSession =>
  session.pullRequest === undefined
    ? {}
    : { pullRequest: parsePullRequest(session.pullRequest) };
