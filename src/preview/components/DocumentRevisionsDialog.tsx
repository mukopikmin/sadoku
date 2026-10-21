import {
  CloseButton,
  Dialog,
  Flex,
  Portal,
  Switch,
  Tabs,
  Text,
} from "@chakra-ui/react";
import { useMemo, useState } from "react";
import { changedRevisionLines } from "../markdown/revisionDiff";
import { ReadOnlyMarkdownPreview } from "../pages/markdown/ReadOnlyMarkdownPreview";

export const DocumentRevisionsDialog = ({
  documentPath,
  markdown,
  onOpenChange,
  open,
  previousMarkdown,
  showHtmlComments,
  theme,
}: {
  documentPath?: string;
  markdown: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  previousMarkdown?: string;
  showHtmlComments: boolean;
  theme: "dark" | "default";
}) => {
  const [highlightChanges, setHighlightChanges] = useState(true);
  const changes = useMemo(
    () =>
      previousMarkdown === undefined
        ? undefined
        : changedRevisionLines(previousMarkdown, markdown),
    [previousMarkdown, markdown],
  );
  const hasChanges = changes !== undefined &&
    (changes.current.size > 0 || changes.previous.size > 0);

  return (
    <Dialog.Root
      lazyMount
      unmountOnExit
      onOpenChange={({ open }) => onOpenChange(open)}
      open={open}
      scrollBehavior="inside"
      size="cover"
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Document revisions</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Tabs.Root defaultValue="current" lazyMount unmountOnExit>
                <Tabs.List aria-label="Revision">
                  <Tabs.Trigger value="current">Current</Tabs.Trigger>
                  <Tabs.Trigger
                    value="previous"
                    disabled={previousMarkdown === undefined}
                  >
                    Previous
                  </Tabs.Trigger>
                </Tabs.List>
                {previousMarkdown === undefined && (
                  <Text color="fg.muted" pt="4">
                    No previous revision is available.
                  </Text>
                )}
                <Tabs.Content value="current">
                  {changes && (
                    <Flex align="center" gap="3" wrap="wrap" mb="3">
                      <Switch.Root
                        checked={highlightChanges && hasChanges}
                        disabled={!hasChanges}
                        onCheckedChange={({ checked }) =>
                          setHighlightChanges(checked)}
                        size="sm"
                      >
                        <Switch.HiddenInput role="switch" />
                        <Switch.Label>Highlight changes</Switch.Label>
                        <Switch.Control>
                          <Switch.Thumb />
                        </Switch.Control>
                      </Switch.Root>
                      {hasChanges
                        ? (
                          <Flex
                            as="span"
                            role="group"
                            aria-label={`Line changes from Previous: ${changes.current.size} added, ${changes.previous.size} removed`}
                            fontSize="sm"
                            fontWeight="semibold"
                            gap="2"
                          >
                            <Text
                              as="span"
                              color="syntax.addition.fg"
                              aria-hidden="true"
                            >
                              +{changes.current.size}
                            </Text>
                            <Text
                              as="span"
                              color="syntax.deletion.fg"
                              aria-hidden="true"
                            >
                              -{changes.previous.size}
                            </Text>
                          </Flex>
                        )
                        : (
                          <Text color="fg.muted" fontSize="sm">
                            No changes since the previous revision.
                          </Text>
                        )}
                    </Flex>
                  )}
                  <ReadOnlyMarkdownPreview
                    documentPath={documentPath}
                    markdown={markdown}
                    showHtmlComments={showHtmlComments}
                    theme={theme}
                    revisionHighlight={highlightChanges && changes
                      ? { lines: changes.current, kind: "addition" }
                      : undefined}
                  />
                </Tabs.Content>
                <Tabs.Content value="previous">
                  {previousMarkdown !== undefined && (
                    <ReadOnlyMarkdownPreview
                      documentPath={documentPath}
                      markdown={previousMarkdown}
                      showHtmlComments={showHtmlComments}
                      theme={theme}
                    />
                  )}
                </Tabs.Content>
              </Tabs.Root>
            </Dialog.Body>
            <Dialog.CloseTrigger asChild>
              <CloseButton aria-label="Close document revisions" size="sm" />
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};
