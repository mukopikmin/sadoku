import { Box, Button, Flex, Link, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";
import type { ThemeMode } from "./useThemeMode";

export type PreviewView = "comments" | "preview";

export const PreviewShell = ({ children }: { children: ReactNode }) => (
  <Flex
    as="header"
    position="sticky"
    top="0"
    zIndex="10"
    align="center"
    justify="space-between"
    gap="4"
    mb="8"
    borderBottomWidth="1px"
    borderColor="border.muted"
    pb="4"
    bg="canvas"
    color="fg.muted"
    fontSize="sm"
  >
    {children}
  </Flex>
);

type PreviewHeaderProps = {
  commentCount: number;
  fileUrl: string;
  onChangeView: (view: PreviewView) => void;
  onToggleThemeMode: () => void;
  reloadAvailable: boolean;
  staleCommentCount: number;
  themeMode: ThemeMode;
  title: string;
  view: PreviewView;
};

export const PreviewHeader = ({
  commentCount,
  fileUrl,
  onChangeView,
  onToggleThemeMode,
  reloadAvailable,
  staleCommentCount,
  themeMode,
  title,
  view,
}: PreviewHeaderProps) => (
  <PreviewShell>
    <Text as="div">
      Previewing{" "}
      <Link href={fileUrl} color="fg" fontWeight="semibold">
        {title}
      </Link>.
      {reloadAvailable && (
        <Flex
          as="span"
          role="status"
          display="inline-flex"
          wrap="wrap"
          align="center"
          gap="2"
          ml="2"
          color="warning.fg"
        >
          Source changes are available.
          <Button
            size="xs"
            variant="outline"
            colorPalette="yellow"
            onClick={() => globalThis.location.reload()}
            type="button"
          >
            Reload preview
          </Button>
        </Flex>
      )}
    </Text>
    <Flex as="nav" aria-label="Preview views" wrap="wrap" gap="2">
      <Button
        aria-label={`Switch to ${themeMode === "dark" ? "light" : "dark"} mode`}
        onClick={onToggleThemeMode}
        size="sm"
        type="button"
        variant="outline"
      >
        {themeMode === "dark" ? "Light" : "Dark"} mode
      </Button>
      <Button
        aria-current={view === "preview" ? "page" : undefined}
        colorPalette={view === "preview" ? "blue" : "gray"}
        onClick={() => onChangeView("preview")}
        size="sm"
        type="button"
        variant="outline"
      >
        Preview
      </Button>
      <Button
        aria-current={view === "comments" ? "page" : undefined}
        colorPalette={view === "comments" ? "blue" : "gray"}
        onClick={() => onChangeView("comments")}
        size="sm"
        type="button"
        variant="outline"
      >
        Comments {commentCount}
        {staleCommentCount > 0 && (
          <Box as="span" ml="1" color="warning.fg">
            Stale {staleCommentCount}
          </Box>
        )}
      </Button>
    </Flex>
  </PreviewShell>
);
