import { basename, resolve, toFileUrl } from "@std/path";

export type PreviewSource = {
  commentSource: string;
  documentSource: string;
  isRemote: boolean;
  githubPull?: GitHubPullSource;
};

export type GitHubPullSource = {
  owner: string;
  pullNumber: number;
  repo: string;
  url: string;
};

export const parseGitHubPullUrl = (
  value: string,
): GitHubPullSource | undefined => {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" || url.hostname.toLowerCase() !== "github.com"
    ) {
      return undefined;
    }
    const match = url.pathname.match(/^\/([^/]+)\/([^/]+)\/pull\/(\d+)\/?$/);
    if (!match) return undefined;
    const pullNumber = Number(match[3]);
    if (!Number.isSafeInteger(pullNumber) || pullNumber < 1) return undefined;
    return {
      owner: decodeURIComponent(match[1]),
      repo: decodeURIComponent(match[2]),
      pullNumber,
      url: `https://github.com/${match[1]}/${match[2]}/pull/${pullNumber}`,
    };
  } catch {
    return undefined;
  }
};

export const isHttpUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

export const createPreviewSource = (input: string): PreviewSource => {
  if (!isHttpUrl(input)) {
    const filePath = resolve(input);
    return {
      commentSource: filePath,
      documentSource: filePath,
      isRemote: false,
    };
  }

  const githubPull = parseGitHubPullUrl(input);
  if (githubPull) {
    return {
      commentSource: githubPull.url,
      documentSource: githubPull.url,
      githubPull,
      isRemote: true,
    };
  }

  const documentUrl = new URL(input);
  const commentUrl = new URL(documentUrl.href);
  commentUrl.search = "";
  commentUrl.hash = "";
  return {
    commentSource: commentUrl.href,
    documentSource: documentUrl.href,
    isRemote: true,
  };
};

export const readMarkdownSource = async (source: string): Promise<string> => {
  if (!isHttpUrl(source)) return await Deno.readTextFile(source);

  const response = await fetch(new URL(source));
  if (!response.ok) {
    throw new Error(
      `Failed to fetch Markdown URL: ${response.status} ${response.statusText}`
        .trimEnd(),
    );
  }
  return await response.text();
};

export const sourceTitle = (source: string): string => {
  if (!isHttpUrl(source)) return basename(source);

  const url = new URL(source);
  const pathnameTitle = basename(decodeURIComponent(url.pathname));
  return pathnameTitle || url.hostname;
};

export const sourceUrl = (source: string): string =>
  isHttpUrl(source) ? new URL(source).href : toFileUrl(source).href;
