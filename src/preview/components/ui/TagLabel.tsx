import { Badge, type BadgeProps } from "@chakra-ui/react";
import type { CSSProperties } from "react";
import type { DocumentTag } from "../../models/document";

type Props = BadgeProps & Pick<DocumentTag, "backgroundColor" | "name">;

const fallbackTextColor = (backgroundColor: string): "black" | "white" => {
  const channels = [1, 3, 5].map((index) =>
    Number.parseInt(backgroundColor.slice(index, index + 2), 16) / 255
  );
  const luminance = channels
    .map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
    )
    .reduce(
      (value, channel, index) =>
        value + channel * ([0.2126, 0.7152, 0.0722][index] ?? 0),
      0,
    );
  return luminance > 0.179 ? "black" : "white";
};

export const TagLabel = ({ backgroundColor, name, ...props }: Props) => (
  <Badge
    {...props}
    style={{
      "--tag-background": backgroundColor,
      "--tag-foreground-fallback": fallbackTextColor(backgroundColor),
      backgroundColor: "var(--tag-background)",
    } as CSSProperties}
    css={{
      color: "var(--tag-foreground-fallback)",
      "@supports (color: contrast-color(red))": {
        color: "contrast-color(var(--tag-background))",
      },
    }}
  >
    {name}
  </Badge>
);
