import type { PreviewSession, PullRequestMetadata } from "../models/session";

export type SessionResponse = {
  pullRequest?: unknown;
};

const parsePullRequest = (value: unknown): PullRequestMetadata => {
  if (typeof value !== "object" || value === null) {
    throw new Error("Invalid session response.");
  }
  const metadata = value as Record<string, unknown>;
  if (
    typeof metadata.title !== "string" ||
    typeof metadata.description !== "string" ||
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
    title: metadata.title,
    url: metadata.url,
  };
};

export const loadSession = async (): Promise<PreviewSession> => {
  const response = await fetch("/__sadoku/session");
  if (!response.ok) {
    throw new Error(`Failed to load session: ${response.status}`);
  }
  const value: unknown = await response.json();
  if (typeof value !== "object" || value === null) {
    throw new Error("Invalid session response.");
  }
  const session = value as SessionResponse;
  return session.pullRequest === undefined
    ? {}
    : { pullRequest: parsePullRequest(session.pullRequest) };
};
