import {
  Badge,
  Box,
  Container,
  Flex,
  Float,
  IconButton,
  Image,
  Link,
  Tabs,
  Text,
} from "@chakra-ui/react";
import type { ReactNode, RefObject } from "react";

export type PreviewView = "comments" | "preview";

export const PreviewShell = ({ children }: { children: ReactNode }) => (
  <Flex
    as="header"
    position="sticky"
    top="0"
    zIndex="10"
    w="full"
    mb="8"
    borderBottomWidth="1px"
    borderColor="border.muted"
    bg="canvas"
    color="fg.muted"
    fontSize="sm"
  >
    <Container
      display="flex"
      maxW="980px"
      alignItems="center"
      justifyContent="space-between"
      flexWrap="wrap"
      gap="4"
      px="8"
      py="4"
    >
      {children}
    </Container>
  </Flex>
);

type PreviewHeaderProps = {
  connectionLost: boolean;
  fileUrl?: string;
  onChangeView: (view: PreviewView) => void;
  onReloadPreview: () => void;
  onOpenTags: () => void;
  onOpenSettings: () => void;
  onOpenStatistics: () => void;
  reloadAvailable: boolean;
  reloading: boolean;
  staleCommentCount: number;
  tagsTriggerRef?: RefObject<HTMLButtonElement | null>;
  title: string;
  unresolvedCommentCount: number;
  view: PreviewView;
  viewsDisabled?: boolean;
};

export const PreviewHeader = ({
  connectionLost,
  fileUrl,
  onChangeView,
  onReloadPreview,
  onOpenSettings,
  onOpenStatistics,
  onOpenTags,
  reloadAvailable,
  reloading,
  staleCommentCount,
  tagsTriggerRef,
  title,
  unresolvedCommentCount,
  view,
  viewsDisabled = false,
}: PreviewHeaderProps) => (
  <PreviewShell>
    <Flex alignItems="center" flex="1 1 16rem" gap="3" minW="0">
      <Image
        alt="Sadoku"
        flexShrink="0"
        h="8"
        src="/assets/icon-512.png"
        w="8"
      />
      {fileUrl
        ? (
          <Text as="div" minW="0">
            Previewing{" "}
            <Link href={fileUrl} color="fg" fontWeight="semibold">
              {title}
            </Link>.
          </Text>
        )
        : <Text fontWeight="semibold">{title}</Text>}
    </Flex>
    <Flex
      as="nav"
      aria-label="Preview views"
      alignItems="center"
      flex="0 1 auto"
      minW="0"
      wrap="wrap"
      gap="2"
    >
      {connectionLost && (
        <Badge
          colorPalette="red"
          role="status"
          variant="solid"
        >
          Connection lost
        </Badge>
      )}
      <IconButton
        aria-label="Open tags"
        onClick={onOpenTags}
        size="sm"
        type="button"
        variant="outline"
        ref={tagsTriggerRef}
      >
        <svg
          aria-hidden="true"
          fill="none"
          height="1em"
          viewBox="0 0 16 16"
          width="1em"
        >
          <path
            d="M2.5 3.5v3.3l6.7 6.7 4.3-4.3-6.7-6.7H3.5a1 1 0 0 0-1 1Z"
            stroke="currentColor"
            strokeLinejoin="round"
            strokeWidth="1.3"
          />
          <circle cx="5.5" cy="5.5" fill="currentColor" r=".8" />
        </svg>
      </IconButton>
      <IconButton
        aria-label="Open database statistics"
        onClick={onOpenStatistics}
        size="sm"
        type="button"
        variant="outline"
      >
        <svg
          aria-hidden="true"
          fill="none"
          height="1em"
          viewBox="0 0 16 16"
          width="1em"
        >
          <ellipse
            cx="8"
            cy="3.5"
            rx="5"
            ry="2"
            stroke="currentColor"
            strokeWidth="1.3"
          />
          <path
            d="M3 3.5v4c0 1.1 2.2 2 5 2s5-.9 5-2v-4M3 7.5v4c0 1.1 2.2 2 5 2s5-.9 5-2v-4"
            stroke="currentColor"
            strokeWidth="1.3"
          />
        </svg>
      </IconButton>
      <IconButton
        aria-label="Open settings"
        onClick={onOpenSettings}
        size="sm"
        type="button"
        variant="outline"
      >
        <svg
          aria-hidden="true"
          fill="none"
          height="1em"
          viewBox="0 0 16 16"
          width="1em"
        >
          <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M6.7 1.8h2.6l.4 1.5c.3.1.6.3.9.5l1.5-.5 1.3 2.2-1.1 1.1v1l1.1 1.1-1.3 2.2-1.5-.5-.9.5-.4 1.5H6.7l-.4-1.5-.9-.5-1.5.5-1.3-2.2 1.1-1.1v-1L2.6 5.5l1.3-2.2 1.5.5.9-.5.4-1.5Z"
            stroke="currentColor"
            strokeLinejoin="round"
            strokeWidth="1.2"
          />
        </svg>
      </IconButton>
      {reloadAvailable && (
        <IconButton
          aria-label={reloading ? "Reloading preview" : "Reload preview"}
          colorPalette="yellow"
          disabled={reloading}
          onClick={onReloadPreview}
          size="sm"
          type="button"
          variant="outline"
        >
          <svg
            aria-hidden="true"
            fill="none"
            height="1em"
            viewBox="0 0 16 16"
            width="1em"
          >
            <path
              d="M13.5 5.5V2.5m0 0h-3m3 0-2.1 2.1a5 5 0 1 0 1.3 5.1"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.5"
            />
          </svg>
        </IconButton>
      )}
      <Tabs.Root
        onValueChange={({ value }) => onChangeView(value as PreviewView)}
        size="sm"
        value={view}
        variant="enclosed"
      >
        <Tabs.List>
          <Tabs.Trigger
            disabled={viewsDisabled}
            onClick={() => onChangeView("preview")}
            value="preview"
          >
            Preview
          </Tabs.Trigger>
          <Tabs.Trigger
            aria-label={`Comments, ${unresolvedCommentCount} unresolved`}
            disabled={viewsDisabled}
            onClick={() => onChangeView("comments")}
            position="relative"
            value="comments"
          >
            Comments
            {staleCommentCount > 0 && (
              <Box as="span" ml="1" color="warning.fg">
                Stale {staleCommentCount}
              </Box>
            )}
            {unresolvedCommentCount > 0 && (
              <Float
                aria-hidden="true"
                as="span"
                bg="blue.solid"
                borderRadius="full"
                color="blue.contrast"
                fontSize="2xs"
                fontWeight="bold"
                minW="5"
                offset="1"
                px="1"
              >
                {unresolvedCommentCount}
              </Float>
            )}
          </Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content display="none" value={view} />
      </Tabs.Root>
    </Flex>
  </PreviewShell>
);
