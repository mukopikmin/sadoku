import { Flex, NativeSelect, Text } from "@chakra-ui/react";
import { useId } from "react";
import type { ThemeMode } from "../../models/theme";

export const ThemeSelect = ({
  value,
  onChange,
}: {
  value: ThemeMode;
  onChange: (value: ThemeMode) => void;
}) => {
  const id = useId();
  return (
    <Flex alignItems="center" justifyContent="space-between" gap="4">
      <Text asChild fontWeight="medium">
        <label htmlFor={id}>Theme</label>
      </Text>
      <NativeSelect.Root width="40">
        <NativeSelect.Field
          id={id}
          onChange={(event) => onChange(event.currentTarget.value as ThemeMode)}
          value={value}
        >
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </NativeSelect.Field>
        <NativeSelect.Indicator />
      </NativeSelect.Root>
    </Flex>
  );
};
