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
      mb="0.2em"
      me="0.5em"
      ms="-1.5em"
      verticalAlign="middle"
    >
      <Checkbox.HiddenInput {...props} />
      <Checkbox.Control>
        <Checkbox.Indicator />
      </Checkbox.Control>
    </Checkbox.Root>
  );
};
