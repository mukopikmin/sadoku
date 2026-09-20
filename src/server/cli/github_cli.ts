import type { RunGitHubCommand } from "../github_pull.ts";

export const runGitHubCommand: RunGitHubCommand = async (args, signal) => {
  try {
    signal?.throwIfAborted();
    const child = new Deno.Command("gh", {
      args: [...args],
      stdin: "null",
      stdout: "piped",
      stderr: "piped",
    }).spawn();
    const abort = () => {
      try {
        child.kill("SIGTERM");
      } catch {
        // The command may have exited between the abort and this callback.
      }
    };
    signal?.addEventListener("abort", abort, { once: true });
    try {
      const result = await child.output();
      signal?.throwIfAborted();
      return result;
    } finally {
      signal?.removeEventListener("abort", abort);
    }
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new Error(
        "GitHub pull request previews require the GitHub CLI. Install gh, then run `gh auth login --hostname github.com`.",
      );
    }
    throw error;
  }
};
