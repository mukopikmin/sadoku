import {
  Button,
  Dialog,
  Field,
  Input,
  Portal,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useRef } from "react";
import type { useDocumentCreator } from "../hooks/useDocumentCreator";

export const CreateDocumentDialog = ({ creator }: {
  creator: ReturnType<typeof useDocumentCreator>;
}) => {
  const filenameRef = useRef<HTMLInputElement>(null);
  if (creator.state.status === "closed") return null;
  const { input, error } = creator.state;
  const filename = input.filename.trim();
  const resolvedFilename = filename && !filename.includes(".")
    ? `${filename}.md`
    : filename;
  const relativePath = [input.directory, resolvedFilename].filter(Boolean).join(
    "/",
  );
  return (
    <Dialog.Root
      open
      onOpenChange={({ open }) => {
        if (!open) creator.close();
      }}
      closeOnEscape={!creator.pending}
      closeOnInteractOutside={!creator.pending}
      initialFocusEl={() => filenameRef.current}
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void creator.save();
              }}
            >
              <Dialog.Header>
                <Dialog.Title>New file</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <Stack gap="4">
                  <Text>Directory: {input.directory || "Project root"}</Text>
                  <Field.Root required>
                    <Field.Label>
                      Filename<Field.RequiredIndicator />
                    </Field.Label>
                    <Input
                      ref={filenameRef}
                      value={input.filename}
                      disabled={creator.pending}
                      onChange={(event) =>
                        creator.change("filename", event.currentTarget.value)}
                    />
                    <Field.HelperText>
                      Uses .md when the extension is omitted.
                    </Field.HelperText>
                  </Field.Root>
                  <Field.Root>
                    <Field.Label>Document title (optional)</Field.Label>
                    <Input
                      value={input.title}
                      disabled={creator.pending}
                      onChange={(event) =>
                        creator.change("title", event.currentTarget.value)}
                    />
                    <Field.HelperText>
                      Adds a heading at the start of the document.
                    </Field.HelperText>
                  </Field.Root>
                  <Text color="fg.muted" fontSize="sm" overflowWrap="anywhere">
                    File: {relativePath || "—"}
                  </Text>
                  {error && <Text color="fg.error" role="alert">{error}</Text>}
                </Stack>
              </Dialog.Body>
              <Dialog.Footer>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={creator.pending}
                  onClick={creator.close}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={creator.pending || !filename}
                  loading={creator.pending}
                >
                  Create
                </Button>
              </Dialog.Footer>
            </form>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};
