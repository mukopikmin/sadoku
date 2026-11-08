import { Avatar, Flex, Spinner, Text } from "@chakra-ui/react";
import { useGitHubAccount } from "../../hooks/useGitHubAccount";

export const GitHubAccountSettings = ({ enabled }: { enabled: boolean }) => {
  const state = useGitHubAccount(enabled);

  return (
    <Flex alignItems="center" justifyContent="space-between" gap="4">
      <Text as="div">
        <Text textStyle="label">GitHub account</Text>
        <Text color="fg.muted" fontSize="sm">
          Account authenticated with GitHub CLI
        </Text>
      </Text>
      {state.status === "loading" ? (
        <Spinner aria-label="Loading GitHub account" size="sm" />
      ) : state.status === "error" ? (
        <Text color="fg.error">Unavailable</Text>
      ) : state.status === "authenticated" ? (
        <Flex alignItems="center" gap="3">
          <Avatar.Root size="sm">
            <Avatar.Fallback name={state.account.login} />
            <Avatar.Image
              alt={`${state.account.login}'s GitHub avatar`}
              src={state.account.avatarUrl}
            />
          </Avatar.Root>
          <Text as="div" textAlign="end">
            {state.account.name && (
              <Text fontWeight="medium">{state.account.name}</Text>
            )}
            <Text color="fg.muted" fontSize="sm">
              @{state.account.login}
            </Text>
          </Text>
        </Flex>
      ) : (
        <Text color="fg.muted">Not authenticated</Text>
      )}
    </Flex>
  );
};
