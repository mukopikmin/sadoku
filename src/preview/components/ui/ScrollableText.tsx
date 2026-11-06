import { Card } from "@chakra-ui/react";
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  label: string;
  maxHeight?: string;
};

export const ScrollableText = ({ children, label, maxHeight }: Props) => (
  <Card.Body
    aria-label={label}
    role="region"
    tabIndex={0}
    maxH={maxHeight}
    minH="0"
    overflowY="auto"
    overflowWrap="anywhere"
  >
    {children}
  </Card.Body>
);
