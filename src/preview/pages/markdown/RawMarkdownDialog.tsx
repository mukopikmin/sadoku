import { Box, Button, Dialog, Portal } from "@chakra-ui/react";
import type { CommentRange } from "./commentRendering";
import { formatRangeLabel } from "./commentRendering";

export const RawMarkdownDialog = ({
  markdown,
  onOpenChange,
  open,
  range,
}: {
  markdown: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  range?: CommentRange;
}) => {
  const source = range
    ? markdown.split(/\r?\n/).slice(range.startLine - 1, range.endLine).join(
      "\n",
    )
    : "";

  return (
    <Dialog.Root
      onOpenChange={({ open }) => onOpenChange(open)}
      open={open}
      size="lg"
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>
                Raw Markdown{range ? ` — ${formatRangeLabel(range)}` : ""}
              </Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Box
                as="pre"
                bg="code.bg"
                borderRadius="md"
                className="markdown-code-block"
                color="code.fg"
                maxH="60vh"
                overflow="auto"
                p="4"
              >
                <code>{source}</code>
              </Box>
            </Dialog.Body>
            <Dialog.Footer>
              <Button onClick={() => onOpenChange(false)} variant="outline">
                Close
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};
