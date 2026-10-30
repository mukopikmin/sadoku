import { Badge, Box, Flex, Stack, Text } from "@chakra-ui/react";
import { useId } from "react";
import type { Comment } from "../../models/comment";
import { CommentSourceMarkdown } from "./CommentSourceMarkdown";

const SourceVersion = (
  { label, children }: { label: string; children: string },
) => {
  const labelId = useId();
  return (
    <Box as="section" aria-labelledby={labelId}>
      <Text
        id={labelId}
        color="fg.muted"
        fontSize="xs"
        fontWeight="semibold"
        mb="1"
      >
        {label}
      </Text>
      <CommentSourceMarkdown>{children}</CommentSourceMarkdown>
    </Box>
  );
};

export const CommentSourcePreview = ({ comment }: { comment: Comment }) => {
  const original = comment.sourceText;
  const current = comment.currentSource ?? { state: "unavailable" };
  const unchanged = current.state === "available" && current.text === original;
  const changed = current.state === "available" && original !== undefined &&
    !unchanged;
  if (original === undefined && current.state !== "available") return null;

  return (
    <Stack
      as="section"
      className="comment-source-target"
      gap="3"
      mb="2"
      aria-label="Target line"
    >
      {changed && (
        <Flex my="2">
          <Badge variant="subtle">Changed</Badge>
        </Flex>
      )}
      {original !== undefined && (
        <SourceVersion
          label={unchanged ? "At comment time / Current" : "At comment time"}
        >
          {original}
        </SourceVersion>
      )}
      {unchanged
        ? <Text color="fg.muted" fontSize="xs">Unchanged since comment</Text>
        : current.state === "available"
        ? <SourceVersion label="Current">{current.text}</SourceVersion>
        : (
          <Text color="fg.muted" fontSize="sm">
            {current.state === "deleted"
              ? "The target lines have been deleted."
              : "The current target lines could not be located."}
          </Text>
        )}
    </Stack>
  );
};
