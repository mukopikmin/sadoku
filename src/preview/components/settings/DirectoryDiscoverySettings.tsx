import { Flex, Input, TagsInput, Text } from "@chakra-ui/react";
import { useDirectoryDiscovery } from "../../hooks/useDirectoryDiscovery";

export type DirectoryDiscoverySettingsProps = {
  excludedDirectories: string[];
  markdownExtensions: string[];
  maxDepth: number;
  maxFiles: number;
  onDirectoryLimitsChange: (maxDepth: number, maxFiles: number) => void;
  onExcludedDirectoriesChange: (value: string[]) => void;
  onMarkdownExtensionsChange: (value: string[]) => void;
};

export const DirectoryDiscoverySettings = (
  props: DirectoryDiscoverySettingsProps,
) => {
  const discovery = useDirectoryDiscovery(props);
  const excludedError =
    discovery.directories.status === "invalid"
      ? discovery.directories.message
      : undefined;
  const extensionError =
    discovery.extensions.status === "invalid"
      ? discovery.extensions.message
      : undefined;
  return (
    <Flex direction="column" gap="3">
      <Text as="div">
        <Text id="directory-discovery-label" textStyle="label">
          Directory discovery
        </Text>
        <Text
          color="fg.muted"
          fontSize="sm"
          id="directory-discovery-description"
        >
          Changes apply the next time a directory preview starts
        </Text>
      </Text>
      <Flex
        aria-describedby="directory-discovery-description"
        aria-labelledby="directory-discovery-label"
        direction="column"
        gap="3"
        ps="4"
        role="group"
      >
        <Flex alignItems="center" justifyContent="space-between" gap="4">
          <Text as="label" htmlFor="directory-max-depth" textStyle="label">
            Maximum depth
          </Text>
          <Input
            id="directory-max-depth"
            min="0"
            onChange={(event) =>
              discovery.changeDepth(event.currentTarget.value)
            }
            type="number"
            value={props.maxDepth}
            width="24"
          />
        </Flex>
        <Flex alignItems="center" justifyContent="space-between" gap="4">
          <Text as="label" htmlFor="directory-max-files" textStyle="label">
            Maximum files
          </Text>
          <Input
            id="directory-max-files"
            min="1"
            onChange={(event) =>
              discovery.changeFiles(event.currentTarget.value)
            }
            type="number"
            value={props.maxFiles}
            width="24"
          />
        </Flex>
        <TagsInput.Root
          addOnPaste
          alignItems="start"
          aria-describedby="excluded-directories-help"
          blurBehavior="add"
          display="grid"
          gap="4"
          gridTemplateColumns={{ base: "1fr", sm: "1fr minmax(0, 15rem)" }}
          invalid={excludedError !== undefined}
          onInputValueChange={discovery.clearDirectoryError}
          onValueChange={({ value }) => discovery.changeDirectories(value)}
          onValueInvalid={discovery.invalidDirectory}
          sanitizeValue={(value) => value.trim()}
          validate={({ inputValue }) => discovery.validateDirectory(inputValue)}
          value={props.excludedDirectories}
        >
          <TagsInput.Label
            alignItems="center"
            display="flex"
            minH="10"
            textStyle="label"
          >
            Excluded directories
          </TagsInput.Label>
          <Flex direction="column" gap="1" minW="0">
            <TagsInput.Control>
              <TagsInput.Items />
              <TagsInput.Input placeholder="Add a directory" />
            </TagsInput.Control>
            <TagsInput.HiddenInput />
            <Text
              color={excludedError ? "fg.error" : "fg.muted"}
              fontSize="sm"
              id="excluded-directories-help"
            >
              {excludedError ??
                "Press Enter or comma to add a name. Names match at every level."}
            </Text>
          </Flex>
        </TagsInput.Root>
        <TagsInput.Root
          addOnPaste
          alignItems="start"
          aria-describedby="markdown-extensions-help"
          blurBehavior="add"
          display="grid"
          gap="4"
          gridTemplateColumns={{ base: "1fr", sm: "1fr minmax(0, 15rem)" }}
          invalid={extensionError !== undefined}
          onInputValueChange={discovery.clearExtensionError}
          onValueChange={({ value }) => discovery.changeExtensions(value)}
          onValueInvalid={discovery.invalidExtension}
          sanitizeValue={(value) => value.trim().toLowerCase()}
          validate={({ inputValue }) => discovery.validateExtension(inputValue)}
          value={props.markdownExtensions}
        >
          <TagsInput.Label
            alignItems="center"
            display="flex"
            minH="10"
            textStyle="label"
          >
            Markdown extensions
          </TagsInput.Label>
          <Flex direction="column" gap="1" minW="0">
            <TagsInput.Control>
              <TagsInput.Items />
              <TagsInput.Input placeholder="Add an extension" />
            </TagsInput.Control>
            <TagsInput.HiddenInput />
            <Text
              color={extensionError ? "fg.error" : "fg.muted"}
              fontSize="sm"
              id="markdown-extensions-help"
            >
              {extensionError ??
                "Press Enter or comma to add an extension such as .mdx."}
            </Text>
          </Flex>
        </TagsInput.Root>
      </Flex>
    </Flex>
  );
};
