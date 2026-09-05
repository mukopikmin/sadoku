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
import { Database, RefreshCw, Settings, Tag } from "lucide-react";
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
        <Tag aria-hidden="true" />
      </IconButton>
      <IconButton
        aria-label="Open database statistics"
        onClick={onOpenStatistics}
        size="sm"
        type="button"
        variant="outline"
      >
        <Database aria-hidden="true" />
      </IconButton>
      <IconButton
        aria-label="Open settings"
        onClick={onOpenSettings}
        size="sm"
        type="button"
        variant="outline"
      >
        <Settings aria-hidden="true" />
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
          <RefreshCw aria-hidden="true" />
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
