import { noStoreJson } from "../responses.ts";
import {
  getGitHubAccount,
  type RunGitHubAccountCommand,
} from "../usecase/account/get_github_account.ts";

export const getGitHubAccountResponse = async (
  run: RunGitHubAccountCommand,
): Promise<Response> => noStoreJson(await getGitHubAccount(run));
