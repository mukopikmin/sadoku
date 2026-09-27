export type GitHubAccountResult =
  | { account: { login: string; name?: string }; ok: true }
  | { message: string; ok: false };

export const loadGitHubAccount = async (): Promise<GitHubAccountResult> => {
  const response = await fetch("/__sadoku/github-account");
  if (!response.ok) {
    throw new Error(`Failed to load GitHub account: ${response.status}`);
  }
  const value = await response.json() as unknown;
  if (typeof value !== "object" || value === null || !("ok" in value)) {
    throw new Error("GitHub account response is invalid.");
  }
  if (
    value.ok === true && "account" in value &&
    typeof value.account === "object" && value.account !== null &&
    "login" in value.account && typeof value.account.login === "string"
  ) {
    const name =
      "name" in value.account && typeof value.account.name === "string"
        ? value.account.name
        : undefined;
    return { account: { login: value.account.login, name }, ok: true };
  }
  if (
    value.ok === false && "message" in value &&
    typeof value.message === "string"
  ) {
    return { message: value.message, ok: false };
  }
  throw new Error("GitHub account response is invalid.");
};
