import { Button, Flex } from "@chakra-ui/react";
import { TableOfContents } from "../pages/markdown/TableOfContents";

type DocumentActionBarProps = {
  markdown?: string;
  onOpenInstructions: () => void;
};

export const DocumentActionBar = (
  { markdown, onOpenInstructions }: DocumentActionBarProps,
) => (
  <Flex
    aria-label="Document actions"
    as="nav"
    bottom={{ base: "4", md: "6" }}
    gap="2"
    justifyContent="flex-end"
    position="fixed"
    right="max(var(--chakra-spacing-8), calc((100vw - 980px) / 2 + var(--chakra-spacing-8)))"
    zIndex="dropdown"
  >
    <Button
      bg="canvas"
      boxShadow="md"
      onClick={onOpenInstructions}
      size="sm"
      type="button"
      variant="outline"
    >
      Instructions
    </Button>
    {markdown !== undefined && <TableOfContents markdown={markdown} />}
  </Flex>
);
