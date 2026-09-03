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
      color: "white",
    } as CSSProperties}
    css={{
      "@supports (color: contrast-color(red))": {
        color: "contrast-color(var(--tag-background))",
      },
    }}
  >
    {name}
  </Badge>
);
