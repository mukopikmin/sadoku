import { Button, Flex } from "@chakra-ui/react";

type DocumentActionBarProps = {
  onOpenInstructions: () => void;
};

export const DocumentActionBar = (
  { onOpenInstructions }: DocumentActionBarProps,
) => (
  <Flex
    aria-label="Document actions"
    as="nav"
    justifyContent="flex-end"
    mb="6"
  >
    <Button
      onClick={onOpenInstructions}
      size="sm"
      type="button"
      variant="outline"
    >
      Instructions
    </Button>
  </Flex>
);
