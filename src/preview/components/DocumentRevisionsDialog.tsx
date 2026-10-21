import {
  Button,
  CloseButton,
  Collapsible,
  Dialog,
  Flex,
  Portal,
  Tabs,
  Text,
} from "@chakra-ui/react";
import { useMemo, useState } from "react";
import { changedRevisionLines } from "../markdown/revisionDiff";
import { RevisionSourceDiff } from "../markdown/RevisionSourceDiff";
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
                    <>
                      <Flex align="center" gap="3" wrap="wrap" mb="3">
                        <Button
                          aria-pressed={highlightChanges && hasChanges}
                          disabled={!hasChanges}
                          onClick={() => setHighlightChanges((value) => !value)}
                          size="sm"
                          variant={highlightChanges && hasChanges
                            ? "subtle"
                            : "outline"}
                        >
                          Highlight changes
                        </Button>
                        <Text color="fg.muted" fontSize="sm">
                          {hasChanges
                            ? `Compared with Previous: ${changes.current.size} added, ${changes.previous.size} removed lines.`
                            : "No changes since the previous revision."}
                        </Text>
                      </Flex>
                      {hasChanges && (
                        <Collapsible.Root lazyMount unmountOnExit mb="3">
                          <Collapsible.Trigger asChild>
                            <Button size="sm" variant="ghost">
                              View source diff
                            </Button>
                          </Collapsible.Trigger>
                          <Collapsible.Content>
                            <RevisionSourceDiff diff={changes.sourceDiff} />
                          </Collapsible.Content>
                        </Collapsible.Root>
                      )}
                    </>
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
