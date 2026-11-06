import { Card } from "@chakra-ui/react";
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  label: string;
  maxHeight?: string;
};

export const ScrollableTextCard = ({
  children,
  label,
  maxHeight = "36dvh",
}: Props) => (
  <Card.Root
    variant="outline"
    size="sm"
    maxH={maxHeight}
    minH="0"
    overflow="hidden"
  >
    <Card.Body
      aria-label={label}
      role="region"
      tabIndex={0}
      minH="0"
      overflowY="auto"
      overflowWrap="anywhere"
    >
      {children}
    </Card.Body>
  </Card.Root>
);
