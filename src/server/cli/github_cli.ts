import type { RunGitHubCommand } from "../github_pull.ts";

export const runGitHubCommand: RunGitHubCommand = async (args) => {
  try {
    return await new Deno.Command("gh", {
      args: [...args],
      stdin: "null",
      stdout: "piped",
      stderr: "piped",
    }).output();
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new Error(
        "GitHub pull request previews require the GitHub CLI. Install gh, then run `gh auth login --hostname github.com`.",
      );
    }
    throw error;
  }
};
