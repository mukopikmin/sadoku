import { extname } from "@std/path";
import type { GitHubPullSource } from "./source.ts";
import { defaultMarkdownExtensions } from "./storage/document/list_markdown_files.ts";

export type GitHubPullDocument = {
  commentSource: string;
  filePath: string;
  relativePath: string;
};

export type GitHubPullSnapshot = {
  headSha: string;
  documents: GitHubPullDocument[];
};

export type GitHubCommandResult = {
  code: number;
  stderr: Uint8Array;
  stdout: Uint8Array;
};

export type RunGitHubCommand = (
  args: readonly string[],
  signal?: AbortSignal,
) => Promise<GitHubCommandResult>;

export type GitHubPullClientOptions = {
  markdownExtensions?: readonly string[];
  maxFiles?: number;
  run: RunGitHubCommand;
};

const decoder = new TextDecoder();

const commandError = (stderr: string): Error => {
  const detail = stderr.trim();
  const normalized = detail.toLowerCase();
  if (
    normalized.includes("not logged") ||
    normalized.includes("authentication") ||
    normalized.includes("gh auth login")
  ) {
    return new Error(
      "GitHub CLI is not authenticated. Run `gh auth login --hostname github.com`.",
    );
  }
  if (normalized.includes("rate limit")) {
    return new Error("GitHub API rate limit exceeded. Try again later.");
  }
  if (normalized.includes("not found") || normalized.includes("http 404")) {
    return new Error(
      "GitHub pull request was not found or the authenticated account cannot access the repository.",
    );
  }
  return new Error(
    detail
      ? `GitHub CLI request failed: ${detail}`
      : "GitHub CLI request failed.",
  );
};

const runApi = async (
  endpoint: string,
  run: RunGitHubCommand,
  headers: readonly string[] = [],
  signal?: AbortSignal,
): Promise<Uint8Array> => {
  const args = ["api", "--hostname", "github.com"];
  for (const header of headers) args.push("-H", header);
  args.push(endpoint);
  const result = await run(args, signal);
  if (result.code !== 0) throw commandError(decoder.decode(result.stderr));
  return result.stdout;
};

const parseJson = <T>(bytes: Uint8Array, description: string): T => {
  try {
    return JSON.parse(decoder.decode(bytes)) as T;
  } catch {
    throw new Error(`GitHub CLI returned invalid ${description} JSON.`);
  }
};

export const readGitHubMarkdownSource = async (
  source: string,
  run: RunGitHubCommand,
): Promise<string> => {
  const url = new URL(source);
  if (url.protocol !== "https:" || url.hostname !== "api.github.com") {
    throw new Error("Invalid GitHub Contents API URL.");
  }
  const body = await runApi(
    `${url.pathname.replace(/^\//, "")}${url.search}`,
    run,
    ["Accept: application/vnd.github.raw+json"],
  );
  return decoder.decode(body);
};

export const readGitHubPullHeadSha = async (
  pull: GitHubPullSource,
  run: RunGitHubCommand,
  signal?: AbortSignal,
): Promise<string> => {
  const repoPath = `repos/${encodeURIComponent(pull.owner)}/${
    encodeURIComponent(pull.repo)
  }`;
  const pullResult = parseJson<{ head?: { sha?: unknown } }>(
    await runApi(`${repoPath}/pulls/${pull.pullNumber}`, run, [], signal),
    "pull request",
  );
  const headSha = pullResult.head?.sha;
  if (typeof headSha !== "string" || !headSha) {
    throw new Error(
      "GitHub API response did not contain the pull request head SHA.",
    );
  }
  return headSha;
};

export const getGitHubPullSnapshot = async (
  pull: GitHubPullSource,
  options: GitHubPullClientOptions,
  knownHeadSha?: string,
  signal?: AbortSignal,
): Promise<GitHubPullSnapshot> => {
  const run = options.run;
  const repoPath = `repos/${encodeURIComponent(pull.owner)}/${
    encodeURIComponent(pull.repo)
  }`;
  const headSha = knownHeadSha ??
    await readGitHubPullHeadSha(pull, run, signal);

  const extensions = new Set(
    (options.markdownExtensions ?? defaultMarkdownExtensions).map((value) =>
      value.toLowerCase()
    ),
  );
  const maxFiles = options.maxFiles ?? 20;
  const documents: GitHubPullDocument[] = [];
  for (let page = 1; documents.length < maxFiles; page += 1) {
    let files: Array<{ filename?: unknown; status?: unknown }>;
    try {
      files = parseJson(
        await runApi(
          `${repoPath}/pulls/${pull.pullNumber}/files?per_page=100&page=${page}`,
          run,
          [],
          signal,
        ),
        "changed-files",
      );
    } catch (error) {
      throw new Error(
        `Failed to list page ${page} of GitHub pull request files: ${
          error instanceof Error ? error.message : String(error)
        }`,
        { cause: error },
      );
    }
    if (!Array.isArray(files)) {
      throw new Error("GitHub CLI returned invalid changed-files JSON.");
    }
    for (const file of files) {
      if (file.status === "removed" || typeof file.filename !== "string") {
        continue;
      }
      if (!extensions.has(extname(file.filename).toLowerCase())) continue;
      const encodedPath = file.filename.split("/").map(encodeURIComponent).join(
        "/",
      );
      documents.push({
        commentSource: `${pull.url}/files/${encodedPath}`,
        filePath:
          `https://api.github.com/${repoPath}/contents/${encodedPath}?ref=${
            encodeURIComponent(headSha)
          }`,
        relativePath: file.filename,
      });
      if (documents.length >= maxFiles) break;
    }
    if (files.length < 100) break;
  }
  return { headSha, documents };
};

export const listGitHubPullDocuments = async (
  pull: GitHubPullSource,
  options: GitHubPullClientOptions,
): Promise<GitHubPullDocument[]> => {
  return (await getGitHubPullSnapshot(pull, options)).documents;
};
