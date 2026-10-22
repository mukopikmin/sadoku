import {
  Box,
  Button,
  CloseButton,
  Dialog,
  Flex,
  NativeSelect,
  Portal,
  Stack,
  Switch,
  Text,
} from "@chakra-ui/react";
import { useState } from "react";
import { useDocumentRevisions } from "../hooks/useDocumentRevisions";
import { ReadOnlyMarkdownPreview } from "../pages/markdown/ReadOnlyMarkdownPreview";

type Props = {
  documentId: number;
  documentPath?: string;
  markdown: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  showHtmlComments: boolean;
  theme: "dark" | "default";
};

const RevisionContent = (
  props: Pick<
    Props,
    "documentId" | "documentPath" | "markdown" | "showHtmlComments" | "theme"
  >,
) => {
  const revisions = useDocumentRevisions(props.documentId, props.markdown);
  const [highlightChanges, setHighlightChanges] = useState(true);
  const changes = revisions.comparison.status === "ready"
    ? revisions.comparison.changes
    : undefined;
  const hasChanges = changes !== undefined &&
    (changes.current.size > 0 || changes.previous.size > 0);
  return (
    <Stack gap="4">
      <NativeSelect.Root>
        <NativeSelect.Field
          aria-label="Revision"
          value={revisions.selectedId ?? "current"}
          onChange={(event) => {
            revisions.selectRevision(
              event.currentTarget.value === "current"
                ? undefined
                : Number(event.currentTarget.value),
            );
          }}
        >
          <option value="current">Current</option>
          {revisions.history.status === "ready" &&
            revisions.history.revisions.map((revision, index) => (
              <option key={revision.id} value={revision.id}>
                {index === 0 ? "Latest saved" : `${index} earlier`} —{" "}
                {new Date(revision.recordedAt).toLocaleString()}
              </option>
            ))}
        </NativeSelect.Field>
        <NativeSelect.Indicator />
      </NativeSelect.Root>
      {revisions.history.status === "loading" && (
        <Text role="status">Loading saved revisions...</Text>
      )}
      {revisions.history.status === "empty" && (
        <Text color="fg.muted">No saved revisions are available.</Text>
      )}
      {revisions.history.status === "ready" && (
        <Text color="fg.muted" fontSize="sm">
          Showing {revisions.history.revisions.length}{" "}
          saved revisions, newest first (up to 20).
        </Text>
      )}
      {revisions.history.status === "error" && (
        <Stack align="start">
          <Text color="fg.error" role="alert">{revisions.history.message}</Text>
          <Button size="sm" variant="outline" onClick={revisions.retryHistory}>
            Retry history
          </Button>
        </Stack>
      )}
      {revisions.content.status === "ready" &&
        revisions.comparison.status === "loading" && (
        <Text role="status">Loading previous revision for comparison...</Text>
      )}
      {revisions.content.status === "ready" &&
        revisions.comparison.status === "error" &&
        revisions.history.status !== "error" && (
        <Stack align="start">
          <Text color="fg.error" role="alert">
            {revisions.comparison.message}
          </Text>
          <Button
            size="sm"
            variant="outline"
            onClick={revisions.retryComparison}
          >
            Retry comparison
          </Button>
        </Stack>
      )}
      {revisions.comparison.status === "unavailable" && (
        <Text color="fg.muted" fontSize="sm">
          No previous revision is available for comparison.
        </Text>
      )}
      {changes && (
        <Flex align="center" gap="3" wrap="wrap" mb="3">
          <Switch.Root
            checked={highlightChanges && hasChanges}
            disabled={!hasChanges}
            onCheckedChange={({ checked }) => setHighlightChanges(checked)}
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
                aria-label={`Line changes from previous revision: ${changes.current.size} added, ${changes.previous.size} removed`}
                fontSize="sm"
                fontWeight="semibold"
                gap="2"
                ms="auto"
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
                No changes from the previous revision.
              </Text>
            )}
        </Flex>
      )}
      <Box
        role="region"
        aria-label="Revision content"
        aria-busy={revisions.content.status === "loading"}
      >
        {revisions.content.status === "loading" && (
          <Text role="status">Loading revision...</Text>
        )}
        {revisions.content.status === "error" && (
          <Stack align="start">
            <Text color="fg.error" role="alert">
              {revisions.content.message}
            </Text>
            <Button
              size="sm"
              variant="outline"
              onClick={revisions.retryRevision}
            >
              Retry revision
            </Button>
          </Stack>
        )}
        {revisions.content.status === "ready" && (
          <ReadOnlyMarkdownPreview
            documentPath={props.documentPath}
            markdown={revisions.content.markdown}
            showHtmlComments={props.showHtmlComments}
            theme={props.theme}
            revisionHighlight={highlightChanges && changes
              ? { lines: changes.current, kind: "addition" }
              : undefined}
          />
        )}
      </Box>
    </Stack>
  );
};

export const DocumentRevisionsDialog = (
  { onOpenChange, open, ...props }: Props,
) => (
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
            <RevisionContent key={props.documentId} {...props} />
          </Dialog.Body>
          <Dialog.CloseTrigger asChild>
            <CloseButton aria-label="Close document revisions" size="sm" />
          </Dialog.CloseTrigger>
        </Dialog.Content>
      </Dialog.Positioner>
    </Portal>
  </Dialog.Root>
);
