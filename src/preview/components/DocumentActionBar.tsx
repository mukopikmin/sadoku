import {
  ActionBar,
  Badge,
  Button,
  Flex,
  HoverCard,
  Portal,
  Text,
} from "@chakra-ui/react";
import { Eye, EyeOff, FileText, Tag } from "lucide-react";
import { TableOfContents } from "../pages/markdown/TableOfContents";
import type { DocumentTag } from "../models/document";
import { TagLabel } from "./ui/TagLabel";

type DocumentActionBarProps = {
  instructionCount: number;
  markdown?: string;
  onOpenInstructions: () => void;
  onToggleHtmlComments: () => void;
  showHtmlComments: boolean;
  tagCount: number;
  onOpenTags: () => void;
  tags: DocumentTag[];
};

export const DocumentActionBar = (
  {
    instructionCount,
    markdown,
    onOpenInstructions,
    onOpenTags,
    onToggleHtmlComments,
    showHtmlComments,
    tagCount,
    tags,
  }: DocumentActionBarProps,
) => (
  <ActionBar.Root open>
    <Portal>
      <ActionBar.Positioner>
        <ActionBar.Content aria-label="Document actions">
          <HoverCard.Root
            closeDelay={100}
            openDelay={200}
            positioning={{ placement: "top-start" }}
            size="sm"
          >
            <HoverCard.Trigger asChild>
              <Button
                onClick={onOpenTags}
                size="sm"
                type="button"
                variant="outline"
              >
                <Tag aria-hidden="true" />
                Tags
                <Badge aria-hidden="true" size="sm" variant="solid">
                  {tagCount}
                </Badge>
              </Button>
            </HoverCard.Trigger>
            <Portal>
              <HoverCard.Positioner>
                <HoverCard.Content>
                  <HoverCard.Arrow>
                    <HoverCard.ArrowTip />
                  </HoverCard.Arrow>
                  <Text fontWeight="semibold">Document tags</Text>
                  {tags.length === 0
                    ? <Text color="fg.muted" pt="2">No tags added.</Text>
                    : (
                      <Flex gap="2" pt="2" wrap="wrap">
                        {tags.map((tag) => (
                          <TagLabel
                            backgroundColor={tag.backgroundColor}
                            key={tag.id}
                            name={tag.name}
                          />
                        ))}
                      </Flex>
                    )}
                </HoverCard.Content>
              </HoverCard.Positioner>
            </Portal>
          </HoverCard.Root>
          <Button
            onClick={onOpenInstructions}
            size="sm"
            type="button"
            variant="outline"
          >
            <FileText aria-hidden="true" />
            Instructions
            <Badge aria-hidden="true" size="sm" variant="solid">
              {instructionCount}
            </Badge>
          </Button>
          <Button
            aria-label={showHtmlComments
              ? "Hide HTML comments"
              : "Show HTML comments"}
            aria-pressed={!showHtmlComments}
            onClick={onToggleHtmlComments}
            size="sm"
            type="button"
            variant="outline"
          >
            {showHtmlComments
              ? <Eye aria-hidden="true" />
              : <EyeOff aria-hidden="true" />}
            HTML comments
          </Button>
          {markdown !== undefined && <TableOfContents markdown={markdown} />}
        </ActionBar.Content>
      </ActionBar.Positioner>
    </Portal>
  </ActionBar.Root>
);
