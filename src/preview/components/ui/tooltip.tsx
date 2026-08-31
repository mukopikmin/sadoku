import { Portal, Tooltip as ChakraTooltip } from "@chakra-ui/react";
import type React from "react";

type TooltipProps = ChakraTooltip.RootProps & {
  children: React.ReactElement;
  content: React.ReactNode;
  showArrow?: boolean;
};

export const Tooltip = ({
  children,
  content,
  showArrow = true,
  ...rootProps
}: TooltipProps) => (
  <ChakraTooltip.Root {...rootProps}>
    <ChakraTooltip.Trigger asChild>{children}</ChakraTooltip.Trigger>
    <Portal>
      <ChakraTooltip.Positioner>
        <ChakraTooltip.Content>
          {showArrow && (
            <ChakraTooltip.Arrow>
              <ChakraTooltip.ArrowTip />
            </ChakraTooltip.Arrow>
          )}
          {content}
        </ChakraTooltip.Content>
      </ChakraTooltip.Positioner>
    </Portal>
  </ChakraTooltip.Root>
);
