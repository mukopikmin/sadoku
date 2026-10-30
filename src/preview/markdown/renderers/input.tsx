import { Checkbox } from "@chakra-ui/react";
import type { MarkdownComponentProps } from "../rendererTypes";

export const MarkdownInput = ({
  checked,
  className,
  disabled,
  node: _node,
  type,
  ...props
}: MarkdownComponentProps<"input">) => {
  if (type !== "checkbox") {
    return <input type={type} {...props} />;
  }

  return (
    <Checkbox.Root
      as="span"
      checked={Boolean(checked)}
      className={className}
      disabled={disabled}
      display="inline-flex"
      mb="1"
      me="2"
      ms="-6"
      verticalAlign="middle"
    >
      <Checkbox.HiddenInput {...props} />
      <Checkbox.Control>
        <Checkbox.Indicator />
      </Checkbox.Control>
    </Checkbox.Root>
  );
};
