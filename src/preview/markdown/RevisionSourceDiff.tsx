import { Box } from "@chakra-ui/react";

export const RevisionSourceDiff = ({ diff }: { diff: string }) => (
  <Box
    as="pre"
    role="region"
    aria-label="Source diff from Previous"
    bg="canvas.subtle"
    fontFamily="mono"
    fontSize="sm"
    overflowX="auto"
    p="3"
  >
    <Box as="code" display="block" minW="100%" w="max-content">
      {diff.split("\n").map((line, index) => {
        const kind = line.startsWith("+")
          ? "addition"
          : line.startsWith("-")
          ? "deletion"
          : undefined;
        return (
          <Box
            as={kind === "addition"
              ? "ins"
              : kind === "deletion"
              ? "del"
              : "span"}
            bg={kind ? `syntax.${kind}.bg` : undefined}
            color={kind ? `syntax.${kind}.fg` : undefined}
            key={index}
            display="block"
            textDecoration="none"
          >
            {line}
            {"\n"}
          </Box>
        );
      })}
    </Box>
  </Box>
);
