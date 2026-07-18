import {
  Box,
  Button,
  Flex,
  Group,
  IconButton,
  Link,
  Text,
} from "@chakra-ui/react";
import type { ReactNode } from "react";
import type { ThemeMode } from "../../hooks/useThemeMode";

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
    pt="8"
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
      <IconButton
        aria-label={`Switch to ${themeMode === "dark" ? "light" : "dark"} mode`}
        onClick={onToggleThemeMode}
        size="sm"
        type="button"
        variant="outline"
      >
        {themeMode === "dark"
          ? (
            <svg
              aria-hidden="true"
              fill="none"
              height="1em"
              viewBox="0 0 16 16"
              width="1em"
            >
              <circle
                cx="8"
                cy="8"
                r="2.5"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path
                d="M8 1.5v1M8 13.5v1M1.5 8h1M13.5 8h1M3.4 3.4l.7.7M11.9 11.9l.7.7M12.6 3.4l-.7.7M4.1 11.9l-.7.7"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="1.5"
              />
            </svg>
          )
          : (
            <svg
              aria-hidden="true"
              fill="none"
              height="1em"
              viewBox="0 0 16 16"
              width="1em"
            >
              <path
                d="M13.5 10.2A5.6 5.6 0 0 1 5.8 2.5 5.6 5.6 0 1 0 13.5 10.2Z"
                stroke="currentColor"
                strokeLinejoin="round"
                strokeWidth="1.5"
              />
            </svg>
          )}
      </IconButton>
      <Group attached>
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
      </Group>
    </Flex>
  </PreviewShell>
);
