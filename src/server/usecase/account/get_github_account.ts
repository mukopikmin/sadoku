export type GitHubAccount = {
  login: string;
  name?: string;
};

export type GitHubAccountCommandResult = {
  code: number;
  stdout: Uint8Array;
  stderr: Uint8Array;
};

export type RunGitHubAccountCommand = (
  args: readonly string[],
) => Promise<GitHubAccountCommandResult>;

export type GetGitHubAccountResult =
  | { account: GitHubAccount; ok: true }
  | { message: string; ok: false };

const decoder = new TextDecoder();

export const getGitHubAccount = async (
  run: RunGitHubAccountCommand,
): Promise<GetGitHubAccountResult> => {
  const result = await run(["api", "--hostname", "github.com", "user"]);
  if (result.code !== 0) {
    return {
      message: decoder.decode(result.stderr).trim() ||
        "GitHub CLI authentication is unavailable.",
      ok: false,
    };
  }

  try {
    const value = JSON.parse(decoder.decode(result.stdout)) as unknown;
    if (
      typeof value !== "object" || value === null ||
      !("login" in value) || typeof value.login !== "string" ||
      value.login.length === 0
    ) {
      return { message: "GitHub returned an invalid account.", ok: false };
    }
    const name = "name" in value && typeof value.name === "string" &&
        value.name.length > 0
      ? value.name
      : undefined;
    return { account: { login: value.login, name }, ok: true };
  } catch {
    return { message: "GitHub returned an invalid account.", ok: false };
  }
};
