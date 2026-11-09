import { Button, Flex, IconButton, Stack } from "@chakra-ui/react";
import { type ReactNode, type RefObject } from "react";
import { Pencil, Tag } from "lucide-react";
import type { DocumentTag } from "../models/document";
import { TagLabel } from "./ui/TagLabel";
import { Tooltip } from "./ui/tooltip";
import { DocumentTitle } from "./DocumentTitle";

export const DocumentHeader = ({
  documentId,
  headerRef,
  onOpenTags,
  tags,
  trailingAction,
  title,
}: {
  documentId: number;
  headerRef?: RefObject<HTMLDivElement | null>;
  onOpenTags: () => void;
  tags: DocumentTag[];
  trailingAction?: ReactNode;
  title?: string;
}) => {
  return (
    <Stack
      as="section"
      aria-label="Document header"
      ref={headerRef}
      mb="6"
      gap="3"
    >
      <Stack role="group" aria-label="Document title actions" gap="3">
        <DocumentTitle key={documentId} documentId={documentId} title={title} />
        <Flex justify="space-between" align="center" gap="3" wrap="wrap">
          <Flex
            role="group"
            aria-label="Document tags"
            align="center"
            gap="2"
            wrap="wrap"
          >
            {tags.map((tag) => (
              <TagLabel
                key={tag.id}
                backgroundColor={tag.backgroundColor}
                name={tag.name}
              />
            ))}
            {tags.length > 0 ? (
              <Tooltip content="Edit tags">
                <IconButton
                  aria-label="Edit tags"
                  onClick={onOpenTags}
                  size="sm"
                  variant="ghost"
                >
                  <Pencil aria-hidden="true" />
                </IconButton>
              </Tooltip>
            ) : (
              <Button onClick={onOpenTags} size="sm" variant="ghost">
                <Tag aria-hidden="true" />
                Add tags
              </Button>
            )}
          </Flex>
          {trailingAction}
        </Flex>
      </Stack>
    </Stack>
  );
};
