import { Flex, IconButton, Switch, Text } from "@chakra-ui/react";
import type { CodeWrapMode, ThemeMode } from "../../models/theme";
import { FONT_SCALES, getAdjacentFontScales } from "./settingsValidation";
import { ThemeSelect } from "./ThemeSelect";

type AppearanceSettingsProps = {
  codeWrapMode: CodeWrapMode;
  fontScale: number;
  onCodeWrapModeChange: (value: CodeWrapMode) => void;
  onFontScaleChange: (value: number) => void;
  onThemeModeChange: (value: ThemeMode) => void;
  onShowHtmlCommentsChange: (value: boolean) => void;
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
    showHtmlComments,
    themeMode,
  }: AppearanceSettingsProps,
) => {
  const { decrease, increase } = getAdjacentFontScales(fontScale);
  return (
    <>
      <ThemeSelect value={themeMode} onChange={onThemeModeChange} />
      <Flex alignItems="center" justifyContent="space-between" gap="4">
        <Text as="div">
          <Text fontWeight="medium">Text size</Text>
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
          <Text fontWeight="medium">Wrap code blocks</Text>
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
        <Text fontWeight="medium">Show HTML comments</Text>
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
    </>
  );
};
