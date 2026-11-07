import { useQuery } from "@tanstack/react-query";
import { loadGitHubAccount } from "../api/githubAccount";

export const useGitHubAccount = (enabled: boolean) => {
  const query = useQuery({
    enabled,
    queryFn: loadGitHubAccount,
    queryKey: ["github-account"],
    staleTime: 0,
  });
  if (query.isPending) return { status: "loading" as const };
  if (query.error)
    return { status: "error" as const, message: query.error.message };
  if (!query.data.ok) return { status: "unauthenticated" as const };
  return { status: "authenticated" as const, account: query.data.account };
};
