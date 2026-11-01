import { Badge, type BadgeProps } from "@chakra-ui/react";
import type { CSSProperties } from "react";
import type { DocumentTag } from "../../models/document";

type Props = BadgeProps & Pick<DocumentTag, "backgroundColor" | "name">;

export const getTagColorStyle = (backgroundColor: string): CSSProperties => ({
  "--tag-background": backgroundColor,
  backgroundColor: "var(--tag-background)",
  color: "contrast-color(var(--tag-background))",
} as CSSProperties);

export const TagLabel = ({ backgroundColor, name, ...props }: Props) => (
  <Badge
    {...props}
    style={getTagColorStyle(backgroundColor)}
  >
    {name}
  </Badge>
);
