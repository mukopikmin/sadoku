import {
  Badge,
  Breadcrumb,
  Button,
  Dialog,
  Flex,
  IconButton,
  Link,
  Portal,
  Text,
} from "@chakra-ui/react";
import { X } from "lucide-react";
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
                          aria-current={item.id === document.id
                            ? "page"
                            : undefined}
                          colorPalette={item.id === document.id
                            ? "blue"
                            : undefined}
                          justifyContent="flex-start"
                          key={item.id}
                          onClick={() => {
                            setOpenDirectory(null);
                            onSelectDocument(item.id);
                          }}
                          variant={item.id === document.id ? "subtle" : "ghost"}
                        >
                          <Text flex="1" textAlign="start">
                            {fileName(item.relativePath)}
                          </Text>
                          {item.id === document.id && (
                            <Badge colorPalette="blue" variant="solid">
                              Current
                            </Badge>
                          )}
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
                  <X aria-hidden="true" />
                </IconButton>
              </Dialog.CloseTrigger>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </>
  );
};
