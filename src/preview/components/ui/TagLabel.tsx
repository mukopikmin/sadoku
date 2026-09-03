import { Badge, type BadgeProps } from "@chakra-ui/react";
import type { CSSProperties } from "react";
import type { DocumentTag } from "../../models/document";

type Props = BadgeProps & Pick<DocumentTag, "backgroundColor" | "name">;

export const TagLabel = ({ backgroundColor, name, ...props }: Props) => (
  <Badge
    {...props}
    style={{
      "--tag-background": backgroundColor,
      backgroundColor: "var(--tag-background)",
    } as CSSProperties}
    css={{
      color: "contrast-color(var(--tag-background))",
    }}
  >
    {name}
  </Badge>
);
