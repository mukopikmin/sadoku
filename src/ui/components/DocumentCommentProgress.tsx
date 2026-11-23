import { Flex, Progress, Text } from "@chakra-ui/react";
import { Check } from "lucide-react";
import type { CommentProgress } from "../models/comment";

export const DocumentCommentProgress = ({
  total,
  resolved,
}: CommentProgress) => {
  if (total === 0) {
    return (
      <Text color="fg.muted" fontSize="xs">
        No comments
      </Text>
    );
  }

  const remaining = total - resolved;
  return (
    <Progress.Root
      colorPalette="green"
      gap="1"
      max={total}
      value={resolved}
      size="xs"
      variant="subtle"
    >
      <Flex
        align="baseline"
        justify="space-between"
        gap="1"
        wrap="wrap"
        fontSize="xs"
      >
        <Flex align="center" gap="1" fontWeight="semibold">
          {remaining === 0 ? (
            <>
              <Check size={14} aria-hidden="true" />
              All resolved
            </>
          ) : (
            `${remaining} remaining`
          )}
        </Flex>
        <Text color="fg.muted" fontVariantNumeric="tabular-nums">
          {resolved} / {total} resolved
        </Text>
      </Flex>
      <Progress.Track
        aria-label="Comment resolution"
        aria-valuetext={`${resolved} of ${total} threads resolved`}
        rounded="full"
      >
        <Progress.Range />
      </Progress.Track>
    </Progress.Root>
  );
};
