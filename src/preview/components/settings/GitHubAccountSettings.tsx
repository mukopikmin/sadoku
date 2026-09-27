import { Flex, Spinner, Text } from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import { loadGitHubAccount } from "../../api/githubAccount";

export const GitHubAccountSettings = ({ enabled }: { enabled: boolean }) => {
  const query = useQuery({
    enabled,
    queryFn: loadGitHubAccount,
    queryKey: ["github-account"],
    staleTime: 0,
  });

  return (
    <Flex alignItems="center" justifyContent="space-between" gap="4">
      <Text as="div">
        <Text fontWeight="medium">GitHub account</Text>
        <Text color="fg.muted" fontSize="sm">
          Account authenticated with GitHub CLI
        </Text>
      </Text>
      {query.isPending
        ? <Spinner aria-label="Loading GitHub account" size="sm" />
        : query.error
        ? <Text color="fg.error">Unavailable</Text>
        : query.data.ok
        ? (
          <Text as="div" textAlign="end">
            {query.data.account.name && (
              <Text fontWeight="medium">{query.data.account.name}</Text>
            )}
            <Text color="fg.muted" fontSize="sm">
              @{query.data.account.login}
            </Text>
          </Text>
        )
        : <Text color="fg.muted">Not authenticated</Text>}
    </Flex>
  );
};
