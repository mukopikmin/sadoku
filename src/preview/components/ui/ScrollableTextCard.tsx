import { Card } from "@chakra-ui/react";
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  label: string;
  maxHeight?: string;
  footer?: ReactNode;
  flexShrink?: number;
};

export const ScrollableTextCard = ({
  children,
  label,
  maxHeight = "36dvh",
  footer,
  flexShrink = 1,
}: Props) => (
  <Card.Root
    variant="outline"
    size="sm"
    maxH={maxHeight}
    minH="0"
    flexShrink={flexShrink}
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
    {footer && (
      <Card.Footer
        flexShrink="0"
        alignItems="center"
        gap="2"
        justifyContent="space-between"
      >
        {footer}
      </Card.Footer>
    )}
  </Card.Root>
);
