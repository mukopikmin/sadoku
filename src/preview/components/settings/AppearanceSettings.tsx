import {
  createListCollection,
  Flex,
  IconButton,
  Select,
  Switch,
  Text,
} from "@chakra-ui/react";
import type { CodeWrapMode, ThemeMode } from "../../models/theme";
import { FONT_SCALES, getAdjacentFontScales } from "./settingsValidation";

const themes = createListCollection<{ label: string; value: ThemeMode }>({
  items: [
    { label: "Light", value: "light" },
    { label: "Dark", value: "dark" },
  ],
});

type AppearanceSettingsProps = {
  codeWrapMode: CodeWrapMode;
  fontScale: number;
  onCodeWrapModeChange: (value: CodeWrapMode) => void;
  onFontScaleChange: (value: number) => void;
  onThemeModeChange: (value: ThemeMode) => void;
  onShowHtmlCommentsChange: (value: boolean) => void;
  onShowHighlightBoundariesChange: (value: boolean) => void;
  showHighlightBoundaries: boolean;
  showHtmlComments: boolean;
  themeMode: ThemeMode;
};

export const AppearanceSettings = (
  {
    codeWrapMode,
    fontScale,
    onCodeWrapModeChange,
    onFontScaleChange,
    onThemeModeChange,
    onShowHtmlCommentsChange,
    onShowHighlightBoundariesChange,
    showHighlightBoundaries,
    showHtmlComments,
    themeMode,
  }: AppearanceSettingsProps,
) => {
  const { decrease, increase } = getAdjacentFontScales(fontScale);
  return (
    <>
      <Flex alignItems="center" justifyContent="space-between" gap="4">
        <Text
          as="label"
          htmlFor="theme-mode"
          id="theme-mode-label"
          textStyle="label"
        >
          Theme
        </Text>
        <Select.Root
          collection={themes}
          ids={{ trigger: "theme-mode" }}
          onValueChange={({ items }) => {
            if (items[0]) onThemeModeChange(items[0].value);
          }}
          positioning={{ strategy: "fixed", sameWidth: true }}
          size="sm"
          value={[themeMode]}
          width="40"
        >
          <Select.HiddenSelect />
          <Select.Control>
            <Select.Trigger aria-labelledby="theme-mode-label">
              <Select.ValueText />
            </Select.Trigger>
            <Select.IndicatorGroup>
              <Select.Indicator />
            </Select.IndicatorGroup>
          </Select.Control>
          <Select.Positioner>
            <Select.Content>
              {themes.items.map((theme) => (
                <Select.Item item={theme} key={theme.value}>
                  <Select.ItemText>{theme.label}</Select.ItemText>
                  <Select.ItemIndicator />
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Positioner>
        </Select.Root>
      </Flex>
      <Flex alignItems="center" justifyContent="space-between" gap="4">
        <Text as="div">
          <Text textStyle="label">Text size</Text>
          <Text color="fg.muted" fontSize="sm">
            Adjust text throughout the preview
          </Text>
        </Text>
        <Flex
          alignItems="center"
          aria-label="Text size controls"
          gap="2"
          role="group"
        >
          <IconButton
            aria-label="Decrease text size"
            disabled={fontScale <= FONT_SCALES[0]}
            onClick={() => onFontScaleChange(decrease)}
            size="sm"
            variant="outline"
          >
            −
          </IconButton>
          <Text aria-live="polite" minW="12" textAlign="center">
            {Math.round(fontScale * 100)}%
          </Text>
          <IconButton
            aria-label="Increase text size"
            disabled={fontScale >= FONT_SCALES.at(-1)!}
            onClick={() => onFontScaleChange(increase)}
            size="sm"
            variant="outline"
          >
            +
          </IconButton>
        </Flex>
      </Flex>
      <Flex alignItems="center" justifyContent="space-between" gap="4">
        <Text as="div">
          <Text textStyle="label">Wrap code blocks</Text>
          <Text color="fg.muted" fontSize="sm">
            Allow long lines to wrap instead of scrolling horizontally
          </Text>
        </Text>
        <Switch.Root
          checked={codeWrapMode === "wrap"}
          onCheckedChange={({ checked }) =>
            onCodeWrapModeChange(checked ? "wrap" : "scroll")}
        >
          <Switch.HiddenInput />
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
          <Switch.Label srOnly>Wrap code blocks</Switch.Label>
        </Switch.Root>
      </Flex>
      <Flex alignItems="center" justifyContent="space-between" gap="4">
        <Text textStyle="label">Show HTML comments</Text>
        <Switch.Root
          checked={showHtmlComments}
          onCheckedChange={({ checked }) => onShowHtmlCommentsChange(checked)}
        >
          <Switch.HiddenInput />
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
          <Switch.Label srOnly>Show HTML comments</Switch.Label>
        </Switch.Root>
      </Flex>
      <Flex alignItems="center" justifyContent="space-between" gap="4">
        <Text as="div">
          <Text fontWeight="medium">Show highlight boundaries</Text>
          <Text color="fg.muted" fontSize="sm">
            Outline all highlight regions to inspect their spacing
          </Text>
        </Text>
        <Switch.Root
          checked={showHighlightBoundaries}
          onCheckedChange={({ checked }) =>
            onShowHighlightBoundariesChange(checked)}
        >
          <Switch.HiddenInput />
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
          <Switch.Label srOnly>Show highlight boundaries</Switch.Label>
        </Switch.Root>
      </Flex>
    </>
  );
};
