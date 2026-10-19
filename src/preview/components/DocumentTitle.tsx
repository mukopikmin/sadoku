import {
  Button,
  Dialog,
  Field,
  Heading,
  Input,
  Portal,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useRef, useState } from "react";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

export const DocumentTitle = ({ documentId, title }: {
  documentId: number;
  title?: string;
}) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const mutation = useDocumentTitle(documentId);
  return (
    <Stack gap="3" mb="6">
      {title && (
        <Heading as="h1" size="3xl" overflowWrap="anywhere">{title}</Heading>
      )}
      <Button
        size="sm"
        variant="ghost"
        alignSelf="start"
        onClick={() => {
          setDraft(title ?? "");
          mutation.reset();
          setOpen(true);
        }}
      >
        {title ? "Edit title" : "Set title"}
      </Button>
      <Dialog.Root
        open={open}
        onOpenChange={({ open }) => {
          if (!mutation.isPending) setOpen(open);
        }}
        initialFocusEl={() => inputRef.current}
        closeOnEscape={!mutation.isPending}
        closeOnInteractOutside={!mutation.isPending}
      >
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  if (mutation.isPending) return;
                  mutation.mutate(draft, { onSuccess: () => setOpen(false) });
                }}
              >
                <Dialog.Header>
                  <Dialog.Title>Document title</Dialog.Title>
                </Dialog.Header>
                <Dialog.Body>
                  <Field.Root>
                    <Field.Label>Title</Field.Label>
                    <Input
                      ref={inputRef}
                      value={draft}
                      disabled={mutation.isPending}
                      onChange={(event) => setDraft(event.currentTarget.value)}
                    />
                    <Field.HelperText>
                      Leave empty to remove the title. Markdown headings are
                      saved separately.
                    </Field.HelperText>
                  </Field.Root>
                  {mutation.error && (
                    <Text role="alert" color="fg.error">
                      {mutation.error.message}
                    </Text>
                  )}
                </Dialog.Body>
                <Dialog.Footer>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={mutation.isPending}
                    onClick={() => setOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    loading={mutation.isPending}
                    disabled={mutation.isPending}
                  >
                    Save
                  </Button>
                </Dialog.Footer>
              </form>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </Stack>
  );
};
