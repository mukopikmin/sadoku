import {
  Breadcrumb,
  Button,
  Dialog,
  Flex,
  IconButton,
  Link,
  Portal,
  Text,
} from "@chakra-ui/react";
import { Fragment, useState } from "react";
import type { DocumentSummary } from "../models/document";

type DocumentBreadcrumbProps = {
  document: DocumentSummary;
  documents: DocumentSummary[];
  onSelectDocument: (id: number) => void;
  onSelectDocuments: () => void;
};

const fileName = (path: string) => path.split("/").at(-1) ?? path;

const parentDirectory = (path: string) => {
  const separator = path.lastIndexOf("/");
  return separator === -1 ? "" : path.slice(0, separator);
};

export const DocumentBreadcrumb = ({
  document,
  documents,
  onSelectDocument,
  onSelectDocuments,
}: DocumentBreadcrumbProps) => {
  const [openDirectory, setOpenDirectory] = useState<string | null>(null);
  const parts = document.relativePath.split("/").filter(Boolean);
  const directories = parts.slice(0, -1);
  const directoryDocuments = openDirectory === null
    ? []
    : documents.filter((item) =>
      parentDirectory(item.relativePath) === openDirectory
    );

  return (
    <>
      <Breadcrumb.Root aria-label="Document path" mb="6">
        <Breadcrumb.List flexWrap="wrap">
          <Breadcrumb.Item>
            <Breadcrumb.Link
              href="#"
              onClick={(event) => {
                event.preventDefault();
                onSelectDocuments();
              }}
            >
              Documents
            </Breadcrumb.Link>
          </Breadcrumb.Item>
          {directories.map((directory, index) => {
            const path = directories.slice(0, index + 1).join("/");
            return (
              <Fragment key={path}>
                <Breadcrumb.Separator />
                <Breadcrumb.Item>
                  <Link
                    as="button"
                    color="fg.muted"
                    cursor="pointer"
                    onClick={() => setOpenDirectory(path)}
                    type="button"
                  >
                    {directory}
                  </Link>
                </Breadcrumb.Item>
              </Fragment>
            );
          })}
          <Breadcrumb.Separator />
          <Breadcrumb.Item>
            <Breadcrumb.CurrentLink>{parts.at(-1)}</Breadcrumb.CurrentLink>
          </Breadcrumb.Item>
        </Breadcrumb.List>
      </Breadcrumb.Root>

      <Dialog.Root
        onOpenChange={({ open }) => {
          if (!open) setOpenDirectory(null);
        }}
        open={openDirectory !== null}
      >
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>{openDirectory}</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                {directoryDocuments.length === 0
                  ? (
                    <Text color="fg.muted">
                      No Markdown documents in this directory.
                    </Text>
                  )
                  : (
                    <Flex direction="column" gap="2">
                      {directoryDocuments.map((item) => (
                        <Button
                          justifyContent="flex-start"
                          key={item.id}
                          onClick={() => {
                            setOpenDirectory(null);
                            onSelectDocument(item.id);
                          }}
                          variant="ghost"
                        >
                          {fileName(item.relativePath)}
                        </Button>
                      ))}
                    </Flex>
                  )}
              </Dialog.Body>
              <Dialog.CloseTrigger asChild>
                <IconButton
                  aria-label="Close directory"
                  size="sm"
                  variant="ghost"
                >
                  <svg
                    aria-hidden="true"
                    fill="none"
                    height="1em"
                    viewBox="0 0 16 16"
                    width="1em"
                  >
                    <path
                      d="m4 4 8 8m0-8-8 8"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeWidth="1.5"
                    />
                  </svg>
                </IconButton>
              </Dialog.CloseTrigger>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </>
  );
};
