import { Dialog, Portal, Spinner, Table, Text } from "@chakra-ui/react";
import { useTagsQuery } from "../hooks/usePreviewData";

type Props = {
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export const TagsDialog = ({ onOpenChange, open }: Props) => {
  const tags = useTagsQuery(open);

  return (
    <Dialog.Root
      finalFocusEl={() =>
        document.querySelector<HTMLButtonElement>(
          'button[aria-label="Open tags"]',
        )}
      onOpenChange={({ open }) => onOpenChange(open)}
      open={open}
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Tags</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body pb="6">
              {tags.isPending
                ? <Spinner aria-label="Loading tags" />
                : tags.error
                ? <Text color="fg.error">{tags.error.message}</Text>
                : tags.data.length === 0
                ? <Text color="fg.muted">No tags yet.</Text>
                : (
                  <Table.Root>
                    <Table.Header>
                      <Table.Row>
                        <Table.ColumnHeader>Tag</Table.ColumnHeader>
                        <Table.ColumnHeader textAlign="end">
                          Documents
                        </Table.ColumnHeader>
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
                      {tags.data.map((tag) => (
                        <Table.Row key={tag.id}>
                          <Table.Cell>{tag.name}</Table.Cell>
                          <Table.Cell textAlign="end">
                            {tag.documentCount.toLocaleString()}
                          </Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table.Root>
                )}
            </Dialog.Body>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};
