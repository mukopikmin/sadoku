import { basename } from "@std/path";
import type {
  DirectorySession,
  DocumentStore,
} from "./usecase/document/mod.ts";
import {
  getGitHubPullSnapshot,
  type GitHubPullClientOptions,
  readGitHubPullHeadSha,
  type RunGitHubCommand,
} from "./github_pull.ts";

export const githubPullPollIntervalMs = 30_000;

export type GitHubPullInvalidation = () => void;

export const createGitHubPullInvalidationHub = () => {
  const listeners = new Set<GitHubPullInvalidation>();
  return {
    notify: () => listeners.forEach((listener) => listener()),
    subscribe: (listener: GitHubPullInvalidation) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
};

export type GitHubPullMonitorOptions = {
  documentStore: DocumentStore;
  intervalMs?: number;
  logError: (message: string) => void;
  markdownExtensions?: readonly string[];
  maxFiles?: number;
  notify: GitHubPullInvalidation;
  run: RunGitHubCommand;
  session: DirectorySession;
  wait?: (delayMs: number, signal: AbortSignal) => Promise<void>;
};

const waitForNextPoll = (delayMs: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (signal.aborted) return resolve();
    const timeout = setTimeout(done, delayMs);
    function done() {
      clearTimeout(timeout);
      signal.removeEventListener("abort", done);
      resolve();
    }
    signal.addEventListener("abort", done, { once: true });
  });

export const monitorGitHubPull = async (
  options: GitHubPullMonitorOptions,
  signal: AbortSignal,
): Promise<void> => {
  const pullState = options.session.githubPull;
  if (!pullState) return;
  const pull = {
    owner: pullState.owner,
    repo: pullState.repo,
    pullNumber: pullState.pullNumber,
    url:
      `https://github.com/${pullState.owner}/${pullState.repo}/pull/${pullState.pullNumber}`,
  };
  const clientOptions: GitHubPullClientOptions = {
    run: options.run,
    markdownExtensions: options.markdownExtensions,
    maxFiles: options.maxFiles,
  };
  const wait = options.wait ?? waitForNextPoll;

  while (!signal.aborted) {
    await wait(options.intervalMs ?? githubPullPollIntervalMs, signal);
    if (signal.aborted) break;
    try {
      const headSha = await readGitHubPullHeadSha(pull, options.run, signal);
      if (headSha === pullState.headSha) continue;
      const snapshot = await getGitHubPullSnapshot(
        pull,
        clientOptions,
        headSha,
        signal,
      );
      const documents = await Promise.all(
        snapshot.documents.map(async (item) => ({
          ...await options.documentStore.ensure(item.commentSource),
          deleted: false,
          filePath: item.filePath,
          relativePath: item.relativePath,
          title: basename(item.relativePath),
        })),
      );
      options.session.documents.splice(
        0,
        options.session.documents.length,
        ...documents,
      );
      options.session.documentsById.clear();
      for (const document of documents) {
        options.session.documentsById.set(document.id, document);
      }
      pullState.headSha = headSha;
      options.notify();
    } catch (error) {
      if (signal.aborted) break;
      options.logError(
        `Failed to check GitHub pull request for updates: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
};
