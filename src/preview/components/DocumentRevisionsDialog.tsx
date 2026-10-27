import {
  Box,
  Button,
  CloseButton,
  createListCollection,
  Dialog,
  Flex,
  Portal,
  Select,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useMemo } from "react";
import { useDocumentRevisions } from "../hooks/useDocumentRevisions";
import { useDocumentRestore } from "../hooks/useDocumentRestore";
import { ConfirmDialog } from "./ConfirmDialog";
import { ReadOnlyMarkdownPreview } from "../pages/markdown/ReadOnlyMarkdownPreview";

type Props = {
  canRestore?: boolean;
  deleted?: boolean;
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
    | "documentId"
    | "documentPath"
    | "markdown"
    | "showHtmlComments"
    | "theme"
    | "canRestore"
    | "deleted"
    | "onOpenChange"
  >,
) => {
  const revisions = useDocumentRevisions(props.documentId, props.markdown);
  const restore = useDocumentRestore(
    props.documentId,
    () => props.onOpenChange(false),
  );
  const savedRevisions = revisions.history.status === "ready"
    ? revisions.history.revisions
    : undefined;
  const collection = useMemo(() =>
    createListCollection({
      items: [
        { value: "current", label: "Current" },
        ...(savedRevisions ?? []).flatMap((revision, index) =>
          index === 0 && !revisions.showLatestSaved ? [] : [{
            value: String(revision.id),
            label: `${index === 0 ? "Saved snapshot" : `${index} earlier`} — ${
              new Date(revision.recordedAt).toLocaleString()
            }`,
          }]
        ),
      ],
    }), [savedRevisions, revisions.showLatestSaved]);
  const changes = revisions.comparison.status === "ready"
    ? revisions.comparison.changes
    : undefined;
  const hasChanges = changes !== undefined &&
    (changes.current.size > 0 || changes.previous.size > 0);
  const restoreId = revisions.selectedId ??
    (props.deleted ? savedRevisions?.[0]?.id : undefined);
  return (
    <Stack gap="4">
      <Flex
        direction={{ base: "column", md: "row" }}
        align={{ base: "stretch", md: "center" }}
        gap="4"
      >
        <Select.Root
          disabled={restore.isPending}
          flex="1"
          minW="0"
          collection={collection}
          value={[String(revisions.selectedId ?? "current")]}
          onValueChange={({ value }) => {
            revisions.selectRevision(
              value[0] === "current" ? undefined : Number(value[0]),
            );
          }}
          positioning={{
            strategy: "fixed",
            hideWhenDetached: true,
            sameWidth: true,
          }}
          lazyMount
          unmountOnExit
        >
          <Select.HiddenSelect />
          <Select.Control>
            <Select.Trigger aria-label="Revision">
              <Select.ValueText />
            </Select.Trigger>
            <Select.IndicatorGroup>
              <Select.Indicator />
            </Select.IndicatorGroup>
          </Select.Control>
          <Select.Positioner>
            <Select.Content aria-label="Revision">
              {collection.items.map((item) => (
                <Select.Item item={item} key={item.value}>
                  <Select.ItemText>{item.label}</Select.ItemText>
                  <Select.ItemIndicator />
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Positioner>
        </Select.Root>
        {changes && (
          <Flex align="center" gap="3" wrap="wrap" flex={{ md: "1" }}>
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
      </Flex>
      {props.canRestore && restoreId !== undefined &&
        revisions.content.status === "ready" && (
        <Button
          alignSelf="start"
          disabled={restore.isPending}
          onClick={() =>
            restore.request(
              restoreId,
              props.deleted ? undefined : props.markdown,
            )}
        >
          Restore this revision
        </Button>
      )}
      <ConfirmDialog
        title="Restore this revision?"
        confirmLabel="Restore file"
        open={restore.open}
        isPending={restore.isPending}
        onOpenChange={(open) => {
          if (!open) restore.cancel();
        }}
        onConfirm={restore.confirm}
      >
        This replaces the local file with the selected revision. The current
        contents will be kept in revision history.
        {restore.error && (
          <Text as="span" display="block" role="alert" color="fg.error">
            {restore.error}
          </Text>
        )}
      </ConfirmDialog>
      {revisions.history.status === "loading" && (
        <Text role="status">Loading saved revisions...</Text>
      )}
      {revisions.history.status === "empty" && (
        <Text color="fg.muted">No saved revisions are available.</Text>
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
            revisionHighlight={changes
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
            <RevisionContent
              key={props.documentId}
              {...props}
              onOpenChange={onOpenChange}
            />
          </Dialog.Body>
          <Dialog.CloseTrigger asChild>
            <CloseButton aria-label="Close document revisions" size="sm" />
          </Dialog.CloseTrigger>
        </Dialog.Content>
      </Dialog.Positioner>
    </Portal>
  </Dialog.Root>
);
