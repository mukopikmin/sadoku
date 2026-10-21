import { CloseButton, Dialog, Portal, Tabs, Text } from "@chakra-ui/react";
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
}) => (
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
                <ReadOnlyMarkdownPreview
                  documentPath={documentPath}
                  markdown={markdown}
                  showHtmlComments={showHtmlComments}
                  theme={theme}
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
